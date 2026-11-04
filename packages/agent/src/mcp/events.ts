import { createHash } from "node:crypto";
import { type McpServer, ProtocolError } from "@modelcontextprotocol/server";
import {
  type Checkouts,
  type CheckoutView,
  notStarted,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { z } from "zod";
import { shortTask } from "../task.js";
import type { EventStore, EventSubscription, Seen } from "./event-store.js";
import type { AppHost } from "./hosts.js";
import {
  callbackProblem,
  type FailureReason,
  MAX_BODY_BYTES,
  postSigned,
  publicTransport,
  signingKey,
  statusFailure,
  verifyCallback,
  WebhookError,
  type WebhookTransport,
} from "./webhooks.js";

/**
 * MCP Events (webhook delivery, protocol 2026-07-28) for checkouts: ChatGPT
 * subscribes with a callback URL and a `whsec_` secret, and we POST a signed
 * event when a checkout needs the user, places the order, or ends without one.
 *
 * Nothing here runs on its own clock. A subscription is checked when:
 * - the client refreshes it (`events/subscribe` again before `refreshBefore`),
 *   which the spec requires to keep it alive; we grant at most two minutes,
 *   so the refresh is the poll, and it stops when the client stops;
 * - any of our surfaces reads that checkout for the user (MCP tools and the
 *   card's polling, the web dock and the secure page), which reuses the view
 *   it already has.
 * Crossmint keeps the checkout's state. We keep, per subscription, only the
 * last state we told the client about (`seen`), so each change is sent once
 * (at least once: a failed delivery stays pending and is retried with the
 * same event ID on the next check).
 */

export const EVENT_NAMES = {
  needsYou: "checkout.needs_you",
  orderPlaced: "checkout.order_placed",
  ended: "checkout.ended",
} as const;
type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

/** Shortest and longest subscription we grant: the refresh is how we notice changes. */
export const TTL_MIN_MS = 60_000;
export const TTL_MAX_MS = 120_000;
/** How long a passed callback challenge covers a user's URL. */
const VERIFIED_FOR_MS = 24 * 60 * 60_000;
/** After a secret rotation, deliveries are also signed with the old one this long. */
const ROTATION_MS = 5 * 60_000;
const MAX_SUBSCRIPTIONS = 20;
const SEEN_LIMIT = 50;
/** Retries within one check (then on the next check, with the same event ID). */
const RETRY_DELAYS_MS = [1_000, 3_000];
/** Callback challenges per user per instance, against flooding someone else's URL. */
const VERIFICATIONS_PER_WINDOW = 10;
const VERIFICATION_WINDOW_MS = 10 * 60_000;

// The status copy below matches the web chat's checkout dock (`statusOf`) for
// what needs the user, and its checkout card (`describe`, `outcomeLine`) for
// outcomes, so the model can tell the user exactly what our UI would show.
// events.unit.test.ts checks it against the in-host card's copy of those rules.

const blockedLabels: Record<string, string> = {
  "merchant.access_blocked": "Store blocked access",
  "merchant.checkout_error": "Store checkout error",
  "merchant.fulfillment_unavailable": "Can't deliver there",
  "merchant.human_verification_required": "Store wants a human check",
  "merchant.no_safe_path": "No safe way to check out",
  "merchant.payment_declined": "Payment declined",
  "policy.max_cost_exceeded": "Over your limit",
  "product.item_unavailable": "Item unavailable",
  "product.requested_option_unavailable": "Option unavailable",
};

const failureLines: Record<string, string> = {
  browser_session_lost: "The connection to the store was lost.",
  browser_location_unsupported: "The store isn't available from our location.",
  cost_limit: "The total would have gone over your limit.",
  input_expired: "The store's request expired before it was answered.",
  model_error: "The checkout agent ran into a problem.",
  runtime_error: "The checkout stopped before it finished.",
  accounting_unavailable: "Crossmint couldn't confirm the payment state.",
  cancelled: "The checkout was cancelled.",
};

const needsYouLabels = {
  payment: "Ready to pay",
  question: "Needs your answer",
  protected: "Needs a secure step",
} as const;

export function formatMoney({
  amount,
  currency,
}: {
  amount: string;
  currency: string;
}) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

function unconfirmed(view: CheckoutView) {
  return (
    view.result?.failureReason === "reconciliation_required" ||
    view.result?.blockedCode === "reconciliation_required"
  );
}

/** The status label our UI shows for a checkout that needs the user or has ended. */
export function statusLabel(view: CheckoutView): string | null {
  if (view.status === "awaiting_input" && view.pending) {
    return needsYouLabels[view.pending.kind];
  }
  if (unconfirmed(view)) {
    return "Not confirmed";
  }
  switch (view.status) {
    case "succeeded":
      return "Order placed";
    case "blocked":
      return `Couldn't buy · ${blockedLabels[view.result?.blockedCode ?? ""] ?? "Blocked"}`;
    case "failed":
      return "Stopped";
    case "cancelled":
      return "Canceled";
    default:
      return null;
  }
}

/** The one line our checkout card shows under a settled outcome, or null. */
export function outcomeLine(view: CheckoutView): string | null {
  if (unconfirmed(view)) {
    return "We can't tell if the store placed this order. Don't buy it again yet: it could charge you twice.";
  }
  const result = view.result;
  switch (view.status) {
    case "succeeded":
      return result?.receipt
        ? "Order confirmed by the store. Receipt captured."
        : "The store confirmed the order. No receipt was captured, so check your email for the store's confirmation.";
    case "blocked":
    case "cancelled":
      return result?.summary ? `“${result.summary}”` : null;
    case "failed":
      return (
        failureLines[result?.failureReason ?? ""] ??
        "The checkout stopped before it finished."
      );
    default:
      return null;
  }
}

/** How long a watched checkout stays watchable after it ends. */
export const ENDED_GRACE_MS = 10 * 60_000;

/** True when `seen` says the run ended more than ENDED_GRACE_MS ago. */
export function endedLongAgo(
  entry: { k: string; t: number } | undefined,
  at: number,
) {
  if (!entry) {
    return false;
  }
  const status = entry.k.split(":")[0] ?? "";
  const ended = !["queued", "running", "awaiting_input"].includes(status);
  return ended && at - entry.t * 1000 > ENDED_GRACE_MS;
}

/** What changed: the status, plus which request is open (same as the card's). */
export function stateKey(view: CheckoutView) {
  return `${view.status}:${view.pending?.requestId ?? ""}`;
}

/** The signed-in Menta page for a checkout, tagged with the host that sent the user. */
export function checkoutPage(
  origin: string,
  runId: string,
  host: string | null,
) {
  const url = new URL(`/checkouts/${encodeURIComponent(runId)}`, origin);
  if (host === "chatgpt" || host === "claude" || host === "grok") {
    url.searchParams.set("via", host);
  }
  return url.href;
}

export interface CheckoutEvent {
  readonly name: EventName;
  readonly data: Record<string, unknown>;
}

/**
 * The event a checkout's current state is, if any. Data only (the model
 * reads it): no live-view URL, progress, address or instructions. Text the
 * store wrote (its question) is data like any tool result.
 */
export function checkoutEvent(
  view: CheckoutView,
  origin: string,
  host: string | null = null,
): CheckoutEvent | null {
  const status = statusLabel(view);
  if (!status) {
    return null;
  }
  const common = {
    runId: view.runId,
    store: view.store,
    task: view.task ? shortTask(view.task) : null,
    status,
    headline: `${view.store} · ${status}`,
    url: checkoutPage(origin, view.runId, host),
  };
  const pending = view.pending;
  if (view.status === "awaiting_input" && pending) {
    return {
      name: EVENT_NAMES.needsYou,
      data: {
        ...common,
        kind: pending.kind,
        requestId: pending.requestId,
        question: pending.question,
        expiresAt: pending.expiresAt,
        ...(pending.kind === "payment"
          ? {
              amount: formatMoney(pending.amount),
              amountNote: `${pending.amount.exact ? "Exact amount" : "Up to this amount"} to ${pending.merchant.name}`,
            }
          : {}),
        ...(pending.kind === "question"
          ? {
              fields: pending.fields.map((field) => ({
                key: field.key,
                label: field.label,
                required: field.required,
                ...(field.options
                  ? {
                      options: field.options.map((option) => ({
                        value: option.value,
                        label: option.label,
                      })),
                    }
                  : {}),
              })),
            }
          : {}),
      },
    };
  }
  if (view.status === "succeeded" && !unconfirmed(view)) {
    const receipt = view.result?.receipt ?? null;
    return {
      name: EVENT_NAMES.orderPlaced,
      data: {
        ...common,
        total: receipt ? formatMoney(receipt.total) : null,
        orderNumber: receipt?.merchantOrderId ?? null,
        detail: outcomeLine(view),
      },
    };
  }
  if (
    view.status === "succeeded" ||
    view.status === "failed" ||
    view.status === "blocked" ||
    view.status === "cancelled"
  ) {
    return {
      name: EVENT_NAMES.ended,
      data: {
        ...common,
        outcome: unconfirmed(view)
          ? "not_confirmed"
          : view.status === "cancelled"
            ? "canceled"
            : view.status === "blocked"
              ? "couldnt_buy"
              : "stopped",
        detail: outcomeLine(view),
        mayHaveOrdered: unconfirmed(view),
      },
    };
  }
  return null;
}

const runFilter = {
  type: "object",
  properties: {
    runId: {
      type: "string",
      description:
        "One checkout's runId (from start or history). Leave it out to follow all of the user's checkouts, including ones started later.",
    },
  },
  additionalProperties: false,
} as const;

const commonPayload = {
  runId: { type: "string" },
  store: { type: "string", description: "The store's domain." },
  task: {
    type: ["string", "null"],
    description: "What is being bought, as the user agreed it.",
  },
  status: {
    type: "string",
    description: "The checkout's status in a few words, e.g. 'Ready to pay'.",
  },
  headline: {
    type: "string",
    description:
      "Store and status in one line, e.g. 'amazon.com · Ready to pay'.",
  },
  url: {
    type: "string",
    description:
      "The checkout's page on Menta, where the signed-in user approves payments and enters private details.",
  },
} as const;
const commonRequired = ["runId", "store", "task", "status", "headline", "url"];

/** The `events/list` catalog. Schemas evolve additively only (new optional fields). */
export const eventDefinitions = [
  {
    name: EVENT_NAMES.needsYou,
    description:
      "A checkout needs the user: the store asked a question, wants private details (a code or password), or the payment is ready to approve. The assistant may pay from one of the user's spending limits that fits (spending_limits, pay_with_spending_limit), or the user approves one; private details are entered only by the user on the checkout's page or card.",
    delivery: ["webhook"],
    inputSchema: runFilter,
    payloadSchema: {
      type: "object",
      properties: {
        ...commonPayload,
        kind: { type: "string", enum: ["question", "payment", "protected"] },
        requestId: { type: "string" },
        question: { type: "string", description: "The store's request." },
        expiresAt: { type: ["string", "null"] },
        amount: {
          type: "string",
          description: "Payment only: the amount to approve, e.g. '$31.20'.",
        },
        amountNote: {
          type: "string",
          description:
            "Payment only: 'Exact amount to <store>' or 'Up to this amount to <store>'.",
        },
        fields: {
          type: "array",
          description:
            "Question only: what the store asks for (answer with answer).",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              required: { type: "boolean" },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    value: { type: "string" },
                    label: { type: "string" },
                  },
                  required: ["value", "label"],
                },
              },
            },
            required: ["key", "label", "required"],
          },
        },
      },
      required: [...commonRequired, "kind", "requestId", "question"],
    },
  },
  {
    name: EVENT_NAMES.orderPlaced,
    description:
      "A checkout placed the order: the store confirmed it. Carries the receipt total and store order number when the store showed them.",
    delivery: ["webhook"],
    inputSchema: runFilter,
    payloadSchema: {
      type: "object",
      properties: {
        ...commonPayload,
        total: { type: ["string", "null"], description: "e.g. '$31.20'." },
        orderNumber: { type: ["string", "null"] },
        detail: { type: ["string", "null"] },
      },
      required: [...commonRequired, "total", "orderNumber", "detail"],
    },
  },
  {
    name: EVENT_NAMES.ended,
    description:
      "A checkout ended without a confirmed order: it was canceled, the store couldn't sell it, it stopped, or it's unclear whether the order went through (mayHaveOrdered).",
    delivery: ["webhook"],
    inputSchema: runFilter,
    payloadSchema: {
      type: "object",
      properties: {
        ...commonPayload,
        outcome: {
          type: "string",
          enum: ["canceled", "couldnt_buy", "stopped", "not_confirmed"],
        },
        detail: {
          type: ["string", "null"],
          description: "The line our checkout card shows, if any.",
        },
        mayHaveOrdered: {
          type: "boolean",
          description:
            "True when the store may have placed the order anyway: buying again could charge twice.",
        },
      },
      required: [...commonRequired, "outcome", "detail", "mayHaveOrdered"],
    },
  },
] as const;

const filterArguments = z
  .object({ runId: z.string().trim().min(1).max(200).optional() })
  .strict();

/** JSON with object keys sorted, so key order never makes a second subscription. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(parts: unknown[]) {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 32);
}

/** Deterministic over (user, callback URL, event name, canonical arguments). */
export function subscriptionId(
  userId: string,
  url: string,
  name: string,
  args: Record<string, unknown>,
) {
  return `sub_${digest([userId, url, name, canonicalJson(args)])}`;
}

/** Stable per subscription, run and state, so retries and repeat checks dedupe. */
export function eventId(subscription: string, runId: string, key: string) {
  return `evt_${digest([subscription, runId, key])}`;
}

/** The lifetime we grant: the client's suggestion within [1, 2] minutes. */
export function grantedTtl(ttlMs: number | null | undefined) {
  if (typeof ttlMs !== "number" || !Number.isFinite(ttlMs)) {
    return TTL_MAX_MS;
  }
  return Math.min(TTL_MAX_MS, Math.max(TTL_MIN_MS, Math.floor(ttlMs)));
}

/** Wraps checkout reads so each view the user's surfaces see is also checked for events. */
export function observeCheckouts(
  checkouts: Checkouts,
  onView: (view: CheckoutView) => void,
): Checkouts {
  return {
    ...checkouts,
    async get(...args: Parameters<Checkouts["get"]>) {
      const view = await checkouts.get(...args);
      onView(view);
      return view;
    },
    async list(...args: Parameters<Checkouts["list"]>) {
      const page = await checkouts.list(...args);
      for (const view of page.runs) {
        onView(view);
      }
      return page;
    },
    async create(...args: Parameters<Checkouts["create"]>) {
      const started = await checkouts.create(...args);
      if (!notStarted(started)) {
        onView(started);
      }
      return started;
    },
  };
}

const errors = {
  invalidParams: -32602,
  internal: -32603,
  notFound: -32011,
  forbidden: -32012,
  exhausted: -32013,
  unsupported: -32014,
  callback: -32015,
} as const;

const subscribeParams = z
  .object({
    name: z.string().max(200),
    arguments: z.record(z.string(), z.unknown()).nullish(),
    delivery: z
      .object({
        mode: z.string().max(50),
        url: z.string().max(4096),
        secret: z.string().max(200).optional(),
      })
      .passthrough(),
    cursor: z.string().max(1000).nullish(),
    ttlMs: z.number().nullish(),
    maxAgeMs: z.number().nullish(),
  })
  .passthrough();

const unsubscribeParams = z
  .object({
    name: z.string().max(200),
    arguments: z.record(z.string(), z.unknown()).nullish(),
    delivery: z.object({ url: z.string().max(4096) }).passthrough(),
  })
  .passthrough();

export interface CheckoutEventsOptions {
  readonly store: EventStore;
  /** Our exact public origin, for the checkout page links. */
  readonly origin: string;
  readonly transport?: WebhookTransport;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface EventRequestContext {
  /** The verified Crossmint user (Stytch user ID). Never from request params. */
  readonly userId: string;
  readonly host: AppHost | null;
  readonly checkouts: Checkouts;
  /** Keeps background work (checks, deliveries) alive after the response. */
  readonly waitUntil: (task: Promise<unknown>) => void;
}

/** Time of an ISO string in ms, or null. */
function timeOf(iso: string | null) {
  const value = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function retryable(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function createCheckoutEvents({
  store,
  origin,
  transport = publicTransport,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: CheckoutEventsOptions) {
  /** Per instance: the last state seen for a user's run, so repeated reads skip the database. */
  const observed = new Map<string, string>();
  const challenges = new Map<string, number[]>();

  function keysOf(subscription: EventSubscription) {
    const keys: Buffer[] = [];
    const current = subscription.secret
      ? signingKey(subscription.secret)
      : null;
    if (current) {
      keys.push(current);
    }
    if (
      subscription.previousSecret &&
      (subscription.previousUntil ?? 0) > now()
    ) {
      const previous = signingKey(subscription.previousSecret);
      if (previous) {
        keys.push(previous);
      }
    }
    return keys;
  }

  /** Delivers one event: "retry" leaves it pending for the next check. */
  async function deliver(
    subscription: EventSubscription,
    id: string,
    event: CheckoutEvent,
  ): Promise<"delivered" | "dropped" | "retry"> {
    const keys = keysOf(subscription);
    if (keys.length === 0) {
      // Unreadable secret (e.g. the server key changed): the next refresh carries it again.
      return "retry";
    }
    const body = JSON.stringify({
      eventId: id,
      name: event.name,
      timestamp: new Date(now()).toISOString(),
      data: event.data,
      cursor: null,
    });
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      return "dropped";
    }
    let failure: FailureReason = "connection_refused";
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 0);
      }
      try {
        const response = await postSigned({
          url: subscription.url,
          id,
          subscriptionId: subscription.id,
          body,
          keys,
          transport,
          now,
        });
        if (response.status >= 200 && response.status < 300) {
          await store.recordDelivery(subscription.id, null, now());
          console.info("MCP event delivered", {
            subscription: subscription.id,
            event: event.name,
            attempt: attempt + 1,
          });
          return "delivered";
        }
        failure = statusFailure(response.status);
        if (response.status === 410 || response.status === 413) {
          await store.recordDelivery(subscription.id, failure, now());
          return "dropped";
        }
        if (!retryable(response.status)) {
          break;
        }
      } catch (error) {
        failure =
          error instanceof WebhookError ? error.reason : "connection_refused";
      }
    }
    await store.recordDelivery(subscription.id, failure, now());
    console.warn("MCP event delivery failed", {
      subscription: subscription.id,
      event: event.name,
      reason: failure,
    });
    return "retry";
  }

  /**
   * Checks one checkout against one subscription and sends the event when its
   * state changed into one the subscription asked for. False when a delivery
   * is still pending.
   */
  async function consider(
    subscription: EventSubscription,
    view: CheckoutView,
  ): Promise<boolean> {
    const key = stateKey(view);
    const previous = subscription.seen[view.runId];
    if (previous?.k === key) {
      return true;
    }
    const event = checkoutEvent(view, origin, subscription.host);
    // A run first seen now is news only if it started after the subscription
    // (older ones were in the baseline or are history).
    const started = previous
      ? true
      : subscription.runId === null &&
        (timeOf(view.createdAt) ?? 0) >= subscription.createdAt - 60_000;
    if (event && event.name === subscription.name && started) {
      const outcome = await deliver(
        subscription,
        eventId(subscription.id, view.runId, key),
        event,
      );
      if (outcome === "retry") {
        return false;
      }
    }
    const entry = { k: key, t: Math.floor(now() / 1000) };
    const seen: Seen = { ...subscription.seen, [view.runId]: entry };
    if (Object.keys(seen).length > SEEN_LIMIT) {
      const newest = Object.entries(seen)
        .sort(([, a], [, b]) => b.t - a.t)
        .slice(0, SEEN_LIMIT);
      await store.replaceSeen(subscription.id, Object.fromEntries(newest));
    } else {
      await store.markSeen(subscription.id, { [view.runId]: entry });
    }
    return true;
  }

  /** Reads the subscription's checkouts from Crossmint and sends what changed. */
  async function sweep(subscription: EventSubscription, checkouts: Checkouts) {
    try {
      const views = subscription.runId
        ? [await checkouts.get(subscription.userId, subscription.runId)]
        : (await checkouts.list(subscription.userId, { limit: 10 })).runs;
      for (const view of views) {
        await consider(subscription, view);
      }
    } catch (error) {
      console.warn("MCP event check failed", {
        subscription: subscription.id,
        error: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  /**
   * A surface just read this checkout for the user: tell the subscriptions
   * that cover it. Never throws; cheap when nothing changed.
   */
  async function observe(userId: string, view: CheckoutView) {
    const memo = `${userId}\n${view.runId}`;
    const key = stateKey(view);
    if (observed.get(memo) === key) {
      return;
    }
    try {
      let done = true;
      for (const subscription of await store.covering(
        userId,
        view.runId,
        now(),
      )) {
        done = (await consider(subscription, view)) && done;
      }
      if (done) {
        if (observed.size > 5000) {
          observed.clear();
        }
        observed.set(memo, key);
      }
    } catch (error) {
      console.warn("MCP event observe failed", {
        error: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  function allowChallenge(userId: string) {
    const recent = (challenges.get(userId) ?? []).filter(
      (at) => now() - at < VERIFICATION_WINDOW_MS,
    );
    if (recent.length >= VERIFICATIONS_PER_WINDOW) {
      challenges.set(userId, recent);
      return false;
    }
    if (challenges.size > 5000) {
      challenges.clear();
    }
    challenges.set(userId, [...recent, now()]);
    return true;
  }

  /** The current state of the checkouts a new subscription covers: "start from now". */
  async function baseline(
    userId: string,
    runId: string | null,
    checkouts: Checkouts,
  ): Promise<Seen> {
    const at = Math.floor(now() / 1000);
    let views: CheckoutView[];
    if (runId) {
      let view: CheckoutView;
      try {
        view = await checkouts.get(userId, runId);
      } catch (error) {
        const status = (error as { status?: unknown } | null)?.status;
        if (status === 404 || status === 403 || status === 400) {
          throw new ProtocolError(
            errors.forbidden,
            "No checkout with that runId belongs to this user.",
          );
        }
        throw new ProtocolError(
          errors.internal,
          "Menta could not reach Crossmint. Try again shortly.",
        );
      }
      if (!["queued", "running", "awaiting_input"].includes(view.status)) {
        // Nothing can change any more, and a watch starts from now. This also
        // stops a client that subscribes again after its watch was ended.
        throw new ProtocolError(
          errors.forbidden,
          "That checkout has ended, so there is nothing left to watch.",
          { reason: "checkout_ended" },
        );
      }
      views = [view];
    } else {
      views = await checkouts
        .list(userId, { limit: 10 })
        .then((page) => page.runs)
        .catch(() => []);
    }
    return Object.fromEntries(
      views.map((view) => [view.runId, { k: stateKey(view), t: at }]),
    );
  }

  async function subscribe(
    params: z.infer<typeof subscribeParams>,
    { userId, host, checkouts, waitUntil }: EventRequestContext,
  ) {
    const definition = eventDefinitions.find(
      (item) => item.name === params.name,
    );
    if (!definition) {
      throw new ProtocolError(errors.notFound, "Unknown event.", {
        kind: "event",
      });
    }
    if (params.delivery.mode !== "webhook") {
      throw new ProtocolError(
        errors.unsupported,
        "Only webhook delivery is supported.",
        { feature: "deliveryMode", value: params.delivery.mode },
      );
    }
    const args = filterArguments.safeParse(params.arguments ?? {});
    if (!args.success) {
      throw new ProtocolError(
        errors.invalidParams,
        "arguments may only contain runId (a string).",
      );
    }
    const url = params.delivery.url;
    const problem = callbackProblem(url);
    if (problem) {
      throw new ProtocolError(errors.invalidParams, problem);
    }
    const secret = params.delivery.secret ?? "";
    const key = signingKey(secret);
    if (!key) {
      throw new ProtocolError(
        errors.invalidParams,
        "delivery.secret must be whsec_ followed by base64 of 24 to 64 bytes.",
      );
    }
    const id = subscriptionId(userId, url, definition.name, args.data);
    const existing = await store.get(id);
    if (existing && existing.userId !== userId) {
      throw new ProtocolError(errors.forbidden, "Not your subscription.");
    }
    const at = now();
    if (!existing && (await store.count(userId, at)) >= MAX_SUBSCRIPTIONS) {
      throw new ProtocolError(
        errors.exhausted,
        "Too many event subscriptions.",
        { limit: "subscriptions", max: MAX_SUBSCRIPTIONS },
      );
    }
    if (existing?.runId && endedLongAgo(existing.seen[existing.runId], at)) {
      // Watching one checkout that ended (and was reported) a while ago: end
      // the watch instead of reading Crossmint every refresh forever. ChatGPT
      // supports no `terminated` envelope, so refusing the refresh is the
      // signal (the spec's answer to a refresh whose cause still applies).
      await store.remove(userId, id);
      console.info("MCP event subscription ended", {
        subscription: id,
        reason: "checkout_ended",
      });
      throw new ProtocolError(
        errors.forbidden,
        "That checkout has ended, so there is nothing left to watch.",
        { reason: "checkout_ended" },
      );
    }
    const seen = existing
      ? existing.seen
      : await baseline(userId, args.data.runId ?? null, checkouts);

    // Prove the callback wants our deliveries before sending it anything else.
    let verifiedAt =
      existing && at - existing.verifiedAt < VERIFIED_FOR_MS
        ? existing.verifiedAt
        : await store.verifiedAt(userId, url);
    if (verifiedAt === null || at - verifiedAt >= VERIFIED_FOR_MS) {
      if (!allowChallenge(userId)) {
        throw new ProtocolError(
          errors.exhausted,
          "Too many callback verifications. Try again later.",
          { limit: "verifications" },
        );
      }
      try {
        await verifyCallback({
          url,
          subscriptionId: id,
          keys: [key],
          transport,
          now,
        });
      } catch (error) {
        const reason =
          error instanceof WebhookError ? error.reason : "connection_refused";
        console.warn("MCP event callback failed verification", {
          subscription: id,
          reason,
        });
        throw new ProtocolError(
          errors.callback,
          "The callback endpoint failed verification.",
          { reason },
        );
      }
      verifiedAt = now();
    }

    // A new secret on refresh: keep signing with the old one for a short while too.
    let rotated: Pick<EventSubscription, "previousSecret" | "previousUntil"> = {
      previousSecret: null,
      previousUntil: null,
    };
    if (existing?.secret && existing.secret !== secret) {
      rotated = {
        previousSecret: existing.secret,
        previousUntil: at + ROTATION_MS,
      };
    } else if (existing?.previousSecret && (existing.previousUntil ?? 0) > at) {
      rotated = {
        previousSecret: existing.previousSecret,
        previousUntil: existing.previousUntil,
      };
    }
    const expiresAt = at + grantedTtl(params.ttlMs);
    await store.save({
      id,
      userId,
      name: definition.name,
      runId: args.data.runId ?? null,
      url,
      host,
      secret,
      ...rotated,
      expiresAt,
      createdAt: existing?.createdAt ?? at,
      verifiedAt,
      seen,
    });
    console.info("MCP event subscription", {
      subscription: id,
      event: definition.name,
      runFilter: Boolean(args.data.runId),
      refresh: Boolean(existing),
      host: new URL(url).hostname,
    });
    if (existing) {
      // The refresh is the clock: look for changes since the last check.
      const current = await store.get(id);
      if (current) {
        waitUntil(sweep(current, checkouts));
      }
    } else {
      waitUntil(store.purge(at - VERIFIED_FOR_MS).catch(() => {}));
    }
    return {
      id,
      refreshBefore: new Date(expiresAt).toISOString(),
      cursor: null,
      truncated: false,
      ...(existing
        ? {
            deliveryStatus: {
              active: true,
              lastDeliveryAt: existing.lastDeliveryAt
                ? new Date(existing.lastDeliveryAt).toISOString()
                : null,
              lastError: existing.lastError,
              ...(existing.failedSince
                ? { failedSince: new Date(existing.failedSince).toISOString() }
                : {}),
            },
          }
        : {}),
    };
  }

  /** Adds the `events` capability and its three methods to one request's server. */
  function register(server: McpServer, context: EventRequestContext) {
    // `events` isn't in the SDK's capability type yet (MCP Events is an extension).
    server.server.registerCapabilities({ events: {} } as Parameters<
      typeof server.server.registerCapabilities
    >[0]);
    server.server.setRequestHandler(
      "events/list",
      {
        params: z
          .object({ cursor: z.string().max(1000).optional() })
          .passthrough()
          .optional(),
      },
      () => ({ events: eventDefinitions as unknown as unknown[] }),
    );
    server.server.setRequestHandler(
      "events/subscribe",
      { params: subscribeParams },
      (params) => subscribe(params, context),
    );
    server.server.setRequestHandler(
      "events/unsubscribe",
      { params: unsubscribeParams },
      async (params) => {
        const args = filterArguments.safeParse(params.arguments ?? {});
        if (args.success) {
          await store.remove(
            context.userId,
            subscriptionId(
              context.userId,
              params.delivery.url,
              params.name,
              args.data,
            ),
          );
        }
        return {};
      },
    );
  }

  return { register, observe, sweep };
}

export type CheckoutEvents = ReturnType<typeof createCheckoutEvents>;

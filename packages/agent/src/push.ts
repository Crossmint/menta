import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";
import { asksForSecret } from "@oca/crossmint-agent-checkouts/secret-fields";
import webpush from "web-push";
import { z } from "zod";
import { webOrigin } from "./env.js";
import { createSecretBox } from "./mcp/event-store.js";
/** Only browser push services may be called; the endpoint is a capability URL. */
export function pushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname === "web.push.apple.com" ||
        url.hostname.endsWith(".push.services.mozilla.com") ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}

const base64url = /^[A-Za-z0-9_-]+$/;
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(4096).refine(pushEndpoint),
  keys: z.object({
    p256dh: z
      .string()
      .length(87)
      .regex(base64url)
      .refine((v) => Buffer.from(v, "base64url")[0] === 4),
    auth: z.string().length(22).regex(base64url),
  }),
});
export type BrowserPushSubscription = z.infer<typeof pushSubscriptionSchema>;

export interface PushMessage {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly tag: string;
  readonly expiresAt: number;
}

/** Merchant and field categories only: never copy free-form questions, tasks or private values. */
function notificationStore(view: CheckoutView) {
  if (view.pending?.kind === "payment") {
    const name = view.pending.merchant.name.trim();
    if (/^[\p{L}\p{N}&.'’(), -]{1,64}$/u.test(name)) {
      return name;
    }
  }
  try {
    const url = new URL(view.startUrl);
    if (["https:", "http:"].includes(url.protocol)) {
      return url.hostname.replace(/^www\./, "");
    }
  } catch {
    /* A missing or malformed store URL gets the generic fallback. */
  }
  return "The store";
}

const questionTopics: readonly [RegExp, string][] = [
  [/^(drink|beverage|cup) size$/, "drink size"],
  [/^(item|clothing|shoe)? ?size$/, "size"],
  [/^(item|product)? ?colou?r$/, "color"],
  [/^(item)? ?quantity$/, "quantity"],
  [/^(milk|milk type|milk choice)$/, "milk choice"],
  [/^(recipe|recipe choice|customization|customizations)$/, "recipe choice"],
  [/^(flavou?r|flavou?r choice)$/, "flavor choice"],
  [
    /^(substitution|substitutions|substitution preference)$/,
    "substitution preference",
  ],
  [
    /^(fulfillment|fulfillment method|delivery method|shipping method)$/,
    "delivery method",
  ],
  [/^(pickup time|pick up time)$/, "pickup time"],
  [/^(delivery time|delivery window)$/, "delivery time"],
];

function questionTopic(
  pending: Extract<NonNullable<CheckoutView["pending"]>, { kind: "question" }>,
) {
  if (!pending.fields.length || pending.fields.length > 3) {
    return null;
  }
  const topics = pending.fields.map((field) => {
    const label = field.label
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
    return questionTopics.find(([pattern]) => pattern.test(label))?.[1];
  });
  if (topics.some((topic) => !topic)) {
    return null;
  }
  return [...new Set(topics)].join(" and ");
}

/** An assistant host that started a checkout over MCP, as the secure page's `via` names it. */
export type AssistantHost = "chatgpt" | "claude" | "grok";

/**
 * Where a checkout's notification opens: the Menta conversation that started
 * it (its session ID), or for a checkout an assistant host started over MCP,
 * the checkout's own secure page, where the user answers or approves.
 */
export type PushTarget = string | { readonly via: AssistantHost | null };

function pushUrl(view: CheckoutView, target: PushTarget) {
  if (typeof target === "string") {
    return `/c/${encodeURIComponent(target)}`;
  }
  const page = `/checkouts/${encodeURIComponent(view.runId)}`;
  return target.via ? `${page}?via=${target.via}` : page;
}

export function checkoutPush(
  view: CheckoutView,
  target: PushTarget,
  now = Date.now(),
): PushMessage | null {
  const store = notificationStore(view);
  let body: string;
  if (
    view.result?.failureReason === "reconciliation_required" ||
    view.result?.blockedCode === "reconciliation_required"
  ) {
    body = `${store} couldn't confirm your order. Open Menta before buying again.`;
  } else if (view.status === "awaiting_input" && view.pending) {
    const pending = view.pending;
    if (pending.kind === "payment") {
      body = `Your order at ${store} is ready for payment approval.`;
    } else if (
      pending.kind === "protected" ||
      asksForSecret(pending.question) ||
      pending.fields.some(
        (field) => field.sensitive || asksForSecret(field.label),
      )
    ) {
      body = `${store} needs private details. Open Menta to continue securely.`;
    } else {
      const topic = questionTopic(pending);
      body = topic
        ? `${store} needs your ${topic}.`
        : `${store} has a question about your order.`;
    }
  } else if (view.status === "succeeded") {
    body = `${store} confirmed your order.`;
  } else if (
    ["blocked", "failed", "reconciliation_required"].includes(view.status)
  ) {
    body = `${store} checkout stopped. Open Menta to see what happened.`;
  } else {
    return null;
  }
  const pendingExpiry = view.pending?.expiresAt
    ? Date.parse(view.pending.expiresAt)
    : Number.NaN;
  const expiresAt = view.pending
    ? Math.min(
        now + 5 * 60_000,
        Number.isFinite(pendingExpiry) ? pendingExpiry : Infinity,
      )
    : now + 24 * 60 * 60_000;
  if (expiresAt <= now) {
    return null;
  }
  return {
    title: "Menta",
    body,
    url: pushUrl(view, target),
    tag: `oca-${view.runId}`,
    expiresAt,
  };
}

export interface PushDevice {
  readonly id: string;
  readonly subscription: BrowserPushSubscription;
}
/** What the shared delivery loop needs from a device store: each device gets each checkout state once. */
export interface DeliveryStore<Device extends { readonly id: string }> {
  devices(userId: string): Promise<Device[]>;
  remove(userId: string, id: string): Promise<void>;
  claim(
    userId: string,
    id: string,
    runId: string,
    key: string,
  ): Promise<boolean>;
  finish(
    id: string,
    runId: string,
    key: string,
    delivered: boolean,
  ): Promise<void>;
}
export interface PushStore extends DeliveryStore<PushDevice> {
  save(
    userId: string,
    subscription: BrowserPushSubscription,
    replaces?: string,
  ): Promise<string>;
  enrollment(
    userId: string,
    id: string,
  ): Promise<{ id: string; endpointHash: string } | null>;
  has(userId: string, id: string): Promise<boolean>;
}
type Query = (
  sql: string,
  args: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

type Statement = { sql: string; args: readonly unknown[] };
type Transaction = (
  statements: Statement[],
) => Promise<Record<string, unknown>[][]>;

export function createSqlPushStore(
  query: Query,
  secret: string,
  transaction: Transaction,
): PushStore {
  const box = createSecretBox(secret, "web-push-subscriptions-v1");
  return {
    async save(userId, subscription, replaces) {
      const hash = createHash("sha256")
        .update(subscription.endpoint)
        .digest("hex");
      // Separate statements under the lock give concurrent enrollments a fresh committed count.
      const results = await transaction([
        {
          sql: "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          args: [userId],
        },
        {
          sql: `INSERT INTO web_push_subscriptions (id, user_id, endpoint_hash, subscription_sealed)
        SELECT $1, $2, $3, $4 WHERE
          (SELECT count(*) FROM web_push_subscriptions WHERE user_id = $2) < 20
          OR EXISTS (SELECT 1 FROM web_push_subscriptions WHERE user_id = $2 AND (endpoint_hash = $3 OR id = $5::uuid))
        ON CONFLICT (endpoint_hash) DO UPDATE SET
          user_id = EXCLUDED.user_id, subscription_sealed = EXCLUDED.subscription_sealed, updated_at = now()
        RETURNING id`,
          args: [
            randomUUID(),
            userId,
            hash,
            box.seal(JSON.stringify(subscription)),
            replaces ?? null,
          ],
        },
        {
          sql: "DELETE FROM web_push_subscriptions WHERE user_id = $1 AND id = $2::uuid AND endpoint_hash <> $3 AND EXISTS (SELECT 1 FROM web_push_subscriptions WHERE user_id = $1 AND endpoint_hash = $3)",
          args: [userId, replaces ?? null, hash],
        },
      ]);
      const rows = results[1] ?? [];
      if (!rows[0]) {
        throw new Error("Too many notification devices.");
      }
      return String(rows[0].id);
    },
    async enrollment(userId, id) {
      const rows = await query(
        "SELECT id, endpoint_hash FROM web_push_subscriptions WHERE user_id = $1 AND id = $2",
        [userId, id],
      );
      return rows[0]
        ? {
            id: String(rows[0].id),
            endpointHash: String(rows[0].endpoint_hash),
          }
        : null;
    },
    async has(userId, id) {
      return (
        (
          await query(
            "SELECT id FROM web_push_subscriptions WHERE user_id = $1 AND id = $2",
            [userId, id],
          )
        ).length > 0
      );
    },
    async devices(userId) {
      const rows = await query(
        `WITH pruned AS (DELETE FROM web_push_deliveries WHERE subscription_id IN
        (SELECT id FROM web_push_subscriptions WHERE user_id = $1) AND claimed_at < now() - interval '7 days')
        SELECT id, subscription_sealed FROM web_push_subscriptions WHERE user_id = $1 LIMIT 20`,
        [userId],
      );
      return rows.flatMap((row) => {
        const plain = box.open(String(row.subscription_sealed));
        try {
          const parsed = pushSubscriptionSchema.safeParse(
            plain ? JSON.parse(plain) : null,
          );
          return parsed.success
            ? [{ id: String(row.id), subscription: parsed.data }]
            : [];
        } catch {
          return [];
        }
      });
    },
    async remove(userId, id) {
      await query(
        "DELETE FROM web_push_subscriptions WHERE user_id = $1 AND id = $2",
        [userId, id],
      );
    },
    async claim(userId, id, runId, key) {
      const rows = await query(
        `INSERT INTO web_push_deliveries (subscription_id, run_id, state_key)
        SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM web_push_subscriptions WHERE id = $1 AND user_id = $4)
        ON CONFLICT (subscription_id, run_id, state_key) DO UPDATE SET claimed_at = now()
        WHERE NOT web_push_deliveries.delivered AND web_push_deliveries.claimed_at < now() - interval '2 minutes'
        RETURNING subscription_id`,
        [id, runId, key, userId],
      );
      return rows.length > 0;
    },
    async finish(id, runId, key, delivered) {
      if (delivered) {
        await query(
          "UPDATE web_push_deliveries SET delivered = true WHERE subscription_id = $1 AND run_id = $2 AND state_key = $3",
          [id, runId, key],
        );
      } else {
        await query(
          "DELETE FROM web_push_deliveries WHERE subscription_id = $1 AND run_id = $2 AND state_key = $3 AND NOT delivered",
          [id, runId, key],
        );
      }
    },
  };
}

/**
 * Sends a checkout state to each of the user's devices once, across retries
 * and restarts. `send` throws `{ statusCode }`: 404/410 remove the device,
 * 429 and 5xx get one retry, and send failures never escape so the checkout
 * still reaches the agent.
 */
export async function deliver<Device extends { readonly id: string }>(
  store: DeliveryStore<Device>,
  send: (device: Device) => Promise<unknown>,
  userId: string,
  view: CheckoutView,
) {
  const key = `${view.status}:${view.pending?.requestId ?? ""}`;
  await Promise.all(
    (await store.devices(userId)).map(async (device) => {
      if (!(await store.claim(userId, device.id, view.runId, key))) {
        return;
      }
      let delivered = false;
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await send(device);
            delivered = true;
            break;
          } catch (error) {
            const status = Number(
              (error as { statusCode?: number })?.statusCode,
            );
            if (status === 404 || status === 410) {
              await store.remove(userId, device.id);
              break;
            }
            if (
              attempt === 1 ||
              (status >= 400 && status < 500 && status !== 429)
            ) {
              break;
            }
            await new Promise((resolve) =>
              setTimeout(resolve, 250 * (attempt + 1)),
            );
          }
        }
      } finally {
        await store.finish(device.id, view.runId, key, delivered);
      }
    }),
  );
}

type Send = (
  subscription: BrowserPushSubscription,
  message: PushMessage,
) => Promise<unknown>;
export function createWebPush(store: PushStore, send: Send) {
  return {
    store,
    async test(userId: string, id: string) {
      const device = (await store.devices(userId)).find(
        (item) => item.id === id,
      );
      if (!device) {
        throw new Error("Enable notifications on this browser first.");
      }
      await send(device.subscription, {
        title: "Menta",
        body: "Notifications are on. We'll tell you when a checkout needs you or finishes.",
        url: "/settings#notifications",
        tag: `oca-test-${randomUUID()}`,
        expiresAt: Date.now() + 60_000,
      });
    },
    async observe(userId: string, view: CheckoutView, target: PushTarget) {
      const message = checkoutPush(view, target);
      if (!message) {
        return;
      }
      await deliver(
        store,
        (device) => send(device.subscription, message),
        userId,
        view,
      );
    },
  };
}

/**
 * The VAPID contact push services see: this deployment's origin when it is
 * https. Apple's push service rejects localhost and plain http subjects, so
 * local development (and a missing OCA_WEB_ORIGIN) falls back to the public
 * source repository, which is a valid https contact on any machine.
 */
function pushSubject() {
  try {
    const origin = webOrigin();
    if (origin.startsWith("https://")) {
      return origin;
    }
  } catch {
    // Unset or not a URL; use the fallback.
  }
  return "https://github.com/Crossmint/oca";
}

let service: ReturnType<typeof createWebPush> | undefined;
export function getWebPush() {
  const {
    DATABASE_URL,
    STYTCH_SECRET,
    OCA_PUSH_PUBLIC_KEY,
    OCA_PUSH_PRIVATE_KEY,
  } = process.env;
  if (
    !DATABASE_URL ||
    !STYTCH_SECRET ||
    !OCA_PUSH_PUBLIC_KEY ||
    !OCA_PUSH_PRIVATE_KEY
  ) {
    return null;
  }
  if (!service) {
    const sql = neon(DATABASE_URL);
    const subject = pushSubject();
    service = createWebPush(
      createSqlPushStore(
        (text, args) => sql.query(text, [...args]),
        STYTCH_SECRET,
        (statements) =>
          sql.transaction(
            statements.map(({ sql: text, args }) => sql.query(text, [...args])),
          ),
      ),
      (subscription, message) =>
        webpush.sendNotification(subscription, JSON.stringify(message), {
          vapidDetails: {
            subject,
            publicKey: OCA_PUSH_PUBLIC_KEY,
            privateKey: OCA_PUSH_PRIVATE_KEY,
          },
          TTL: Math.max(0, Math.ceil((message.expiresAt - Date.now()) / 1000)),
          urgency: "high",
          timeout: 1500,
          topic: createHash("sha256")
            .update(message.tag)
            .digest("base64url")
            .slice(0, 32),
        }),
    );
  }
  return service;
}

/** Checkout notifications, when web push is configured. */
export function getCheckoutPush() {
  return getWebPush();
}

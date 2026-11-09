/**
 * Asking the user to approve a spending limit: the model describes it, the
 * user approves it on Menta's request page (`/spending-limit/<token>`) in
 * Crossmint's own UI. The link carries the request sealed for this user.
 */

import type { McpServer } from "@modelcontextprotocol/server";
import {
  type Checkouts,
  type CheckoutView,
  notStarted,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { z } from "zod";
import type { LimitPayments } from "../limit-payments.js";
import {
  LIMIT_REQUEST_DESCRIPTION,
  type LimitRequest,
  limitRequestInput,
  limitRequestResult,
  requestAmount,
  sealLimitRequest,
  shortOfPayment,
} from "../limit-requests.js";
import { toolStatusMeta } from "./card.js";
import { result, SHOW_TOOL } from "./moments.js";
import { failure, run } from "./shared.js";

export const LIMIT_REQUEST_TOOL = "request_spending_limit";

export interface LimitToolsOptions {
  readonly userId: string;
  readonly checkouts: Checkouts;
  readonly origin: string;
  /** Which assistant asks, for the page's "Claude asks…" line. */
  readonly via: string | null;
  /** The sealing key (limitRequestKey); without it there is no tool. */
  readonly key: Buffer;
}

export function registerLimitTools(
  server: McpServer,
  { userId, checkouts, origin, via, key }: LimitToolsOptions,
) {
  server.registerTool(
    LIMIT_REQUEST_TOOL,
    {
      title: "Ask for a spending limit",
      description: LIMIT_REQUEST_DESCRIPTION,
      inputSchema: limitRequestInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: toolStatusMeta("Preparing the request…", "Ready to approve"),
    },
    (input) =>
      run(async () => {
        let paying: CheckoutView | null = null;
        if (input.runId) {
          // Only the user's own checkout; the page pays it only if it's still waiting.
          const view = await checkouts
            .get(userId, input.runId)
            .catch(() => null);
          if (!view) {
            return failure(
              "Couldn't read a checkout with that runId. Check the runId, or try again in a moment.",
            );
          }
          if (view.pending?.kind === "payment") {
            const short = shortOfPayment(input, view.pending);
            if (short) {
              return failure(short);
            }
            paying = view;
          }
        }
        const token = sealLimitRequest(key, userId, {
          ...input,
          ...(via ? { via } : {}),
        });
        // Still following the checkout: the payment step's next said so.
        const then =
          paying?.pending?.kind === "payment"
            ? `Then call continue with runId "${paying.runId}" and afterRequestId "${paying.pending.requestId}".`
            : "";
        return result(limitRequestResult(origin, token, then));
      }),
  );
}

/**
 * The spending limit a checkout's payment step asks for: its amount and
 * currency, its store, for a week, named after the store. The user can
 * change any of it on the page before approving.
 */
export function paymentLimitRequest(
  view: CheckoutView,
  via: string | null,
): LimitRequest | null {
  const pending = view.pending;
  if (pending?.kind !== "payment") {
    return null;
  }
  const amount = requestAmount(pending.amount.amount);
  const currency = pending.amount.currency.trim().toUpperCase();
  if (!amount || !/^[A-Z]{3}$/.test(currency)) {
    return null;
  }
  let store: string | undefined;
  try {
    store = new URL(pending.merchant.url).hostname.replace(/^www\./, "");
  } catch {
    store = view.store || undefined;
  }
  const merchant = pending.merchant.name.trim() || store || view.store;
  return {
    name: `${merchant} order`.slice(0, 255),
    amount,
    currency,
    expires: "week",
    ...(store ? { store: store.slice(0, 200) } : {}),
    runId: view.runId,
    ...(via ? { via } : {}),
  };
}

/**
 * Checkouts whose payment steps link to the spending limit request page
 * instead of the secure page: the same step in the new approval design, and
 * approving it pays the checkout. Questions and private details keep the
 * secure page, which handles them.
 */
export function linkPaymentsToLimits(
  checkouts: Checkouts,
  {
    userId,
    origin,
    via,
    key,
  }: Pick<LimitToolsOptions, "userId" | "origin" | "via" | "key">,
): Checkouts {
  const link = (view: CheckoutView): CheckoutView => {
    const request = paymentLimitRequest(view, via);
    if (!request || view.pending?.kind !== "payment") {
      return view;
    }
    const { url } = limitRequestResult(
      origin,
      sealLimitRequest(key, userId, request),
    );
    return { ...view, pending: { ...view.pending, actionUrl: url } };
  };
  return {
    ...checkouts,
    async get(...args: Parameters<Checkouts["get"]>) {
      return link(await checkouts.get(...args));
    },
    async list(...args: Parameters<Checkouts["list"]>) {
      const page = await checkouts.list(...args);
      return { ...page, runs: page.runs.map(link) };
    },
    async create(...args: Parameters<Checkouts["create"]>) {
      const started = await checkouts.create(...args);
      return notStarted(started) ? started : link(started);
    },
  };
}

export const LIMITS_TOOL = "spending_limits";
export const PAY_TOOL = "pay_with_spending_limit";

/**
 * The user's spending limits, and paying a checkout's open payment with the
 * one the assistant picks for what the purchase is for. Menta checks the pick
 * (the user's, active, covers the payment) before answering Crossmint; the
 * assistant never creates, approves or raises a limit.
 */
export function registerLimitPayTools(
  server: McpServer,
  {
    userId,
    payments,
    cards = false,
  }: {
    userId: string;
    payments: LimitPayments;
    /** The client draws the Menta card: a new limit is approved there. */
    cards?: boolean;
  },
) {
  // With the card, the user approves this payment's limit in it (as the
  // checkout's next says), drawn once; otherwise the model asks for one by link.
  const noneFits = cards
    ? `call ${SHOW_TOOL} with the checkout's runId: the user approves one in the Menta card (if the card already shows this payment, don't call it again; tell the user none of their spending limits covers it, so they approve one there)`
    : `call ${LIMIT_REQUEST_TOOL}`;
  server.registerTool(
    LIMITS_TOOL,
    {
      title: "Spending limits",
      description:
        "The user's spending limits that can pay now: each one's id, the name they approved it with, what's left, the one store it's for (null for any store) and when it expires. Read them when a checkout is ready to pay, to pick the one that fits what the purchase is for.",
      inputSchema: z.strictObject({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: toolStatusMeta(
        "Checking your spending limits…",
        "Spending limits",
      ),
    },
    () =>
      run(async () => {
        const limits = await payments.list(userId);
        if (!limits) {
          return failure(
            "Couldn't read the user's spending limits. Try again.",
          );
        }
        return result({
          limits,
          next: limits.length
            ? `Pick the one whose name fits what this purchase is for, in this currency, with enough left, for any store or this one, and call pay_with_spending_limit. If none fits, ${noneFits}.`
            : cards
              ? `The user has none. If a checkout is ready to pay, ${noneFits}.`
              : `The user has none. Call ${LIMIT_REQUEST_TOOL} to ask for one.`,
        });
      }),
  );

  server.registerTool(
    PAY_TOOL,
    {
      title: "Pay with a spending limit",
      description: `Pay a checkout's open payment with one of the user's spending limits (an id from spending_limits): pick the one that fits what this purchase is for. Menta checks it's the user's and covers the payment (currency, amount left, store) before paying, and refuses otherwise; it never pays twice. You can't create, approve or raise a limit; if none fits, ${noneFits}.`,
      inputSchema: z.strictObject({
        runId: z.string().min(1).max(200).describe("The checkout's runId."),
        limitId: z
          .string()
          .min(1)
          .max(200)
          .describe("The spending limit's id, from spending_limits."),
      }),
      annotations: {
        readOnlyHint: false,
        // A payment can't be undone.
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: toolStatusMeta("Paying from your spending limit…", "Paid"),
    },
    ({ runId, limitId }) =>
      run(async () => {
        const outcome = await payments.pay(userId, runId, limitId);
        if ("problem" in outcome) {
          // Its "or call request_spending_limit" is the card-less way.
          return failure(
            outcome.problem.replace(`call ${LIMIT_REQUEST_TOOL}`, noneFits),
          );
        }
        // Crossmint can still show the payment open for a moment: follow past it.
        const follow = (requestId: string) =>
          `call continue with runId "${runId}" and afterRequestId "${requestId}"`;
        if ("answered" in outcome) {
          return failure(
            `This payment was already answered. Don't pay it again: ${follow(outcome.answered)} to follow the checkout.`,
          );
        }
        const { paid } = outcome;
        return result({
          paid,
          next: `Paid ${paid.amount.exact ? "" : "up to "}${paid.amount.amount} ${paid.amount.currency} from the user's "${paid.limit}" spending limit (${paid.amount.exact ? "" : "at least "}${paid.left.amount} ${paid.left.currency} left). Tell them in one short line, then ${follow(outcome.requestId)} to follow the order. If the checkout then fails or the order is cancelled, that amount still counts as used on the limit, and refunds and cancelled payments are handled by the store without updating it: tell them so.`,
        });
      }),
  );
}

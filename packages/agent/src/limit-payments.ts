import type {
  CheckoutPending,
  Checkouts,
  PaidFrom,
} from "@oca/crossmint-agent-checkouts/checkouts";
import type { MintCardCredentials } from "./mcp/secure.js";
import { messageId } from "./mcp/shared.js";
import { listOrderIntents, type OrderIntentView } from "./order-intents.js";

/**
 * Paying a checkout from a spending limit the user already approved, when
 * their assistant picks it. Spending limits are Crossmint order intents: the
 * user approves one, in Crossmint's UI, for an amount on one of their cards,
 * and it can pay several checkouts until it runs out or expires. The
 * assistant reads the user's limits and names the one that fits what the
 * purchase is for; Menta pays with it only if it's the user's, active and
 * covers the payment under Crossmint's rule. Nothing here creates, approves
 * or raises a limit, and no card detail reaches the assistant.
 */

type Payment = Extract<CheckoutPending, { kind: "payment" }>;

/**
 * The one message ID for answering a payment request, whoever answers it:
 * the user in the dock, card, secure page or request page, or their
 * assistant. Crossmint refuses an ID it has seen with a different body, so a
 * payment request can only ever be answered with one spending limit.
 */
export function paymentMessageId(
  userId: string,
  runId: string,
  requestId: string,
) {
  return messageId([userId, runId, requestId, "payment"]);
}

/** A plain decimal amount ("31.20"); anything else never matches. */
const DECIMAL = /^\d+(?:\.\d+)?$/;

/** A limit that can pay now: active, unexpired, with its card ready. */
function usable(limit: OrderIntentView, now: number) {
  return (
    limit.status === "active" &&
    Date.parse(limit.expiresAt) > now &&
    limit.cardReady &&
    DECIMAL.test(limit.amount.available) &&
    Number(limit.amount.available) > 0
  );
}

/** Crossmint's rule for reusing an order intent, plus a card that can pay now. */
export function covers(
  limit: OrderIntentView,
  payment: Pick<Payment, "amount" | "merchant">,
  now: number,
) {
  return (
    usable(limit, now) &&
    limit.amount.currency.toUpperCase() ===
      payment.amount.currency.toUpperCase() &&
    DECIMAL.test(payment.amount.amount) &&
    Number(limit.amount.available) >= Number(payment.amount.amount) &&
    (storeOf(limit) === null ||
      sameStore(storeOf(limit) ?? "", payment.merchant.url))
  );
}

/** The store a limit was made for; null when it pays at any store. */
function storeOf(limit: OrderIntentView) {
  return limit.merchant?.url ?? null;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function sameStore(a: string, b: string) {
  return hostOf(a) === hostOf(b);
}

function minus(available: string, amount: string) {
  return (Number(available) - Number(amount)).toFixed(2);
}

/** A spending limit as the assistant sees it: never a card number, token or card ID. */
export interface LimitChoice {
  /** What to pass to pay_with_spending_limit. */
  readonly id: string;
  /** The name the user approved it with ("Groceries"). */
  readonly name: string;
  readonly left: { readonly amount: string; readonly currency: string };
  readonly total: { readonly amount: string; readonly currency: string };
  /** The one store it pays at ("ubereats.com"); null for any store. */
  readonly store: string | null;
  readonly expiresAt: string;
}

export function limitChoice(limit: OrderIntentView): LimitChoice {
  const store = storeOf(limit);
  return {
    id: limit.orderIntentId,
    name: limit.description.trim() || "Spending limit",
    left: { amount: limit.amount.available, currency: limit.amount.currency },
    total: { amount: limit.amount.total, currency: limit.amount.currency },
    store: store ? hostOf(store) : null,
    expiresAt: limit.expiresAt,
  };
}

export interface LimitPaymentsOptions {
  /** Checkouts as the user reads them (never a wrapper that pays). */
  readonly checkouts: Checkouts;
  /** A short Stytch session for the user, which Crossmint's order-intent API trusts. */
  readonly mint: MintCardCredentials;
  /** Our web origin: client keys only answer origins they allow. */
  readonly origin: string;
  readonly now?: () => number;
  readonly fetch?: typeof fetch;
}

/**
 * Paid (with the payment's requestId, to follow the checkout past it while
 * Crossmint catches up), already answered by someone (that requestId), or
 * refused with a reason for the assistant.
 */
export type PayOutcome =
  | { readonly paid: PaidFrom; readonly requestId: string }
  | { readonly answered: string }
  | { readonly problem: string };

/**
 * The user's spending limits for their assistant, and paying an open
 * payment with the one it picks. Each call mints a short session for the
 * user, server-side; the assistant only ever sees `LimitChoice`s.
 */
export function createLimitPayments(options: LimitPaymentsOptions) {
  const now = options.now ?? Date.now;
  const read = async (userId: string) => {
    const credentials = await options.mint(userId);
    if (!credentials) {
      return null;
    }
    return listOrderIntents({
      apiKey: credentials.apiKey,
      jwt: credentials.jwt,
      origin: options.origin,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  };
  return {
    /** The limits that can pay now; null when Crossmint couldn't be read. */
    async list(userId: string): Promise<LimitChoice[] | null> {
      const limits = await read(userId);
      return limits
        ? limits.filter((limit) => usable(limit, now())).map(limitChoice)
        : null;
    },

    /**
     * Pays the checkout's open payment with the limit the assistant
     * picked, after checking it's the user's and covers the payment. A
     * payment already answered (by the user, or an earlier call) is never
     * answered again.
     */
    async pay(
      userId: string,
      runId: string,
      limitId: string,
    ): Promise<PayOutcome> {
      const view = await options.checkouts.get(userId, runId);
      const payment = view.pending;
      if (payment?.kind !== "payment") {
        return { problem: "No payment is waiting on that checkout." };
      }
      // Answered first: a payment the user or an earlier call already paid
      // (Crossmint can still show it open) is never refused as not covered.
      const answered = await options.checkouts
        .answer(userId, runId, payment.requestId)
        .catch(() => "unknown" as const);
      if (answered === "unknown") {
        // Never paid without knowing; nothing was answered, so try again.
        return {
          problem:
            "Couldn't check whether this payment was already answered, so it wasn't paid. Try again in a moment.",
        };
      }
      if (answered) {
        return { answered: payment.requestId };
      }
      const limits = await read(userId);
      if (!limits) {
        return {
          problem: "Couldn't read the user's spending limits. Try again.",
        };
      }
      const limit = limits.find((item) => item.orderIntentId === limitId);
      if (!limit) {
        return {
          problem:
            "That isn't one of the user's spending limits. Call spending_limits for their ids.",
        };
      }
      if (!covers(limit, payment, now())) {
        return {
          problem: `"${limitChoice(limit).name}" can't pay ${payment.amount.amount} ${payment.amount.currency} at ${hostOf(payment.merchant.url)}: it must be active, in that currency, have enough left and be for any store or that one. Pick another, or call request_spending_limit.`,
        };
      }
      await options.checkouts.respond(
        userId,
        runId,
        paymentMessageId(userId, runId, payment.requestId),
        { requestId: payment.requestId, orderIntentId: limit.orderIntentId },
      );
      const { currency, exact } = payment.amount;
      return {
        requestId: payment.requestId,
        paid: {
          limit: limitChoice(limit).name,
          amount: { amount: payment.amount.amount, currency, exact },
          left: {
            amount: minus(limit.amount.available, payment.amount.amount),
            currency,
          },
        },
      };
    },
  };
}

export type LimitPayments = ReturnType<typeof createLimitPayments>;

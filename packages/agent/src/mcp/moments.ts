import {
  type CheckoutView,
  forModel,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { requestAmount } from "../limit-requests.js";
import { CARD_STEP, OBSERVED_AT, PROGRESS, SECURE_STEP } from "./card.js";
import { type FormSupport, noForms } from "./forms.js";
import type { AppHost } from "./hosts.js";

/**
 * A moment is when the assistant has something to tell the user: the store
 * needs them (a question, private details, a payment to approve), or the
 * checkout ended. `start`, `answer` and `continue` wait for one and return
 * with it, so the assistant's turn ends there with one message, which is
 * what makes the host notify the user. Between moments it stays quiet.
 */

/** Who sent the user to the secure page (its `via`): an MCP Apps host, or Grok Bot. */
export type Via = AppHost | "grok";

/** How this request's client shows a moment to the user. */
export interface Audience {
  /** It draws our checkout card. */
  readonly cards: boolean;
  /** What it declared for native forms and links (see forms.ts). */
  readonly support: FormSupport;
  /** Added to the payment and private-details lines without a card (Grok Bot updates). */
  readonly hint?: string | null;
  /** The server offers request_spending_limit (it has the sealing key). */
  readonly limits?: boolean;
  /** The server offers spending_limits and pay_with_spending_limit. */
  readonly pays?: boolean;
  /**
   * With cards: this result is the card (show_checkout_step, or the card's
   * own reads), so the step is on screen. Otherwise the model is told to show
   * it with show_checkout_step.
   */
  readonly shown?: boolean;
}

/** The tool that draws the Menta card for the step a checkout is at. */
export const SHOW_TOOL = "show_checkout_step";

const plain: Audience = { cards: true, support: noForms };

/** Whether the checkout is still going (with or without a step open). */
export function isActive(view: Pick<CheckoutView, "status">) {
  return (
    view.status === "queued" ||
    view.status === "running" ||
    view.status === "awaiting_input"
  );
}

/**
 * What the assistant does with this result, in one line. Kept generic: no
 * store or product specifics beyond the amount and merchant.
 */
export function nextStep(
  view: CheckoutView,
  {
    cards,
    support,
    hint = null,
    limits = false,
    pays = false,
    shown = false,
  }: Audience = plain,
): string {
  const after = hint ? ` ${hint}` : "";
  const pending = view.pending;
  // A card host shows a step, or how the checkout ended, in the Menta card.
  const show = `Call ${SHOW_TOOL} with this runId to show it in the Menta card`;
  // Without a card nothing tells the model the user is done at the link.
  const noCard =
    "if no card shows, give them pending.actionUrl, and once they're done there call continue with this runId and afterRequestId set to pending.requestId";
  if (isActive(view) && !pending) {
    return "Still working; nothing needs the user yet. Call continue with this runId to keep following it.";
  }
  if (pending?.kind === "question") {
    if (cards && !shown) {
      return `The store has a question. ${show}, where the user answers it. If they answer in chat instead, send it with answer.`;
    }
    if (cards) {
      return "The store has a question, shown to the user in the Menta card. Tell them in one short sentence and let them answer there. If they answer in chat instead, send it with answer.";
    }
    if (support.forms) {
      return "The store has a question. Call answer with this runId and no answers: the user answers it in a form. If they already told you, send that as answers.";
    }
    return "The store has a question. Ask the user in one short message, listing its options exactly as given, and send their reply with answer.";
  }
  if (pending?.kind === "payment") {
    const amount = `${pending.amount.exact ? "" : "up to "}${pending.amount.amount} ${pending.amount.currency}`;
    // As request_spending_limit takes it: two decimals at most, rounded up.
    const least = requestAmount(pending.amount.amount) ?? pending.amount.amount;
    // Every host first tries an existing limit that fits.
    const pick = `call spending_limits and pick the one whose name fits what this purchase is for, in ${pending.amount.currency}, with at least ${pending.amount.amount} left, for any store or this one; then call pay_with_spending_limit with this runId and its id.`;
    if (cards && shown) {
      // The card's reads say this too, so it never skips the user's limits.
      // Not "approve the payment": the card asks for a spending limit, since none pays it.
      const tell =
        "in one short sentence that none of their spending limits covers it, so they approve one in the card to pay";
      return `Ready to pay ${amount} at ${pending.merchant.name}, shown in the Menta card: the user approves a spending limit there. ${pays ? `If you haven't checked the user's spending limits for it yet, ${pick} If none fits, tell the user ${tell}.` : `Tell the user ${tell}.`} You can't create, approve or raise a spending limit, and never ask for card details in chat.`;
    }
    const existing = pays
      ? `${pick} If none fits, ${cards ? "" : "ask for one the user can reuse: "}`
      : cards
        ? ""
        : "Ask the user for a spending limit they can reuse: ";
    const request = cards
      ? `${pays ? "call" : "Call"} ${SHOW_TOOL} with this runId: the user approves a spending limit in the Menta card (${noCard}).`
      : limits
        ? `call request_spending_limit with this runId, a short generic name for this kind of spending in the user's language ("Food delivery", "Groceries", "Electronics"; not the product or the store, unless that's what the budget is for), this currency, an amount of at least ${least}, usually with room for more of this kind of spending (a round sum above it, like 50 for 31.20) or the user's budget for it, expires "week" or "month", and store only if it should work at this store alone. Give the user its url exactly as returned, in one line: approving it there pays this checkout. If the call fails, call it again.`
        : "give them pending.actionUrl exactly as returned, in one line: they approve a spending limit there, signed in to Menta.";
    // The card tells the model when the user approved there; elsewhere it follows on.
    const follow = cards
      ? ""
      : ` Then call continue with this runId and afterRequestId set to pending.requestId.${after}`;
    return `Ready to pay ${amount} at ${pending.merchant.name}. ${pays ? "Pay it from one of the user's spending limits: " : ""}${existing}${request} You can't create, approve or raise a spending limit, and never ask for card details in chat.${follow}`;
  }
  if (pending?.kind === "protected") {
    // "No password, email me a code": the user's way round goes to the store.
    const otherWay =
      "If they can't give it that way (no password, a code by email instead), send their words as text with answer; never a password or code.";
    if (cards && !shown) {
      return `The store needs private details. ${show}, where the user enters them (${noCard}); never collect them in chat. ${otherWay}`;
    }
    if (cards) {
      return `The store needs private details, entered in the Menta card (or at pending.actionUrl if no card shows); never collect them in chat. Say what the store needs in one short sentence. ${otherWay}`;
    }
    if (support.url) {
      return `The store needs private details. Call answer with this runId and no answers to send the user to the secure page; never collect them in chat. ${otherWay}`;
    }
    return `The store needs private details. Tell the user in one line what it needs (from pending.question) and give them pending.actionUrl exactly as returned: they enter them there, signed in to Menta. Never collect them in chat. ${otherWay} Then call continue with this runId and afterRequestId set to pending.requestId.${after}`;
  }
  // How it ended: on a card host, only a receipt gets the card; other endings
  // are a line of text.
  const ended = endLine(view);
  if (cards && !shown && view.status === "succeeded" && view.result?.receipt) {
    return `${show}, then: ${ended}`;
  }
  return ended;
}

/** What the model says once the checkout has ended. */
function endLine(view: CheckoutView): string {
  switch (view.status) {
    case "succeeded":
      return view.result?.receipt
        ? "Done: the order was placed. Report it in one line with the receipt total and the store order number when present."
        : "Done: the task completed (no receipt). Report the outcome in one line; say an order was placed only if the task was a purchase.";
    case "blocked":
      return view.result?.blockedCode === "reconciliation_required"
        ? "It's unclear whether the order went through. Tell the user not to buy it again yet, because it could charge twice."
        : "The checkout couldn't continue. Explain in one line using result.summary, and offer to try another store or item.";
    case "failed":
      return "The checkout failed. Explain in one line using result.failureReason or result.summary.";
    case "cancelled":
      return "The checkout was cancelled; nothing was ordered. Say so in one line, and don't start it again unless the user asks.";
    default:
      return "Call continue with this runId.";
  }
}

/**
 * Tags the secure page link with the host that sent the user (`via=chatgpt`,
 * `via=claude` or `via=grok`), so the page can say where they came from. A
 * spending limit request link already carries it, sealed.
 */
export function withHost(view: CheckoutView, host: Via | null): CheckoutView {
  const pending = view.pending;
  if (
    (host !== "chatgpt" && host !== "claude" && host !== "grok") ||
    !pending ||
    pending.kind === "question"
  ) {
    return view;
  }
  const url = new URL(pending.actionUrl);
  // A spending limit request link says who asked inside its sealed token.
  if (!url.pathname.startsWith("/checkouts/")) {
    return view;
  }
  url.searchParams.set("via", host);
  return { ...view, pending: { ...pending, actionUrl: url.href } };
}

export function result(structured: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structured) }],
    structuredContent: structured,
  };
}

/**
 * A checkout result: `checkout` (no live-view URL or progress) and `next` for
 * the model and text-only hosts, which the card also renders. `_meta` is for
 * the card only: its role (a step card while the store waits on the user,
 * else a status card), progress, and whether the secure step can open in it.
 * `note` leads `next` with what just happened.
 */
export function present(
  view: CheckoutView,
  {
    via = null,
    audience = plain,
    secureStep = false,
    note,
    next: given,
    extra,
    role = view.pending ? "step" : "start",
    meta = {},
  }: {
    via?: Via | null;
    audience?: Audience;
    secureStep?: boolean;
    note?: string;
    /** Instead of the usual line for this state. */
    next?: string;
    /** More model-visible fields. */
    extra?: Record<string, unknown>;
    /** What the card is drawn for; by default a step while the store waits on the user. */
    role?: "start" | "step";
    /** More card-only `_meta` (the request's language). */
    meta?: Record<string, unknown>;
  } = {},
) {
  const next = given ?? nextStep(view, audience);
  return {
    ...result({
      checkout: forModel(withHost(view, via)),
      ...extra,
      next: note ? `${note} ${next}` : next,
    }),
    _meta: {
      [OBSERVED_AT]: Date.now(),
      [CARD_STEP]: role,
      ...(secureStep ? { [SECURE_STEP]: true } : {}),
      ...(view.progress ? { [PROGRESS]: view.progress } : {}),
      ...meta,
    },
  };
}

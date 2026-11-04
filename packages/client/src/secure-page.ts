import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";

/**
 * Hosts that send people here (the link's `via`). ChatGPT and Claude draw our
 * card and have a web home to go back to. Grok Bot is a desktop and phone app
 * with no documented link to open it, so the page only says to return to it.
 */
const hosts = {
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    home: "https://chatgpt.com/",
    card: true,
  },
  claude: {
    id: "claude",
    name: "Claude",
    home: "https://claude.ai/",
    card: true,
  },
  grok: { id: "grok", name: "Grok Bot", home: null, card: false },
} as const;

export type Host = (typeof hosts)[keyof typeof hosts];

/** The host named by `via`; anything off the allowlist is unknown. */
export function hostFrom(via: string | null): Host | null {
  return via === "chatgpt" || via === "claude" || via === "grok"
    ? hosts[via]
    : null;
}

/** The small line under the page's buttons: where the user goes next. */
export function returnLine(
  host: Host | null,
  back: ReturnType<typeof backLink>,
  stage: "done" | "working",
) {
  // Hosts without a card get "Return to …" above this line (no link to open them).
  if (host && !host.card) {
    return stage === "done"
      ? "You can close this tab."
      : "This page moves on when the store needs you.";
  }
  if (host) {
    return stage === "done"
      ? `Or close this tab. The card in ${host.name} updates on its own.`
      : `The card in ${host.name} updates on its own.`;
  }
  if (stage === "working") {
    return "This page moves on when the store needs you.";
  }
  return back ? "Or close this tab." : "You can close this tab.";
}

/**
 * A same-origin path to return to, never another site: no `//` or `/\`
 * start, no backslashes or whitespace anywhere (browsers drop tabs and
 * newlines, so `/<tab>/evil` would become `//evil`). The same rule as the
 * Google sign-in callback's `readNext`.
 */
export function returnPath(from: string | null) {
  return from && from.length <= 2048 && /^\/(?![/\\])[^\s\\]*$/.test(from)
    ? from
    : null;
}

/** Where "Back to …" goes: the host's home, our own conversation, or nowhere. */
export function backLink(host: Host | null, from: string | null) {
  if (host) {
    return host.home
      ? { href: host.home, label: `Back to ${host.name}` }
      : null;
  }
  if (from) {
    return {
      href: `${from}${from.includes("?") ? "&" : "?"}continued=1`,
      label: "Back to the conversation",
    };
  }
  return null;
}

export type Stage =
  | "payment"
  | "store"
  | "working"
  | "done"
  | "stopped"
  | "expired"
  | "cancelled";

/** Which screen a checkout gets on the secure page. */
export function stageOf(view: CheckoutView, now = Date.now()): Stage {
  const reason = view.result?.failureReason;
  if (
    view.status === "cancelled" ||
    (view.status === "failed" && reason === "cancelled")
  ) {
    return "cancelled";
  }
  if (view.status === "failed" && reason === "input_expired") {
    return "expired";
  }
  const pending = view.pending;
  if (!pending) {
    // Still going with nothing for the user yet: the page shows the live view.
    if (
      view.status === "queued" ||
      view.status === "running" ||
      view.status === "awaiting_input"
    ) {
      return "working";
    }
    // Over: an order placed, or a checkout that stopped (failed or blocked).
    return view.status === "succeeded" ? "done" : "stopped";
  }
  if (pending.expiresAt && Date.parse(pending.expiresAt) <= now) {
    return "expired";
  }
  return pending.kind === "payment" ? "payment" : "store";
}

/**
 * An order the store may have placed that Crossmint couldn't confirm (a failed
 * or blocked run): never say nothing was charged or invite buying again.
 */
export function unconfirmed(view: CheckoutView) {
  return (
    view.result?.failureReason === "reconciliation_required" ||
    view.result?.blockedCode === "reconciliation_required"
  );
}

/**
 * Whether a finished checkout placed an order (the store gave a receipt), or
 * only did what was asked without buying (find an item, fill a cart).
 */
export function placedOrder(view: CheckoutView) {
  return view.status === "succeeded" && view.result?.receipt != null;
}

interface Money {
  readonly amount: string;
  readonly currency: string;
}

/** The limit chip: within it, over it (and by how much), or just the limit. */
export function limitCheck(
  amount: Money,
  limit: Money,
): { tone: "within" | "over" | "plain"; over: Money | null } {
  const cents = (value: Money) => Math.round(Number(value.amount) * 100);
  if (
    amount.currency !== limit.currency ||
    !Number.isFinite(cents(amount)) ||
    !Number.isFinite(cents(limit))
  ) {
    return { tone: "plain", over: null };
  }
  const over = cents(amount) - cents(limit);
  return over > 0
    ? {
        tone: "over",
        over: { amount: (over / 100).toFixed(2), currency: amount.currency },
      }
    : { tone: "within", over: null };
}

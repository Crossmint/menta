/** Checkout status logic both checkout views share, DOM-free. */

import { EN, type Ui } from "./i18n/index.js";

/** A checkout's state at a glance: the dot and the color of its status text. */
export type Tone =
  | "idle"
  | "working"
  | "attention"
  | "success"
  | "danger"
  | "muted";

/** A blocked code's reason in a few words, or the plain "Blocked". */
export function blockedReason(code: string | null | undefined, ui: Ui = EN) {
  const reasons: Readonly<Record<string, string>> = ui.m.blocked;
  return reasons[code ?? ""] ?? ui.m.status.blocked;
}

/** Why a failed checkout stopped, in a sentence. */
export function failureText(reason: string | null | undefined, ui: Ui = EN) {
  const failures: Readonly<Record<string, string>> = ui.m.failures;
  return (reason ? failures[reason] : undefined) ?? ui.m.failures.other;
}

/**
 * An active checkout's status, as the dock's header says it: what it needs
 * from the user, or that it's working. `sent`: the user just answered or
 * approved and the store hasn't moved on yet.
 */
export function runStatus(
  run: {
    readonly status: string;
    readonly pending: { readonly kind: string } | null;
  },
  { canceling = false, sent = false } = {},
  ui: Ui = EN,
): { tone: Tone; label: string } {
  const s = ui.m.status;
  if (canceling) {
    return { tone: "idle", label: s.cancelingWaiting };
  }
  if (sent) {
    return {
      tone: "working",
      label:
        run.pending?.kind === "payment" ? s.approvedWaiting : s.sentWaiting,
    };
  }
  switch (run.pending?.kind) {
    case "payment":
      return { tone: "attention", label: s.readyToPay };
    case "question":
      return { tone: "attention", label: s.needsAnswer };
    case "protected":
      return { tone: "attention", label: s.needsSecureStep };
  }
  return run.status === "queued"
    ? { tone: "idle", label: s.starting }
    : { tone: "working", label: s.working };
}

interface Described {
  readonly status: string;
  readonly pending: { readonly kind: string } | null;
  readonly result?: {
    readonly blockedCode?: string | null;
    readonly failureReason?: string | null;
  } | null;
}

/** Any checkout's status, as its card says it, including how it ended. */
export function describeCheckout(
  view: Described,
  ui: Ui = EN,
): {
  tone: Tone;
  label: string;
} {
  const s = ui.m.status;
  switch (view.status) {
    case "queued":
      return { tone: "idle", label: s.starting };
    case "awaiting_input":
      return view.pending?.kind === "question"
        ? { tone: "attention", label: s.storeQuestion }
        : view.pending
          ? { tone: "attention", label: s.needsYou }
          : { tone: "working", label: s.working };
    case "succeeded":
      return { tone: "success", label: s.orderPlaced };
    case "blocked":
      return {
        tone: "danger",
        label: ui.f(s.couldntBuyBecause, {
          reason: blockedReason(view.result?.blockedCode, ui),
        }),
      };
    case "failed":
      return view.result?.failureReason === "reconciliation_required"
        ? { tone: "idle", label: s.notConfirmed }
        : { tone: "danger", label: s.stopped };
    case "cancelled":
      return { tone: "muted", label: s.canceled };
    default:
      return { tone: "working", label: s.working };
  }
}

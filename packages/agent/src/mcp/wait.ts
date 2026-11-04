import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";

/**
 * Following a checkout: `start`, `answer` and `continue` read the run from
 * Crossmint every couple of seconds and return as soon as something new needs
 * the user (a store question, private details, a payment to approve) or the
 * run ends, or when the call's window is up (just under what the host allows
 * per call). Nothing is stored: every read comes from Crossmint.
 */

/** The default window per call; server.ts sets one per host. */
export const WAIT_WINDOW_MS = 50_000;
/** Crossmint is read this often while waiting. */
export const WAIT_EVERY_MS = 2_000;

export interface WaitOptions {
  /** A request the user just answered or approved: not news while the store catches up. */
  readonly afterRequestId?: string | undefined;
  readonly windowMs?: number;
  readonly everyMs?: number;
  /** The request's own signal: a client that hangs up ends the wait. */
  readonly signal?: AbortSignal | undefined;
  readonly now?: () => number;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** Whether the user has something to do in this view, or the run is over. */
export function needsUserOrEnded(
  view: Pick<CheckoutView, "status" | "pending">,
  afterRequestId?: string,
) {
  if (
    view.status !== "queued" &&
    view.status !== "running" &&
    view.status !== "awaiting_input"
  ) {
    return true;
  }
  return Boolean(view.pending && view.pending.requestId !== afterRequestId);
}

function sleepFor(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Reads the run until it needs the user or ends, or the window is up.
 * `changed`: it returned because of that, not the clock (or a hang-up).
 */
export async function waitForCheckout(
  read: () => Promise<CheckoutView>,
  {
    afterRequestId,
    windowMs = WAIT_WINDOW_MS,
    everyMs = WAIT_EVERY_MS,
    signal,
    now = Date.now,
    sleep = sleepFor,
  }: WaitOptions = {},
): Promise<{ view: CheckoutView; changed: boolean; reads: number }> {
  const started = now();
  let view = await read();
  let reads = 1;
  for (;;) {
    if (needsUserOrEnded(view, afterRequestId)) {
      return { view, changed: true, reads };
    }
    if (signal?.aborted || now() - started + everyMs > windowMs) {
      return { view, changed: false, reads };
    }
    await sleep(everyMs, signal);
    if (signal?.aborted) {
      return { view, changed: false, reads };
    }
    view = await read();
    reads++;
  }
}

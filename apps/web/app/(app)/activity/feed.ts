import type { CheckoutView } from "@oca/client/checkouts";
import { placedOrder } from "@oca/client/secure-page";

/** A checkout as /api/checkouts lists it: with the agent that started it, when Menta noted one. */
export type Purchase = CheckoutView & { readonly agent?: string | null };

/**
 * A checkout that spent money: the store gave a receipt, or confirmed the
 * order without one. Finds, carts, and runs that stopped or were canceled
 * aren't transactions.
 */
export function spent(run: CheckoutView) {
  return placedOrder(run) || run.result?.confirmedWithoutReceipt === true;
}

/** What the user narrowed the list to; empty strings filter nothing. */
export interface Filter {
  /** Words in the request the assistant made. */
  readonly text: string;
  /** One store, as rows show it ("amazon.com"). */
  readonly store: string;
}

export const noFilter: Filter = { text: "", store: "" };

/** Whether a purchase passes the filter. */
export function matches(run: CheckoutView, filter: Filter) {
  const text = filter.text.trim().toLocaleLowerCase();
  if (text && !(run.task ?? "").toLocaleLowerCase().includes(text)) {
    return false;
  }
  return !filter.store || run.store === filter.store;
}

/** Where the list continues after what's shown. */
export interface Feed {
  /** Purchases already read but not shown: one read can find more than a page. */
  readonly pending: readonly Purchase[];
  /** Crossmint's cursor past the last read, or null at the end of its list. */
  readonly cursor: string | null;
}

/** Whether there's more to show after the feed. */
export function hasMore(feed: Feed | null) {
  return Boolean(feed && (feed.pending.length > 0 || feed.cursor));
}

/** Transactions per page. */
export const PAGE = 20;
/** Runs per read, the checkouts API's cap. */
const BATCH = 50;
/** Reads per page once one transaction is found, and before pausing on finding none. */
const READS = 4;
export const MAX_READS = 20;

/**
 * The next page of transactions, from the start when `after` is null.
 * Crossmint lists every run, purchases or not, so a page reads runs until it
 * has enough purchases, runs out, or reaches its read limit; whatever it found
 * beyond the page waits in the returned feed.
 */
export async function loadPage(
  after: Feed | null,
): Promise<{ runs: Purchase[]; feed: Feed }> {
  const found = [...(after?.pending ?? [])];
  let cursor = after?.cursor ?? null;
  let reads = 0;
  while (
    (after === null && reads === 0) ||
    (cursor &&
      found.length < PAGE &&
      reads < (found.length > 0 ? READS : MAX_READS))
  ) {
    const query = new URLSearchParams({ limit: String(BATCH) });
    if (cursor) {
      query.set("cursor", cursor);
    }
    const response = await fetch(`/api/checkouts?${query}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Transactions failed (${response.status}).`);
    }
    const page = (await response.json()) as {
      runs: Purchase[];
      nextCursor: string | null;
    };
    found.push(...page.runs.filter(spent));
    cursor = page.nextCursor;
    reads += 1;
  }
  return {
    runs: found.slice(0, PAGE),
    feed: { pending: found.slice(PAGE), cursor },
  };
}

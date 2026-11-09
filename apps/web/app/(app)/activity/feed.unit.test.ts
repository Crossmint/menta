import type { CheckoutView } from "@oca/client/checkouts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasMore, loadPage, MAX_READS, matches, noFilter, PAGE } from "./feed";

let ids = 0;

function run(kind: "receipt" | "noReceipt" | "find" | "failed"): CheckoutView {
  ids += 1;
  return {
    runId: `run-${ids}`,
    status: kind === "failed" ? "failed" : "succeeded",
    result: {
      summary: null,
      receipt:
        kind === "receipt"
          ? { total: { amount: "10", currency: "USD" }, merchantOrderId: null }
          : null,
      confirmedWithoutReceipt: kind === "noReceipt",
      blockedCode: null,
      failureReason: kind === "failed" ? "runtime_error" : null,
    },
  } as unknown as CheckoutView;
}

/** Crossmint's list as pages of runs; each read's cursor is the next page's index. */
function serve(pages: CheckoutView[][]) {
  const reads: (string | null)[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    const cursor = new URL(url, "http://test").searchParams.get("cursor");
    reads.push(cursor);
    const index = cursor ? Number(cursor) : 0;
    return Response.json({
      runs: pages[index],
      nextCursor: index + 1 < pages.length ? String(index + 1) : null,
    });
  });
  return reads;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadPage", () => {
  it("shows only checkouts that spent money", async () => {
    serve([[run("receipt"), run("find"), run("failed"), run("noReceipt")]]);
    const page = await loadPage(null);
    expect(page.runs).toHaveLength(2);
    expect(hasMore(page.feed)).toBe(false);
  });

  it("keeps purchases beyond a page for the next one", async () => {
    const purchases = Array.from({ length: 50 }, () => run("receipt"));
    const reads = serve([purchases]);
    const first = await loadPage(null);
    expect(first.runs).toEqual(purchases.slice(0, PAGE));
    const second = await loadPage(first.feed);
    const third = await loadPage(second.feed);
    expect([...second.runs, ...third.runs]).toEqual(purchases.slice(PAGE));
    expect(hasMore(third.feed)).toBe(false);
    expect(reads).toEqual([null]);
  });

  it("pauses a long search without purchases, and resumes it", async () => {
    const empty = Array.from({ length: MAX_READS + 1 }, () => [run("find")]);
    const older = run("receipt");
    const reads = serve([...empty, [older]]);
    const first = await loadPage(null);
    expect(first.runs).toEqual([]);
    expect(hasMore(first.feed)).toBe(true);
    expect(reads).toHaveLength(MAX_READS);
    const second = await loadPage(first.feed);
    expect(second.runs).toEqual([older]);
    expect(hasMore(second.feed)).toBe(false);
  });

  it("throws when Crossmint can't list", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 502 }));
    await expect(loadPage(null)).rejects.toThrow("502");
  });
});

describe("matches", () => {
  const batteries = {
    ...run("receipt"),
    store: "amazon.com",
    task: "Buy AA Batteries, delivered home",
  } as CheckoutView;
  const shirts = {
    ...run("noReceipt"),
    store: "zara.com",
    task: null,
  } as CheckoutView;

  it("lets everything through without a filter", () => {
    expect(matches(batteries, noFilter)).toBe(true);
    expect(matches(shirts, noFilter)).toBe(true);
  });

  it("finds words in the request, ignoring case", () => {
    expect(matches(batteries, { ...noFilter, text: "  aa batt " })).toBe(true);
    expect(matches(batteries, { ...noFilter, text: "cable" })).toBe(false);
    expect(matches(shirts, { ...noFilter, text: "shirt" })).toBe(false);
  });

  it("keeps one store", () => {
    expect(matches(batteries, { ...noFilter, store: "amazon.com" })).toBe(true);
    expect(matches(shirts, { ...noFilter, store: "amazon.com" })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { type CheckoutView, runsNeedingYou } from "./checkouts";
import {
  backLink,
  hostFrom,
  limitCheck,
  placedOrder,
  returnLine,
  returnPath,
  stageOf,
  unconfirmed,
} from "./secure-page";

const now = Date.parse("2026-10-06T12:00:00.000Z");

function view(extra: Partial<CheckoutView> = {}): CheckoutView {
  return {
    runId: "run-1",
    revision: 1,
    status: "awaiting_input",
    createdAt: null,
    startUrl: "https://store.invalid",
    store: "store.invalid",
    task: "One mug",
    maxCost: { amount: "25.00", currency: "USD" },
    usesSavedDetails: false,
    shipsTo: null,
    fulfillment: "delivery",
    liveViewUrl: null,
    pending: null,
    progress: null,
    result: null,
    ...extra,
  };
}

const payment = (expiresAt: string | null) =>
  ({
    kind: "payment",
    requestId: "req-1",
    question: "Approve?",
    expiresAt,
    amount: { amount: "25.00", currency: "USD", exact: true },
    merchant: {
      name: "Store",
      url: "https://store.invalid",
      countryCode: "US",
    },
    actionUrl: "https://commerce.invalid/checkouts/run-1",
  }) as const;

const result = (failureReason: string | null) => ({
  summary: null,
  receipt: null,
  confirmedWithoutReceipt: false,
  blockedCode: null,
  failureReason,
});

describe("hostFrom", () => {
  it("knows only allowlisted hosts", () => {
    expect(hostFrom("chatgpt")?.name).toBe("ChatGPT");
    expect(hostFrom("claude")?.home).toBe("https://claude.ai/");
    expect(hostFrom("ChatGPT")).toBeNull();
    expect(hostFrom("https://evil.invalid")).toBeNull();
    expect(hostFrom(null)).toBeNull();
  });

  it("never says a card in ChatGPT or Claude updates: they get no card", () => {
    for (const via of ["chatgpt", "claude", "grok"]) {
      const host = hostFrom(via);
      expect(host?.card, via).toBe(false);
      for (const stage of ["done", "working"] as const) {
        expect(returnLine(host, backLink(host, null), stage)).not.toContain(
          "card",
        );
      }
    }
  });
});

describe("backLink", () => {
  it("returns to the host, then our conversation, else nowhere", () => {
    expect(backLink(hostFrom("chatgpt"), "/c/1")).toEqual({
      href: "https://chatgpt.com/",
      label: "Back to ChatGPT",
    });
    expect(backLink(null, "/c/1")).toEqual({
      href: "/c/1?continued=1",
      label: "Back to the conversation",
    });
    expect(backLink(null, "/?c=1")?.href).toBe("/?c=1&continued=1");
    expect(backLink(null, null)).toBeNull();
  });

  it("only takes same-origin paths", () => {
    expect(returnPath("/c/1")).toBe("/c/1");
    expect(returnPath("//evil.invalid")).toBeNull();
    expect(returnPath("/\\evil.invalid")).toBeNull();
    expect(returnPath("/\t/evil.invalid")).toBeNull();
    expect(returnPath("/%5Cevil.invalid")).toBe("/%5Cevil.invalid");
    expect(returnPath("https://evil.invalid")).toBeNull();
    expect(returnPath(null)).toBeNull();
  });
});

describe("stageOf", () => {
  it("shows the pending step while it's open", () => {
    expect(stageOf(view({ pending: payment(null) }), now)).toBe("payment");
    expect(
      stageOf(view({ pending: payment("2026-10-06T12:05:00.000Z") }), now),
    ).toBe("payment");
    expect(
      stageOf(
        view({
          pending: {
            kind: "question",
            requestId: "req-1",
            question: "Size?",
            expiresAt: null,
            fields: [],
          },
        }),
        now,
      ),
    ).toBe("store");
  });

  it("tells expired from done", () => {
    expect(
      stageOf(view({ pending: payment("2026-10-06T11:59:00.000Z") }), now),
    ).toBe("expired");
    expect(
      stageOf(view({ status: "failed", result: result("input_expired") }), now),
    ).toBe("expired");
    expect(stageOf(view({ status: "succeeded" }), now)).toBe("done");
  });

  it("says a failed or blocked checkout stopped, never that it's done", () => {
    expect(
      stageOf(view({ status: "failed", result: result("runtime_error") }), now),
    ).toBe("stopped");
    expect(stageOf(view({ status: "blocked" }), now)).toBe("stopped");
  });

  it("watches a checkout that is still working with nothing to do yet", () => {
    expect(stageOf(view({ status: "running" }), now)).toBe("working");
    expect(stageOf(view({ status: "queued" }), now)).toBe("working");
    expect(stageOf(view({ status: "awaiting_input" }), now)).toBe("working");
  });

  it("knows a cancelled checkout", () => {
    expect(stageOf(view({ status: "cancelled" }), now)).toBe("cancelled");
    expect(
      stageOf(view({ status: "failed", result: result("cancelled") }), now),
    ).toBe("cancelled");
  });
});

describe("limitCheck", () => {
  const usd = (amount: string) => ({ amount, currency: "USD" });

  it("is within the limit up to the cent", () => {
    expect(limitCheck(usd("25.00"), usd("25.00"))).toEqual({
      tone: "within",
      over: null,
    });
    expect(limitCheck(usd("0.30"), usd("0.3"))).toEqual({
      tone: "within",
      over: null,
    });
  });

  it("says by how much it's over", () => {
    expect(limitCheck(usd("26.10"), usd("25.00"))).toEqual({
      tone: "over",
      over: usd("1.10"),
    });
  });

  it("can't compare across currencies", () => {
    expect(
      limitCheck({ amount: "25.00", currency: "EUR" }, usd("25.00")).tone,
    ).toBe("plain");
  });
});

describe("how a finished checkout reads", () => {
  it("never calls an unconfirmed order nothing, failed or blocked", () => {
    const result = (extra: Record<string, unknown>) =>
      ({ summary: null, ...extra }) as unknown as CheckoutView["result"];
    expect(
      unconfirmed(
        view({
          status: "failed",
          result: result({ failureReason: "reconciliation_required" }),
        }),
      ),
    ).toBe(true);
    expect(
      unconfirmed(
        view({
          status: "blocked",
          result: result({ blockedCode: "reconciliation_required" }),
        }),
      ),
    ).toBe(true);
    expect(
      unconfirmed(
        view({
          status: "blocked",
          result: result({ blockedCode: "product.item_unavailable" }),
        }),
      ),
    ).toBe(false);
  });

  it("calls it an order only with a receipt", () => {
    const succeeded = (receipt: unknown) =>
      view({
        status: "succeeded",
        result: { receipt } as unknown as CheckoutView["result"],
      });
    expect(placedOrder(succeeded({ orderId: "A1" }))).toBe(true);
    // A find-only or cart-only task finishes without buying.
    expect(placedOrder(succeeded(null))).toBe(false);
  });
});

describe("runsNeedingYou", () => {
  it("finds a waiting approval behind a page of newer runs, and skips plain questions", async () => {
    const pages: Record<
      string,
      { runs: CheckoutView[]; nextCursor: string | null }
    > = {
      first: {
        runs: [
          view({ runId: "done", status: "succeeded" }),
          view({ runId: "asks", pending: { kind: "question" } as never }),
        ],
        nextCursor: "second",
      },
      second: {
        runs: [view({ runId: "pay", pending: { kind: "payment" } as never })],
        nextCursor: null,
      },
    };
    const read = async (cursor: string | null) =>
      pages[cursor ?? "first"] ?? null;
    expect((await runsNeedingYou(read)).map((run) => run.runId)).toEqual([
      "pay",
    ]);
  });
});

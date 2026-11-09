import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it } from "vitest";
import { nextStep } from "./moments.js";
import {
  needsUserOrEnded,
  WAIT_EVERY_MS,
  WAIT_WINDOW_MS,
  waitForCheckout,
} from "./wait.js";

type View = Pick<CheckoutView, "status" | "pending">;

const working: View = { status: "running", pending: null };
const asking = (requestId: string): View => ({
  status: "awaiting_input",
  pending: {
    kind: "question",
    requestId,
    question: "Which toy?",
    expiresAt: null,
    fields: [],
  },
});
const ended: View = { status: "cancelled", pending: null };

/** Reads that walk through `views` (the last repeats), on a fake clock. */
function script(views: View[]) {
  let clock = 0;
  let reads = 0;
  const slept: number[] = [];
  return {
    read: async () =>
      (views[Math.min(reads++, views.length - 1)] ?? working) as CheckoutView,
    now: () => clock,
    sleep: async (ms: number) => {
      slept.push(ms);
      clock += ms;
    },
    slept,
  };
}

describe("following a checkout", () => {
  it("waits up to 50 seconds by default, reading every 2", () => {
    expect(WAIT_WINDOW_MS).toBe(50_000);
    expect(WAIT_EVERY_MS).toBe(2_000);
  });

  it("returns at once when the store already needs the user, or the run ended", async () => {
    for (const view of [asking("req-1"), ended]) {
      const fake = script([view]);
      const waited = await waitForCheckout(fake.read, fake);
      expect(waited).toMatchObject({ changed: true, reads: 1 });
      expect(fake.slept).toEqual([]);
    }
  });

  it("returns as soon as a new step opens", async () => {
    const fake = script([working, working, asking("req-2")]);
    const waited = await waitForCheckout(fake.read, fake);
    expect(waited.changed).toBe(true);
    expect(waited.view.pending?.requestId).toBe("req-2");
    expect(fake.slept).toEqual([2000, 2000]);
  });

  it("times out unchanged inside the window", async () => {
    const fake = script([working]);
    const waited = await waitForCheckout(fake.read, fake);
    // A read every 2 seconds from 0 to 50, then back to the model.
    expect(waited).toMatchObject({ changed: false, reads: 26 });
    expect(fake.slept.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(
      WAIT_WINDOW_MS,
    );
  });

  it("doesn't return for the request the user just finished", async () => {
    const fake = script([asking("req-1"), asking("req-1"), asking("req-2")]);
    const waited = await waitForCheckout(fake.read, {
      ...fake,
      afterRequestId: "req-1",
    });
    expect(waited.view.pending?.requestId).toBe("req-2");
    expect(needsUserOrEnded(asking("req-1"), "req-1")).toBe(false);
    expect(needsUserOrEnded(ended, "req-1")).toBe(true);
  });

  it("ends when the request is aborted", async () => {
    const controller = new AbortController();
    let reads = 0;
    const started = Date.now();
    const pending = waitForCheckout(
      async () => {
        reads++;
        return working as CheckoutView;
      },
      { signal: controller.signal, windowMs: 60_000, everyMs: 30_000 },
    );
    setTimeout(() => controller.abort(), 20);
    const waited = await pending;
    expect(waited.changed).toBe(false);
    expect(reads).toBe(1);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe("a payment step", () => {
  const view = {
    runId: "run-1",
    status: "awaiting_input",
    store: "ubereats.com",
    pending: {
      kind: "payment",
      requestId: "req-pay",
      question: "Approve",
      expiresAt: null,
      amount: { amount: "31.20", currency: "USD", exact: true },
      merchant: {
        name: "Uber Eats",
        url: "https://www.ubereats.com",
        countryCode: "US",
      },
      actionUrl: "https://menta.invalid/checkouts/run-1",
    },
  } as unknown as CheckoutView;
  const text = { cards: false, support: { forms: false, url: false } };

  it("has the assistant pick a fitting limit first, then the usual way to approve one", () => {
    const next = nextStep(view, {
      ...text,
      limits: true,
      pays: true,
    } as never);
    expect(next).toContain(
      "call spending_limits and pick the one whose name fits",
    );
    expect(next).toContain("call pay_with_spending_limit with this runId");
    expect(next).toContain("If none fits, ask for one the user can reuse");
    expect(next).toContain("Then call continue with this runId");
    expect(next).toContain(
      "You can't create, approve or raise a spending limit",
    );
  });

  it("keeps the usual way to approve one where the server can't pay from limits", () => {
    const next = nextStep(view, { ...text, limits: true } as never);
    expect(next).not.toContain("spending_limits");
    expect(next).toContain("call request_spending_limit with this runId");
  });

  it("on a card host, tries the user's limits first, then shows the card, even when the card says it", () => {
    const cards = { ...text, cards: true, limits: true, pays: true };
    const toShow = nextStep(view, cards as never);
    expect(toShow).toContain(
      "If none fits, call show_checkout_step with this runId",
    );
    expect(toShow).not.toContain("request_spending_limit");
    expect(toShow).not.toContain("one the user can reuse");
    // No card drawn after all: the link, then follow the checkout.
    expect(toShow).toContain(
      "if no card shows, give them pending.actionUrl, and once they're done there call continue",
    );
    // The card's own reads say it's on screen, and never skip the limits.
    const shown = nextStep(view, { ...cards, shown: true } as never);
    expect(shown).toContain("shown in the Menta card");
    expect(shown).toContain("call pay_with_spending_limit with this runId");
    expect(shown).not.toContain("show_checkout_step");
  });
});

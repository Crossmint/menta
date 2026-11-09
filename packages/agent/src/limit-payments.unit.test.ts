import type {
  Checkouts,
  CheckoutView,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it, vi } from "vitest";
import {
  covers,
  createLimitPayments,
  paymentMessageId,
} from "./limit-payments.js";
import type { OrderIntentView } from "./order-intents.js";

const NOW = Date.parse("2026-11-03T12:00:00Z");

function limit(overrides: Partial<OrderIntentView> = {}): OrderIntentView {
  return {
    orderIntentId: "oi-1",
    paymentMethodId: "pm-1",
    description: "Shopping",
    merchant: null,
    amount: {
      total: "200.00",
      spent: "80.00",
      available: "120.00",
      currency: "EUR",
    },
    status: "active",
    expiresAt: "2026-12-01T00:00:00Z",
    cardReady: true,
    ...overrides,
  };
}

const payment = {
  kind: "payment" as const,
  requestId: "req-pay",
  question: "Authorize a card payment",
  expiresAt: null,
  amount: { amount: "31.20", currency: "EUR", exact: true },
  merchant: { name: "Amazon", url: "https://www.amazon.es", countryCode: "ES" },
  actionUrl: "https://menta.example/checkouts/run-1",
};

function view(overrides: Partial<CheckoutView> = {}): CheckoutView {
  return {
    runId: "run-1",
    revision: 1,
    status: "awaiting_input",
    createdAt: null,
    startUrl: "https://www.amazon.es/",
    store: "amazon.es",
    task: "Buy socks",
    maxCost: { amount: "60.00", currency: "EUR" },
    usesSavedDetails: false,
    shipsTo: null,
    fulfillment: "delivery",
    liveViewUrl: null,
    pending: payment,
    progress: null,
    result: null,
    ...overrides,
  };
}

describe("which spending limit covers a payment", () => {
  it("follows Crossmint's reuse rule, and needs a card that can pay", () => {
    expect(covers(limit(), payment, NOW)).toBe(true);
    expect(covers(limit({ status: "cancelled" }), payment, NOW)).toBe(false);
    expect(
      covers(limit({ expiresAt: "2026-11-01T00:00:00Z" }), payment, NOW),
    ).toBe(false);
    expect(
      covers(
        limit({ amount: { ...limit().amount, currency: "USD" } }),
        payment,
        NOW,
      ),
    ).toBe(false);
    expect(
      covers(
        limit({ amount: { ...limit().amount, available: "31.19" } }),
        payment,
        NOW,
      ),
    ).toBe(false);
    expect(covers(limit({ cardReady: false }), payment, NOW)).toBe(false);
    const elsewhere = {
      name: "Zara",
      url: "https://www.zara.com",
      countryCode: "ES",
    };
    expect(covers(limit({ merchant: elsewhere }), payment, NOW)).toBe(false);
    const here = {
      name: "Amazon",
      url: "https://amazon.es",
      countryCode: "ES",
    };
    expect(covers(limit({ merchant: here }), payment, NOW)).toBe(true);
  });

  it("never matches an amount it can't read", () => {
    for (const amount of ["", " ", "abc", "31,20", "-5"]) {
      expect(
        covers(
          limit(),
          { ...payment, amount: { ...payment.amount, amount } },
          NOW,
        ),
      ).toBe(false);
    }
    expect(
      covers(
        limit({ amount: { ...limit().amount, available: "" } }),
        payment,
        NOW,
      ),
    ).toBe(false);
  });
});

describe("paying with the spending limit the assistant picked", () => {
  function setup(
    limits: OrderIntentView[] | null,
    current: CheckoutView = view(),
    {
      answer = async () => null,
      credentials = true,
    }: {
      answer?: () => Promise<"payment" | "other" | null>;
      credentials?: boolean;
    } = {},
  ) {
    const respond = vi.fn(async () => undefined);
    const checkouts = {
      get: vi.fn(async () => current),
      respond,
      answer: vi.fn(answer),
    } as unknown as Checkouts;
    const mint = vi.fn(async () =>
      credentials
        ? {
            apiKey: "ck_production_x",
            jwt: "JWT_CANARY",
            email: "ada@example.invalid",
            expiresAt: NOW + 300_000,
          }
        : null,
    );
    const fetch = vi.fn(async () =>
      Response.json(
        (limits ?? []).map(({ cardReady, ...item }) => ({
          ...item,
          rails: cardReady
            ? [
                {
                  rail: "agentic-token",
                  status: "active",
                  credentialFormats: ["card"],
                },
              ]
            : [
                {
                  rail: "agentic-token",
                  status: "pending_verification",
                  credentialFormats: ["card"],
                },
              ],
        })),
        { status: limits ? 200 : 500 },
      ),
    );
    const payments = createLimitPayments({
      checkouts,
      mint,
      origin: "https://menta.example",
      now: () => NOW,
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    return { payments, respond, answer: checkouts.answer };
  }

  it("lists the limits that can pay now, with no card details", async () => {
    const { payments } = setup([
      limit(),
      limit({ orderIntentId: "oi-gone", status: "cancelled" }),
      limit({ orderIntentId: "oi-check", cardReady: false }),
      limit({
        orderIntentId: "oi-shop",
        description: "Food delivery",
        merchant: {
          name: null,
          url: "https://www.ubereats.com/",
          countryCode: null,
        },
      }),
    ]);
    const listed = await payments.list("user-1");
    expect(listed).toEqual([
      {
        id: "oi-1",
        name: "Shopping",
        left: { amount: "120.00", currency: "EUR" },
        total: { amount: "200.00", currency: "EUR" },
        store: null,
        expiresAt: "2026-12-01T00:00:00Z",
      },
      expect.objectContaining({ id: "oi-shop", store: "ubereats.com" }),
    ]);
    expect(JSON.stringify(listed)).not.toContain("pm-1");
    expect(JSON.stringify(listed)).not.toContain("JWT_CANARY");
  });

  it("pays with the picked limit once, with the payment's one message ID", async () => {
    const { payments, respond } = setup([limit()]);
    expect(await payments.pay("user-1", "run-1", "oi-1")).toEqual({
      requestId: "req-pay",
      paid: {
        limit: "Shopping",
        amount: { amount: "31.20", currency: "EUR", exact: true },
        left: { amount: "88.80", currency: "EUR" },
      },
    });
    expect(respond).toHaveBeenCalledWith(
      "user-1",
      "run-1",
      paymentMessageId("user-1", "run-1", "req-pay"),
      { requestId: "req-pay", orderIntentId: "oi-1" },
    );
  });

  it("refuses a limit that isn't the user's or doesn't cover the payment", async () => {
    const elsewhere = limit({
      orderIntentId: "oi-uber",
      merchant: {
        name: null,
        url: "https://www.ubereats.com",
        countryCode: null,
      },
    });
    const { payments, respond } = setup([limit(), elsewhere]);
    expect(await payments.pay("user-1", "run-1", "oi-someone")).toMatchObject({
      problem: expect.stringContaining("isn't one of the user's"),
    });
    expect(await payments.pay("user-1", "run-1", "oi-uber")).toMatchObject({
      problem: expect.stringContaining("can't pay 31.20 EUR at amazon.es"),
    });
    // The MCP tool swaps this ending for the card on hosts that draw it.
    expect(await payments.pay("user-1", "run-1", "oi-uber")).toMatchObject({
      problem: expect.stringMatching(
        /Pick another, or call request_spending_limit\.$/,
      ),
    });
    expect(respond).not.toHaveBeenCalled();
  });

  it("never answers a payment twice, nor one that isn't open", async () => {
    const answered = setup([limit()], view(), {
      answer: async () => "payment",
    });
    expect(await answered.payments.pay("user-1", "run-1", "oi-1")).toEqual({
      answered: "req-pay",
    });
    expect(answered.respond).not.toHaveBeenCalled();
    // Already paid but still shown open: answered, not "pick another".
    const spent = setup(
      [limit({ amount: { ...limit().amount, available: "0.00" } })],
      view(),
      { answer: async () => "payment" },
    );
    expect(await spent.payments.pay("user-1", "run-1", "oi-1")).toEqual({
      answered: "req-pay",
    });
    const unreadable = setup([limit()], view(), {
      answer: async () => {
        throw new Error("messages unavailable");
      },
    });
    expect(
      await unreadable.payments.pay("user-1", "run-1", "oi-1"),
    ).toMatchObject({ problem: expect.stringContaining("Try again") });
    expect(unreadable.respond).not.toHaveBeenCalled();
    const running = setup(
      [limit()],
      view({ status: "running", pending: null }),
    );
    expect(await running.payments.pay("user-1", "run-1", "oi-1")).toMatchObject(
      {
        problem: expect.stringContaining("No payment is waiting"),
      },
    );
    expect(running.respond).not.toHaveBeenCalled();
  });

  it("says so when the limits can't be read", async () => {
    const { payments } = setup(null);
    expect(await payments.list("user-1")).toBeNull();
    expect(await payments.pay("user-1", "run-1", "oi-1")).toMatchObject({
      problem: expect.stringContaining("Couldn't read"),
    });
    const noSession = setup([limit()], view(), { credentials: false });
    expect(await noSession.payments.list("user-1")).toBeNull();
  });
});

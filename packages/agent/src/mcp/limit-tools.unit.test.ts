import type { McpServer } from "@modelcontextprotocol/server";
import type {
  Checkouts,
  CheckoutView,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it, vi } from "vitest";
import type { LimitPayments } from "../limit-payments.js";
import { limitRequestKey, openLimitRequest } from "../limit-requests.js";
import {
  LIMIT_REQUEST_TOOL,
  LIMITS_TOOL,
  linkPaymentsToLimits,
  PAY_TOOL,
  paymentLimitRequest,
  registerLimitPayTools,
  registerLimitTools,
} from "./limit-tools.js";

const key = limitRequestKey({ STYTCH_SECRET: "secret-1" }) as Buffer;

type Handler = (input: Record<string, unknown>) => Promise<{
  isError?: boolean;
  structuredContent?: { url: string; next: string };
  content: { text: string }[];
}>;

function setup(get: Checkouts["get"] = vi.fn()) {
  let handler: Handler | null = null;
  const server = {
    registerTool: vi.fn((name: string, _config: unknown, run: Handler) => {
      expect(name).toBe(LIMIT_REQUEST_TOOL);
      handler = run;
    }),
  } as unknown as McpServer;
  registerLimitTools(server, {
    userId: "user-1",
    checkouts: { get } as unknown as Checkouts,
    origin: "https://menta.invalid",
    via: "claude",
    key,
  });
  return (input: Record<string, unknown>) =>
    (handler as unknown as Handler)(input);
}

const asked = {
  name: "Groceries",
  amount: "150",
  currency: "EUR",
  expires: "month",
  store: "amazon.es",
};

describe("request_spending_limit", () => {
  it("links to a page sealed for the signed-in user, saying who asked", async () => {
    const result = await setup()(asked);
    const url = result.structuredContent?.url ?? "";
    expect(url).toMatch(/^https:\/\/menta\.invalid\/spending-limit\/[\w-]+$/);
    expect(url).not.toContain("Groceries");
    const token = url.split("/").pop() as string;
    expect(openLimitRequest(key, "user-1", token)).toEqual({
      ...asked,
      via: "claude",
    });
    expect(openLimitRequest(key, "user-2", token)).toBeNull();
    expect(result.structuredContent?.next).toMatch(/exactly as returned/);
  });

  it("only names a checkout of the user's own", async () => {
    const get = vi.fn(async () => {
      throw new Error("not found");
    });
    const result = await setup(get as unknown as Checkouts["get"])({
      ...asked,
      runId: "run-other",
    });
    expect(get).toHaveBeenCalledWith("user-1", "run-other");
    expect(result.isError).toBe(true);
  });

  it("pays a checkout only with a limit that covers it, and keeps following it", async () => {
    const get = vi.fn(async () => paying);
    const ask = setup(get as unknown as Checkouts["get"]);
    const generic = {
      name: "Food delivery",
      amount: "50",
      currency: "USD",
      expires: "month",
      runId: "run-1",
    };
    expect((await ask({ ...generic, amount: "31.20" })).isError).toBe(true);
    expect((await ask({ ...generic, currency: "EUR" })).isError).toBe(true);
    expect((await ask({ ...generic, store: "amazon.com" })).isError).toBe(true);
    expect(
      (await ask({ ...generic, store: "www.UberEats.com" })).isError,
    ).toBeFalsy();
    const result = await ask(generic);
    expect(result.isError).toBeFalsy();
    const token = result.structuredContent?.url.split("/").pop() as string;
    expect(openLimitRequest(key, "user-1", token)).toEqual({
      ...generic,
      via: "claude",
    });
    expect(result.structuredContent?.next).toContain(
      'Then call continue with runId "run-1" and afterRequestId "req-1".',
    );
  });
});

const paying = {
  runId: "run-1",
  store: "ubereats.com",
  pending: {
    kind: "payment",
    requestId: "req-1",
    question: "Approve",
    expiresAt: null,
    amount: { amount: "31.205", currency: "usd", exact: true },
    merchant: {
      name: "Uber Eats",
      url: "https://www.ubereats.com/store/1",
      countryCode: "US",
    },
    actionUrl: "https://menta.invalid/checkouts/run-1",
  },
} as unknown as CheckoutView;

describe("payment steps", () => {
  it("ask for a spending limit for that payment", () => {
    expect(paymentLimitRequest(paying, "grok")).toEqual({
      name: "Uber Eats order",
      amount: "31.21",
      currency: "USD",
      expires: "week",
      store: "ubereats.com",
      runId: "run-1",
      via: "grok",
    });
  });

  it("link to the request page, and only payments", async () => {
    const secret = {
      ...paying,
      pending: { ...paying.pending, kind: "protected" },
    } as unknown as CheckoutView;
    const checkouts = {
      get: vi.fn(async (_user: string, runId: string) =>
        runId === "run-1" ? paying : secret,
      ),
    } as unknown as Checkouts;
    const linked = linkPaymentsToLimits(checkouts, {
      userId: "user-1",
      origin: "https://menta.invalid",
      via: null,
      key,
    });
    const payment = await linked.get("user-1", "run-1");
    const url = new URL(
      (payment.pending as { actionUrl: string } | null)?.actionUrl ?? "",
    );
    expect(url.pathname).toMatch(/^\/spending-limit\//);
    expect(
      openLimitRequest(key, "user-1", url.pathname.split("/").pop() as string),
    ).toMatchObject({ runId: "run-1", amount: "31.21" });
    expect(await linked.get("user-1", "run-2")).toBe(secret);
  });
});

describe("spending_limits and pay_with_spending_limit", () => {
  function tools(payments: LimitPayments, cards = false) {
    const handlers = new Map<
      string,
      (input: Record<string, unknown>) => Promise<{
        isError?: boolean;
        structuredContent?: Record<string, unknown>;
        content: { text: string }[];
      }>
    >();
    const server = {
      registerTool: vi.fn((name: string, _config: unknown, run: never) => {
        handlers.set(name, run);
      }),
    } as unknown as McpServer;
    registerLimitPayTools(server, { userId: "user-1", payments, cards });
    return handlers;
  }

  it("lists the user's limits and pays with the one picked, for the signed-in user", async () => {
    const payments = {
      list: vi.fn(async () => [{ id: "oi-1", name: "Food delivery" }]),
      pay: vi.fn(async () => ({
        requestId: "req-pay",
        paid: {
          limit: "Food delivery",
          amount: { amount: "31.20", currency: "USD", exact: true },
          left: { amount: "68.80", currency: "USD" },
        },
      })),
    } as unknown as LimitPayments;
    const handlers = tools(payments);
    const listed = await handlers.get(LIMITS_TOOL)?.({});
    expect(payments.list).toHaveBeenCalledWith("user-1");
    expect(listed?.structuredContent?.limits).toEqual([
      { id: "oi-1", name: "Food delivery" },
    ]);
    const paid = await handlers.get(PAY_TOOL)?.({
      runId: "run-1",
      limitId: "oi-1",
    });
    expect(payments.pay).toHaveBeenCalledWith("user-1", "run-1", "oi-1");
    expect(paid?.structuredContent?.next).toContain(
      'from the user\'s "Food delivery" spending limit (68.80 USD left)',
    );
    expect(paid?.structuredContent?.next).toContain(
      'call continue with runId "run-1" and afterRequestId "req-pay"',
    );
  });

  it("marks paying destructive: a payment can't be undone", () => {
    const server = { registerTool: vi.fn() } as unknown as McpServer;
    registerLimitPayTools(server, {
      userId: "user-1",
      payments: {} as LimitPayments,
    });
    const pay = vi
      .mocked(server.registerTool)
      .mock.calls.find((call) => call[0] === PAY_TOOL)?.[1] as {
      annotations: object;
    };
    expect(pay.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    });
  });

  it("never mention a card, for hosts without the Menta card", () => {
    const server = { registerTool: vi.fn() } as unknown as McpServer;
    registerLimitPayTools(server, {
      userId: "user-1",
      payments: {} as LimitPayments,
    });
    const configs = vi
      .mocked(server.registerTool)
      .mock.calls.map((call) => call[1] as { description: string });
    expect(configs).toHaveLength(2);
    for (const { description } of configs) {
      expect(description).not.toMatch(/\bcards?\b/i);
    }
  });

  it("sends a host that draws the card to it when no limit fits", async () => {
    const server = { registerTool: vi.fn() } as unknown as McpServer;
    registerLimitPayTools(server, {
      userId: "user-1",
      payments: { list: vi.fn(async () => []) } as unknown as LimitPayments,
      cards: true,
    });
    const calls = vi.mocked(server.registerTool).mock.calls;
    const pay = calls.find((call) => call[0] === PAY_TOOL)?.[1] as {
      description: string;
    };
    expect(pay.description).toContain(
      "if none fits, call show_checkout_step with the checkout's runId",
    );
    expect(pay.description).not.toContain("request_spending_limit");
    const list = calls.find(
      (call) => call[0] === LIMITS_TOOL,
    )?.[2] as unknown as (
      input: object,
    ) => Promise<{ structuredContent?: { next?: string } }>;
    const listed = await list({});
    expect(listed.structuredContent?.next).toContain("show_checkout_step");
    expect(listed.structuredContent?.next).not.toContain(
      "request_spending_limit",
    );
    // Not a second card for a payment the card already shows.
    expect(listed.structuredContent?.next).toContain(
      "if the card already shows this payment, don't call it again",
    );
  });

  it("points a limit that can't pay to the card on a host that draws it", async () => {
    const problem =
      '"Groceries" can\'t pay 31.20 EUR at amazon.es: it must be active, in that currency, have enough left and be for any store or that one. Pick another, or call request_spending_limit.';
    const payments = {
      list: vi.fn(async () => []),
      pay: vi.fn(async () => ({ problem })),
    } as unknown as LimitPayments;
    const args = { runId: "run-1", limitId: "oi-1" };
    const card = await tools(payments, true).get(PAY_TOOL)?.(args);
    expect(card?.isError).toBe(true);
    expect(card?.content[0]?.text).toContain(
      "Pick another, or call show_checkout_step with the checkout's runId",
    );
    expect(card?.content[0]?.text).not.toContain("request_spending_limit");
    const plain = await tools(payments).get(PAY_TOOL)?.(args);
    expect(plain?.content[0]?.text).toBe(problem);
  });

  it("follows a payment someone already answered instead of paying it again", async () => {
    const payments = {
      list: vi.fn(async () => []),
      pay: vi.fn(async () => ({ answered: "req-pay" })),
    } as unknown as LimitPayments;
    const handlers = tools(payments);
    const answered = await handlers.get(PAY_TOOL)?.({
      runId: "run-1",
      limitId: "oi-1",
    });
    expect(answered?.isError).toBe(true);
    expect(answered?.content[0]?.text).toContain(
      'call continue with runId "run-1" and afterRequestId "req-pay"',
    );
  });

  it("passes on Menta's refusal", async () => {
    const payments = {
      list: vi.fn(async () => null),
      pay: vi.fn(async () => ({
        problem: "No payment is waiting on that checkout.",
      })),
    } as unknown as LimitPayments;
    const handlers = tools(payments);
    expect((await handlers.get(LIMITS_TOOL)?.({}))?.isError).toBe(true);
    const refused = await handlers.get(PAY_TOOL)?.({
      runId: "run-1",
      limitId: "oi-1",
    });
    expect(refused?.isError).toBe(true);
    expect(refused?.content[0]?.text).toContain("No payment is waiting");
  });
});

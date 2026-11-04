import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareCardsForOrderIntents } from "./cards.js";

const JWT = "aaa.JWT_CANARY.ccc";
const KEY = "ck_production_KEY_CANARY";
const base = {
  apiKey: KEY,
  jwt: JWT,
  email: "me@example.invalid",
  origin: "https://commerce.invalid",
};

afterEach(() => vi.restoreAllMocks());

type Call = { url: string; init: RequestInit };

/** A Crossmint stand-in: `routes` answers by method and path suffix. */
function fakeFetch(
  routes: (call: Call) => Response | Promise<Response> | "throw",
) {
  const calls: Call[] = [];
  const send = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const answer = await routes(call);
    if (answer === "throw") {
      throw new TypeError("fetch failed JWT_CANARY");
    }
    return answer;
  }) as typeof fetch;
  return { send, calls };
}

const list = (data: unknown[]) => Response.json({ data, nextCursor: null });
const card = (paymentMethodId: string) => ({
  paymentMethodId,
  type: "card",
  card: { brand: "visa", last4: "1111" },
});

describe("prepareCardsForOrderIntents", () => {
  it("enrolls every saved card with the buyer's email", async () => {
    const { send, calls } = fakeFetch(({ url }) =>
      url.includes("/order-intent-registration")
        ? Response.json({ paymentMethodId: "x", rails: [] })
        : list([
            card("pm-1"),
            card("pm-2"),
            { paymentMethodId: "pm-bank", type: "bank-account-us" },
          ]),
    );
    const result = await prepareCardsForOrderIntents({ ...base, fetch: send });

    expect(result).toEqual({
      cards: [
        {
          paymentMethodId: "pm-1",
          brand: "visa",
          last4: "1111",
          expiration: null,
          isDefault: false,
        },
        {
          paymentMethodId: "pm-2",
          brand: "visa",
          last4: "1111",
          expiration: null,
          isDefault: false,
        },
      ],
      registered: ["pm-1", "pm-2"],
      failed: [],
    });
    expect(calls[0]?.url).toBe(
      "https://www.crossmint.com/api/2026-09-16/payment-methods?type=card&limit=100",
    );
    expect(calls[0]?.init.headers).toMatchObject({
      "x-api-key": KEY,
      authorization: `Bearer ${JWT}`,
      origin: "https://commerce.invalid",
    });
    const puts = calls.slice(1);
    expect(puts.map((call) => call.url)).toEqual([
      "https://www.crossmint.com/api/unstable/payment-methods/pm-1/order-intent-registration",
      "https://www.crossmint.com/api/unstable/payment-methods/pm-2/order-intent-registration",
    ]);
    for (const put of puts) {
      expect(put.init.method).toBe("PUT");
      expect(JSON.parse(String(put.init.body))).toEqual({
        email: "me@example.invalid",
      });
    }
  });

  it("uses staging for a staging key", async () => {
    const { send, calls } = fakeFetch(() => list([]));
    await prepareCardsForOrderIntents({
      ...base,
      apiKey: "ck_staging_test",
      fetch: send,
    });
    expect(calls[0]?.url).toMatch(/^https:\/\/staging\.crossmint\.com\/api\//);
  });

  it("lists without enrolling when there's no email", async () => {
    const { send, calls } = fakeFetch(() => list([card("pm-1")]));
    expect(
      await prepareCardsForOrderIntents({ ...base, email: " ", fetch: send }),
    ).toMatchObject({
      cards: [{ paymentMethodId: "pm-1" }],
      registered: [],
      failed: [],
    });
    expect(calls).toHaveLength(1);
  });

  it("returns display fields only, default card first", async () => {
    const { send } = fakeFetch(({ url }) =>
      url.includes("/order-intent-registration")
        ? Response.json({})
        : list([
            card("pm-old"),
            {
              paymentMethodId: "pm-default",
              type: "card",
              default: true,
              displayName: "Amex ••1001",
              card: {
                brand: "amex",
                last4: "1001",
                bin: "BIN_CANARY",
                expiration: { month: "09", year: "2030" },
                source: { type: "basis-theory-token", id: "TOKEN_CANARY" },
                billing: { name: "NAME_CANARY" },
              },
            },
          ]),
    );
    const result = await prepareCardsForOrderIntents({ ...base, fetch: send });
    expect(result.cards).toEqual([
      {
        paymentMethodId: "pm-default",
        brand: "amex",
        last4: "1001",
        expiration: { month: "09", year: "2030" },
        isDefault: true,
      },
      {
        paymentMethodId: "pm-old",
        brand: "visa",
        last4: "1111",
        expiration: null,
        isDefault: false,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("CANARY");
  });

  it("keeps going when one card fails, and logs no secrets", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { send } = fakeFetch(({ url }) => {
      if (url.includes("pm-bad")) {
        return Response.json(
          { code: "CONSUMER_EMAIL_REQUIRED", message: "JWT_CANARY" },
          { status: 400 },
        );
      }
      if (url.includes("pm-down")) {
        return "throw";
      }
      return url.includes("/order-intent-registration")
        ? Response.json({})
        : list([card("pm-ok"), card("pm-bad"), card("pm-down")]);
    });
    const result = await prepareCardsForOrderIntents({ ...base, fetch: send });

    expect(result).toMatchObject({
      registered: ["pm-ok"],
      failed: ["pm-bad", "pm-down"],
    });
    expect(result.cards).toHaveLength(3);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("pm-bad (400 CONSUMER_EMAIL_REQUIRED)");
    expect(logged).toContain("pm-down (network error)");
    expect(logged).not.toContain("CANARY");
    expect(logged).not.toContain("me@example.invalid");
  });

  it("never throws when listing fails or answers oddly", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const answer of [
      () => new Response("nope", { status: 401 }),
      () => Response.json({ items: [] }),
      () => "throw" as const,
    ]) {
      const { send, calls } = fakeFetch(answer);
      expect(
        await prepareCardsForOrderIntents({ ...base, fetch: send }),
      ).toEqual({ cards: null, registered: [], failed: [] });
      expect(calls).toHaveLength(1);
    }
    expect(JSON.stringify(warn.mock.calls)).not.toContain("CANARY");
  });

  it("gives up when Crossmint is slow", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { send } = fakeFetch(
      ({ init }) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    const started = Date.now();
    expect(
      await prepareCardsForOrderIntents({
        ...base,
        timeoutMs: 50,
        fetch: send,
      }),
    ).toEqual({ cards: null, registered: [], failed: [] });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(console.warn).toHaveBeenCalledWith(
      "Couldn't list cards (timed out).",
    );
  });
});

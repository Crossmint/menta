import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelOrderIntent, listOrderIntents } from "./order-intents.js";

const JWT = "aaa.JWT_CANARY.ccc";
const KEY = "ck_production_KEY_CANARY";
const base = { apiKey: KEY, jwt: JWT, origin: "https://commerce.invalid" };

afterEach(() => vi.restoreAllMocks());

function fakeFetch(answer: () => Response | "throw") {
  const calls: { url: string; init: RequestInit }[] = [];
  const send = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const response = answer();
    if (response === "throw") {
      throw new TypeError("fetch failed JWT_CANARY");
    }
    return response;
  }) as typeof fetch;
  return { send, calls };
}

const intent = (id: string, expiresAt: string, extra: object = {}) => ({
  orderIntentId: id,
  paymentMethodId: "pm_1",
  description: "Trail shoes",
  merchant: {
    name: "Laufwerk",
    url: "https://laufwerk.example",
    countryCode: "DE",
  },
  amount: {
    total: "89.00",
    spent: "0",
    available: "89.00",
    reserved: "0",
    currency: "EUR",
  },
  rails: [
    { rail: "encrypted-card", status: "active", credentialFormats: ["card"] },
  ],
  status: "active",
  expiresAt,
  verificationConfig: {
    allowanceId: "a",
    environment: "production",
    publicApiKey: "pk",
  },
  ...extra,
});

describe("listOrderIntents", () => {
  it("lists the user's approvals, newest expiry first, without rails or verification config", async () => {
    const { send, calls } = fakeFetch(() =>
      Response.json([
        intent("oi_old", "2026-10-01T00:00:00Z"),
        intent("oi_new", "2026-10-20T00:00:00Z"),
      ]),
    );
    const list = await listOrderIntents({ ...base, fetch: send });
    expect(list?.map((item) => item.orderIntentId)).toEqual([
      "oi_new",
      "oi_old",
    ]);
    expect(list?.[0]).not.toHaveProperty("rails");
    expect(list?.[0]).not.toHaveProperty("verificationConfig");
    expect(list?.[0]?.merchant).toEqual({
      name: "Laufwerk",
      url: "https://laufwerk.example",
      countryCode: "DE",
    });
    expect(calls[0]?.url).toBe(
      "https://www.crossmint.com/api/unstable/order-intents",
    );
    expect(calls[0]?.init.headers).toMatchObject({
      "x-api-key": KEY,
      authorization: `Bearer ${JWT}`,
    });
  });

  it("puts approvals that can still be charged first", async () => {
    const { send } = fakeFetch(() =>
      Response.json([
        intent("oi_cancelled", "2026-10-30T00:00:00Z", { status: "cancelled" }),
        intent("oi_active", "2026-10-20T00:00:00Z"),
      ]),
    );
    const list = await listOrderIntents({ ...base, fetch: send });
    expect(list?.map((item) => item.orderIntentId)).toEqual([
      "oi_active",
      "oi_cancelled",
    ]);
  });

  it("skips an approval it can't read instead of dropping the list", async () => {
    const { send } = fakeFetch(() =>
      Response.json([
        intent("oi_ok", "2026-10-20T00:00:00Z"),
        intent("oi_new_status", "2026-10-21T00:00:00Z", { status: "paused" }),
      ]),
    );
    const list = await listOrderIntents({ ...base, fetch: send });
    expect(list?.map((item) => item.orderIntentId)).toEqual(["oi_ok"]);
  });

  it("returns null on errors and never logs credentials", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const answer of [
      () => new Response("no", { status: 403 }),
      () => "throw" as const,
    ]) {
      const { send } = fakeFetch(answer);
      expect(await listOrderIntents({ ...base, fetch: send })).toBeNull();
    }
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("CANARY");
  });
});

describe("cancelOrderIntent", () => {
  it("deletes the approval and reports whether Crossmint accepted it", async () => {
    const ok = fakeFetch(() => new Response(null, { status: 204 }));
    expect(
      await cancelOrderIntent({
        ...base,
        orderIntentId: "oi/1",
        fetch: ok.send,
      }),
    ).toBe(true);
    expect(ok.calls[0]?.url).toBe(
      "https://www.crossmint.com/api/unstable/order-intents/oi%2F1",
    );
    expect(ok.calls[0]?.init.method).toBe("DELETE");

    vi.spyOn(console, "warn").mockImplementation(() => {});
    const refused = fakeFetch(() => new Response(null, { status: 403 }));
    expect(
      await cancelOrderIntent({
        ...base,
        orderIntentId: "oi_1",
        fetch: refused.send,
      }),
    ).toBe(false);
  });
});

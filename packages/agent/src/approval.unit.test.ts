import {
  type OrderIntent,
  type OrderIntentRail,
  OrderIntentsApiError,
} from "@crossmint/client-sdk-base";
import { describe, expect, it, vi } from "vitest";
import {
  type ApprovalApi,
  approvalMessages,
  cardExpiry,
  cardLabel,
  closedByUser,
  confirmRail,
  enrollAddedCard,
  type PaymentRequest,
  settle,
  startApproval,
} from "./approval.js";

const request: PaymentRequest = {
  amount: { value: "25.00", currency: "USD" },
  merchant: {
    name: "Liquid Death",
    url: "https://liquiddeath.com",
    countryCode: "US",
  },
  description: "Chewed To Death Cat Toy",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

const verificationConfig = {
  environment: "production" as const,
  publicApiKey: "bt-public",
  allowanceId: "allowance-1",
};

const vic = (status: "active" | "pending_verification"): OrderIntentRail => ({
  rail: "agentic-token",
  provider: "vic",
  status,
  credentialFormats: ["card"],
});
const encrypted = (
  status: "active" | "pending_cvc_recollection",
): OrderIntentRail => ({
  rail: "encrypted-card",
  status,
  credentialFormats: ["card"],
});

function intent(
  rails: OrderIntentRail[],
  extra: Partial<OrderIntent> = {},
): OrderIntent {
  return {
    orderIntentId: "oi-1",
    paymentMethodId: "pm-1",
    status: "active",
    amount: {
      total: "25.00",
      spent: "0",
      reserved: "0",
      available: "25.00",
      currency: "USD",
    },
    description: request.description,
    rails,
    expiresAt: request.expiresAt as string,
    ...extra,
  } as OrderIntent;
}

/** A Crossmint stand-in answering create and get in order. */
function fakeApi({
  created = [] as (OrderIntent | Error)[],
  reads = [] as (OrderIntent | Error)[],
} = {}) {
  const next = (queue: (OrderIntent | Error)[]) => {
    const value = queue.shift();
    if (!value) {
      throw new Error("unexpected call");
    }
    return value instanceof Error
      ? Promise.reject(value)
      : Promise.resolve(value);
  };
  const api = {
    createOrderIntent: vi.fn(() => next(created)),
    getOrderIntent: vi.fn((_id: string) => next(reads)),
    register: vi.fn(async (paymentMethodId: string) => ({
      paymentMethodId,
      rails: [],
    })),
  };
  return api as typeof api & ApprovalApi;
}

const start = (api: ApprovalApi, email: string | null = "me@example.invalid") =>
  startApproval(api, { paymentMethodId: "pm-1", request, email });
const instant = { sleep: async () => undefined };

describe("startApproval", () => {
  it("approves right away when the card's rail is active", async () => {
    const api = fakeApi({ created: [intent([vic("active")])] });
    expect(await start(api)).toEqual({ kind: "done", orderIntentId: "oi-1" });
    expect(api.createOrderIntent).toHaveBeenCalledWith({
      paymentMethodId: "pm-1",
      amount: request.amount,
      merchant: request.merchant,
      description: request.description,
      expiresAt: request.expiresAt,
    });
    expect(api.register).not.toHaveBeenCalled();
  });

  it("asks for the card network's verification, then waits for the rail", async () => {
    const pending = intent([vic("pending_verification")], {
      verificationConfig,
    });
    const api = fakeApi({
      created: [pending],
      reads: [
        intent([vic("pending_verification")], { verificationConfig }),
        intent([vic("active")]),
      ],
    });
    const outcome = await start(api);
    expect(outcome).toEqual({
      kind: "verify",
      orderIntent: pending,
      rail: { rail: "agentic-token", provider: "vic" },
    });
    if (outcome.kind !== "verify") {
      throw new Error("expected verify");
    }
    const sleep = vi.fn(async () => undefined);
    expect(await confirmRail(api, "oi-1", outcome.rail, { sleep })).toEqual({
      kind: "done",
      orderIntentId: "oi-1",
    });
    expect(api.getOrderIntent).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("asks for the security code again on an encrypted card", async () => {
    const api = fakeApi({
      created: [intent([encrypted("pending_cvc_recollection")])],
      reads: [intent([encrypted("active")])],
    });
    const outcome = await start(api);
    expect(outcome).toEqual({
      kind: "cvc",
      orderIntentId: "oi-1",
      rail: { rail: "encrypted-card" },
    });
    if (outcome.kind !== "cvc") {
      throw new Error("expected cvc");
    }
    expect(await confirmRail(api, "oi-1", outcome.rail, instant)).toEqual({
      kind: "done",
      orderIntentId: "oi-1",
    });
  });

  it("says plainly when a card has no usable rail", async () => {
    const amex = intent([
      {
        rail: "agentic-token",
        provider: "vic",
        status: "error",
        error: { code: "card_not_eligible" },
        credentialFormats: ["card"],
      },
    ]);
    expect(await start(fakeApi({ created: [amex] }))).toEqual({
      kind: "failed",
      message: approvalMessages.noRail,
    });
    // A network that won't give this store an allowance says so; the card is fine.
    const visaRefused = intent([
      {
        rail: "agentic-token",
        provider: "vic",
        status: "error",
        error: { code: "PROVIDER_ALLOWANCE_FAILED" },
        credentialFormats: ["card", "network-token"],
      },
      {
        rail: "spt",
        provider: "stripe",
        status: "active",
        credentialFormats: ["identifier"],
      },
    ]);
    expect(await start(fakeApi({ created: [visaRefused] }))).toEqual({
      kind: "failed",
      message: approvalMessages.storeRefused.vic,
    });
    // Verification without a config to run it is no rail either.
    expect(
      await start(
        fakeApi({ created: [intent([vic("pending_verification")])] }),
      ),
    ).toEqual({ kind: "failed", message: approvalMessages.noRail });
    // Crossmint can refuse to create the intent for the same reason.
    const refused = new OrderIntentsApiError(
      "Payment method pm-1 has no active order-intent rails. Check its order-intent registration",
      400,
      "/api/unstable/order-intents",
    );
    expect(await start(fakeApi({ created: [refused] }))).toEqual({
      kind: "failed",
      message: approvalMessages.noRail,
    });
  });

  it("enrolls a card Crossmint hasn't registered, then tries once more", async () => {
    const missing = new OrderIntentsApiError(
      "Payment method pm-1 does not have an order-intent registration",
      404,
      "/api/unstable/order-intents",
    );
    const api = fakeApi({ created: [missing, intent([vic("active")])] });
    expect(await start(api)).toEqual({ kind: "done", orderIntentId: "oi-1" });
    expect(api.register).toHaveBeenCalledWith("pm-1", {
      email: "me@example.invalid",
    });
    expect(api.createOrderIntent).toHaveBeenCalledTimes(2);

    // Only once.
    const twice = fakeApi({ created: [missing, missing] });
    expect(await start(twice)).toEqual({
      kind: "failed",
      message: approvalMessages.create,
    });
    expect(twice.register).toHaveBeenCalledTimes(1);

    // Without an email there's nothing to enroll with.
    const anonymous = fakeApi({ created: [missing] });
    expect(await start(anonymous, null)).toEqual({
      kind: "failed",
      message: approvalMessages.create,
    });
    expect(anonymous.register).not.toHaveBeenCalled();

    const refused = fakeApi({ created: [missing] });
    refused.register.mockRejectedValueOnce(new Error("nope"));
    expect(await start(refused)).toEqual({
      kind: "failed",
      message: approvalMessages.register,
    });
  });

  it("fails cleanly when the order intent can't be created", async () => {
    for (const error of [
      new OrderIntentsApiError("Internal error", 500, "/x"),
      new TypeError("fetch failed"),
    ]) {
      expect(await start(fakeApi({ created: [error] }))).toEqual({
        kind: "failed",
        message: approvalMessages.create,
      });
    }
  });

  it("reuses the card's earlier order intent while it's live", async () => {
    const api = fakeApi({ reads: [intent([vic("active")])] });
    expect(
      await startApproval(api, {
        paymentMethodId: "pm-1",
        request,
        email: null,
        existing: "oi-1",
      }),
    ).toEqual({ kind: "done", orderIntentId: "oi-1" });
    expect(api.createOrderIntent).not.toHaveBeenCalled();

    const expired = fakeApi({
      reads: [intent([vic("active")], { status: "expired" })],
      created: [intent([vic("active")], { orderIntentId: "oi-2" })],
    });
    expect(
      await startApproval(expired, {
        paymentMethodId: "pm-1",
        request,
        email: null,
        existing: "oi-1",
      }),
    ).toEqual({ kind: "done", orderIntentId: "oi-2" });
  });

  it("calls an expired order intent expired", async () => {
    const api = fakeApi({
      created: [intent([vic("active")], { status: "expired" })],
    });
    expect(await start(api)).toEqual({
      kind: "failed",
      message: approvalMessages.expired,
    });
  });
});

describe("settle", () => {
  it("asks for the network's check on a card that hasn't failed it", () => {
    expect(
      settle(intent([vic("pending_verification")], { verificationConfig })),
    ).toMatchObject({ kind: "verify" });
  });

  it("skips the check on a card that pays with the encrypted card", () => {
    expect(
      settle(intent([vic("pending_verification")], { verificationConfig }), {
        encryptedOnly: true,
      }),
    ).toEqual({ kind: "done", orderIntentId: "oi-1" });
    // Agent Checkouts uses the encrypted card even when the read doesn't list it.
    expect(settle(intent([]), { encryptedOnly: true })).toEqual({
      kind: "done",
      orderIntentId: "oi-1",
    });
  });

  it("still asks an encrypted card for its security code", () => {
    expect(
      settle(intent([encrypted("pending_cvc_recollection")]), {
        encryptedOnly: true,
      }),
    ).toMatchObject({ kind: "cvc" });
  });

  it("approves nothing when the encrypted card itself is listed failed", () => {
    expect(
      settle(
        intent([
          vic("pending_verification"),
          {
            ...encrypted("active"),
            status: "error",
            error: { code: "declined" },
          } as OrderIntentRail,
        ]),
        { encryptedOnly: true },
      ),
    ).toEqual({ kind: "failed", message: approvalMessages.noRail });
    // When the network turned the store down, it says so.
    expect(
      settle(
        intent([
          {
            rail: "agentic-token",
            provider: "vic",
            status: "error",
            error: { code: "PROVIDER_ALLOWANCE_FAILED" },
            credentialFormats: ["card", "network-token"],
          },
          {
            ...encrypted("active"),
            status: "error",
            error: { code: "declined" },
          } as OrderIntentRail,
        ]),
        { encryptedOnly: true },
      ),
    ).toEqual({ kind: "failed", message: approvalMessages.storeRefused.vic });
  });
});

describe("confirmRail", () => {
  const rail = { rail: "agentic-token", provider: "vic" } as const;

  it("rides out Crossmint hiccups but not a refusal", async () => {
    const api = fakeApi({
      reads: [
        new TypeError("fetch failed"),
        new OrderIntentsApiError("Bad gateway", 502, "/x"),
        intent([vic("active")]),
      ],
    });
    expect(await confirmRail(api, "oi-1", rail, instant)).toMatchObject({
      kind: "done",
    });
    const refused = fakeApi({
      reads: [new OrderIntentsApiError("Forbidden", 403, "/x")],
    });
    expect(await confirmRail(refused, "oi-1", rail, instant)).toEqual({
      kind: "failed",
      message: approvalMessages.check,
    });
  });

  it("falls back to the encrypted card when the network rail fails or stalls", async () => {
    const errored = fakeApi({
      reads: [
        intent([
          {
            ...vic("active"),
            status: "error",
            error: { code: "declined" },
          } as OrderIntentRail,
        ]),
      ],
    });
    // Visa or Mastercard declined the check: the order intent pays with the encrypted card.
    expect(await confirmRail(errored, "oi-1", rail, instant)).toEqual({
      kind: "done",
      orderIntentId: "oi-1",
    });
    // The encrypted card still asks for its security code first.
    expect(
      await confirmRail(
        fakeApi({
          reads: [
            intent([
              {
                ...vic("active"),
                status: "error",
                error: { code: "declined" },
              } as OrderIntentRail,
              encrypted("pending_cvc_recollection"),
            ]),
          ],
        }),
        "oi-1",
        rail,
        instant,
      ),
    ).toMatchObject({ kind: "cvc", orderIntentId: "oi-1" });
    // The encrypted card itself has no fallback.
    expect(
      await confirmRail(
        fakeApi({ reads: [intent([])] }),
        "oi-1",
        { rail: "encrypted-card" },
        instant,
      ),
    ).toEqual({ kind: "failed", message: approvalMessages.check });
    const slow = fakeApi({
      reads: Array.from({ length: 3 }, () =>
        intent([vic("pending_verification")], { verificationConfig }),
      ),
    });
    expect(
      await confirmRail(slow, "oi-1", rail, { ...instant, attempts: 3 }),
    ).toEqual({ kind: "done", orderIntentId: "oi-1" });
  });

  it("stops when the surface goes away", async () => {
    const controller = new AbortController();
    controller.abort();
    const api = fakeApi();
    await confirmRail(api, "oi-1", rail, {
      ...instant,
      signal: controller.signal,
    });
    expect(api.getOrderIntent).not.toHaveBeenCalled();
  });
});

describe("enrollAddedCard", () => {
  it("waits for the enrollment, but never more than 15 seconds, and never throws", async () => {
    vi.useFakeTimers();
    try {
      const enrolled = { register: vi.fn(async () => ({}) as never) };
      await enrollAddedCard(enrolled, "pm-1", "me@example.com");
      expect(enrolled.register).toHaveBeenCalledWith("pm-1", {
        email: "me@example.com",
      });
      expect(vi.getTimerCount()).toBe(0);

      const refused = {
        register: vi.fn(async () => {
          throw new OrderIntentsApiError("Bad gateway", 502, "/x");
        }),
      };
      await expect(
        enrollAddedCard(refused, "pm-1", "me@example.com"),
      ).resolves.toBeUndefined();

      const stalled = { register: vi.fn(() => new Promise<never>(() => {})) };
      let settled = false;
      const waiting = enrollAddedCard(stalled, "pm-1", "me@example.com").then(
        () => {
          settled = true;
        },
      );
      await vi.advanceTimersByTimeAsync(14_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await waiting;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("card display", () => {
  it("shows brand, last four and expiry, nothing else", () => {
    const card = {
      paymentMethodId: "pm-1",
      brand: "visa",
      last4: "4242",
      expiration: { month: "8", year: "2029" },
    };
    expect(cardLabel(card)).toBe("Visa ·· 4242");
    expect(cardExpiry(card)).toBe("Expires 08/29");
    expect(cardExpiry({ ...card, expiration: null })).toBeNull();
    expect(cardLabel({ ...card, brand: "amex" })).toBe("Amex ·· 4242");
  });
});

describe("closedByUser", () => {
  const named = (name: string) => Object.assign(new Error("x"), { name });
  it("tells the user closing the check from the check failing", () => {
    expect(closedByUser(named("VerificationCancelledError"))).toBe(true);
    expect(closedByUser(named("PopupClosedError"))).toBe(true);
    expect(closedByUser(named("VerificationNotSupportedError"))).toBe(false);
    expect(closedByUser(named("CeremonyTimeoutError"))).toBe(false);
    expect(closedByUser(named("PopupBlockedError"))).toBe(false);
    expect(closedByUser("cancelled")).toBe(false);
    expect(closedByUser(undefined)).toBe(false);
  });
});

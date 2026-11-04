import { createHmac } from "node:crypto";
import {
  type Checkouts,
  type CheckoutView,
  forModel,
  toView,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it } from "vitest";
import {
  describe as cardDescribe,
  outcomeLine as cardOutcomeLine,
  stateKey as cardStateKey,
  parseCheckout,
} from "../../card/model.js";
import {
  createMemoryEventStore,
  createSecretBox,
  type EventSubscription,
} from "./event-store.js";
import {
  canonicalJson,
  checkoutEvent,
  createCheckoutEvents,
  ENDED_GRACE_MS,
  EVENT_NAMES,
  endedLongAgo,
  eventDefinitions,
  eventId,
  grantedTtl,
  outcomeLine,
  stateKey,
  statusLabel,
  subscriptionId,
  TTL_MAX_MS,
  TTL_MIN_MS,
} from "./events.js";
import type { WebhookTransport } from "./webhooks.js";

const origin = "https://commerce.invalid";
const LIVE = "https://live.invalid/LIVE_VIEW_CANARY";
const secret = `whsec_${Buffer.alloc(32, 9).toString("base64")}`;
const T0 = Date.parse("2026-10-05T12:00:00.000Z");

function raw(status: string, extra: Record<string, unknown> = {}) {
  return {
    runId: "run-1",
    revision: 1,
    status,
    createdAt: "2026-10-05T11:59:00.000Z",
    input: {
      request: {
        startUrl: "https://www.store.invalid/",
        task: "One mug from https://www.store.invalid/p/mug",
      },
      constraints: { maxCost: { amount: "40.00", currency: "USD" } },
    },
    browser: { embedUrl: LIVE },
    ...extra,
  };
}

function view(status: string, extra: Record<string, unknown> = {}) {
  return toView(
    raw(status, extra) as never,
    (runId) => `${origin}/checkouts/${runId}`,
  );
}

const awaiting = (requestId: string, interaction: Record<string, unknown>) =>
  view("awaiting_input", {
    requiredAction: {
      requestId,
      request: {
        question: "Approve the payment",
        expiresAt: null,
        interaction,
      },
    },
  });

const payment = (requestId = "req-pay", exact = true) =>
  awaiting(requestId, {
    kind: "payment",
    amount: {
      kind: exact ? "exact" : "maximum",
      value: "31.20",
      currency: "USD",
    },
    merchant: {
      name: "Store",
      url: "https://store.invalid",
      countryCode: "US",
    },
  });

const question = awaiting("req-q", {
  kind: "form",
  fields: [
    {
      key: "size",
      label: "Size",
      required: true,
      handling: "standard",
      input: {
        kind: "choice",
        selection: { kind: "one" },
        options: [
          { value: "s", label: "Small" },
          { value: "m", label: "Medium" },
        ],
      },
    },
  ],
});

const protectedStep = awaiting("req-p", {
  kind: "form",
  fields: [
    {
      key: "code",
      label: "Verification code",
      required: true,
      handling: "protected",
      input: { kind: "text" },
    },
  ],
});

const succeeded = (receipt = true) =>
  view("succeeded", {
    result: {
      summary: "Order placed.",
      purchase: receipt
        ? {
            kind: "receipt_captured",
            receipt: {
              total: { value: "31.20", amount: "31.20", currency: "USD" },
              merchantOrderId: "A-100",
            },
          }
        : { kind: "confirmed_without_receipt" },
    },
  });

const outcomes: [string, CheckoutView][] = [
  ["succeeded with receipt", succeeded()],
  ["succeeded without receipt", succeeded(false)],
  [
    "blocked",
    view("blocked", {
      result: { code: "product.item_unavailable", summary: "Sold out." },
    }),
  ],
  [
    "blocked, unknown code",
    view("blocked", { result: { code: "something.new", summary: "Nope." } }),
  ],
  ["failed", view("failed", { reason: "cost_limit" })],
  ["failed, unknown reason", view("failed", { reason: "brand_new" })],
  ["unconfirmed", view("failed", { reason: "reconciliation_required" })],
  ["cancelled", view("cancelled", { result: { summary: "Cancelled." } })],
];

describe("event copy matches our checkout UI", () => {
  it.each(outcomes)("%s: same status and line as the card", (_label, item) => {
    const card = parseCheckout(forModel(item), origin);
    expect(card).not.toBeNull();
    if (!card) {
      return;
    }
    expect(statusLabel(item)).toBe(cardDescribe(card).label);
    expect(outcomeLine(item)).toBe(cardOutcomeLine(card));
    expect(stateKey(item)).toBe(cardStateKey(card));
  });

  it("uses the dock's labels for what needs the user", () => {
    expect(statusLabel(payment())).toBe("Ready to pay");
    expect(statusLabel(question)).toBe("Needs your answer");
    expect(statusLabel(protectedStep)).toBe("Needs a secure step");
    expect(statusLabel(view("running"))).toBe(null);
    expect(statusLabel(view("queued"))).toBe(null);
  });
});

describe("checkout events", () => {
  it("says a payment is ready the way the dock does, with the page link", () => {
    const event = checkoutEvent(payment(), origin, "chatgpt");
    expect(event).toEqual({
      name: EVENT_NAMES.needsYou,
      data: {
        runId: "run-1",
        store: "store.invalid",
        task: "One mug from store.invalid",
        status: "Ready to pay",
        headline: "store.invalid · Ready to pay",
        url: `${origin}/checkouts/run-1?via=chatgpt`,
        kind: "payment",
        requestId: "req-pay",
        question: "Approve the payment",
        expiresAt: null,
        amount: "$31.20",
        amountNote: "Exact amount to Store",
      },
    });
    expect(checkoutEvent(payment("r", false), origin)?.data.amountNote).toBe(
      "Up to this amount to Store",
    );
  });

  it("carries a store question's fields so the model can answer it", () => {
    expect(checkoutEvent(question, origin)?.data).toMatchObject({
      kind: "question",
      status: "Needs your answer",
      fields: [
        {
          key: "size",
          label: "Size",
          required: true,
          options: [
            { value: "s", label: "Small" },
            { value: "m", label: "Medium" },
          ],
        },
      ],
    });
  });

  it("reports an order with its receipt", () => {
    expect(checkoutEvent(succeeded(), origin)).toMatchObject({
      name: EVENT_NAMES.orderPlaced,
      data: {
        status: "Order placed",
        headline: "store.invalid · Order placed",
        total: "$31.20",
        orderNumber: "A-100",
        detail: "Order confirmed by the store. Receipt captured.",
      },
    });
  });

  it("reports endings, and warns when the order may have gone through", () => {
    expect(
      checkoutEvent(outcomes[2]?.[1] as CheckoutView, origin),
    ).toMatchObject({
      name: EVENT_NAMES.ended,
      data: {
        status: "Couldn't buy · Item unavailable",
        outcome: "couldnt_buy",
        detail: "“Sold out.”",
        mayHaveOrdered: false,
      },
    });
    expect(
      checkoutEvent(
        view("failed", { reason: "reconciliation_required" }),
        origin,
      ),
    ).toMatchObject({
      name: EVENT_NAMES.ended,
      data: {
        status: "Not confirmed",
        outcome: "not_confirmed",
        mayHaveOrdered: true,
      },
    });
    expect(
      checkoutEvent(view("cancelled", { result: { summary: "x" } }), origin)
        ?.data.outcome,
    ).toBe("canceled");
  });

  it("has no event while the checkout is just working", () => {
    expect(checkoutEvent(view("running"), origin)).toBe(null);
    expect(checkoutEvent(view("queued"), origin)).toBe(null);
  });

  it("never carries the live view, progress or addresses", () => {
    for (const item of [
      payment(),
      question,
      protectedStep,
      ...outcomes.map(([, v]) => v),
    ]) {
      const text = JSON.stringify(
        checkoutEvent(
          { ...item, progress: { latest: "SECRET_STEP" } } as never,
          origin,
        ),
      );
      expect(text).not.toContain("LIVE_VIEW_CANARY");
      expect(text).not.toContain("SECRET_STEP");
      expect(text).not.toContain("shipsTo");
    }
  });

  it("lists three webhook events whose payloads name every field they send", () => {
    expect(eventDefinitions.map((item) => item.name)).toEqual([
      "checkout.needs_you",
      "checkout.order_placed",
      "checkout.ended",
    ]);
    const samples = [
      payment(),
      question,
      protectedStep,
      ...outcomes.map(([, v]) => v),
    ];
    for (const sample of samples) {
      const event = checkoutEvent(sample, origin);
      const definition = eventDefinitions.find(
        (item) => item.name === event?.name,
      );
      expect(definition?.delivery).toEqual(["webhook"]);
      const properties = Object.keys(
        definition?.payloadSchema.properties ?? {},
      );
      for (const key of Object.keys(event?.data ?? {})) {
        expect(properties, `${event?.name}.${key}`).toContain(key);
      }
      for (const key of definition?.payloadSchema.required ?? []) {
        expect(event?.data, `${event?.name} requires ${key}`).toHaveProperty(
          key,
        );
      }
    }
  });
});

describe("subscription identity and lifetime", () => {
  it("is deterministic over user, URL, name and canonical arguments", () => {
    const a = subscriptionId("u", "https://h.example/cb", "n", {
      runId: "r",
      x: { b: 1, a: 2 },
    });
    const b = subscriptionId("u", "https://h.example/cb", "n", {
      x: { a: 2, b: 1 },
      runId: "r",
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^sub_[0-9a-f]{32}$/);
    expect(subscriptionId("v", "https://h.example/cb", "n", {})).not.toBe(
      subscriptionId("u", "https://h.example/cb", "n", {}),
    );
    expect(canonicalJson({ b: [1, { d: 1, c: 2 }], a: null })).toBe(
      '{"a":null,"b":[1,{"c":2,"d":1}]}',
    );
  });

  it("gives each change its own stable event ID", () => {
    expect(eventId("sub_1", "run-1", "succeeded:")).toBe(
      eventId("sub_1", "run-1", "succeeded:"),
    );
    expect(eventId("sub_1", "run-1", "succeeded:")).not.toBe(
      eventId("sub_1", "run-1", "awaiting_input:req"),
    );
  });

  it("grants one to two minutes, never no expiry", () => {
    expect(grantedTtl(undefined)).toBe(TTL_MAX_MS);
    expect(grantedTtl(null)).toBe(TTL_MAX_MS);
    expect(grantedTtl(3_600_000)).toBe(TTL_MAX_MS);
    expect(grantedTtl(1_000)).toBe(TTL_MIN_MS);
    expect(grantedTtl(90_000)).toBe(90_000);
  });
});

describe("detecting and delivering changes", () => {
  type Sent = {
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };

  function setup(
    reply: (attempt: number) => number | Error = () => 200,
    options: Partial<EventSubscription> = {},
  ) {
    const store = createMemoryEventStore();
    const sent: Sent[] = [];
    let attempts = 0;
    let clock = T0;
    const transport: WebhookTransport = async (_url, request) => {
      const outcome = reply(attempts++);
      if (outcome instanceof Error) {
        throw outcome;
      }
      sent.push({
        headers: { ...request.headers },
        body: JSON.parse(request.body),
      });
      return { status: outcome, body: "" };
    };
    const events = createCheckoutEvents({
      store,
      origin,
      transport,
      now: () => clock,
      sleep: async () => {},
    });
    const subscription: EventSubscription = {
      id: "sub_test",
      userId: "user-1",
      name: EVENT_NAMES.needsYou,
      runId: null,
      url: "https://hooks.example.com/cb",
      host: "chatgpt",
      secret,
      previousSecret: null,
      previousUntil: null,
      expiresAt: T0 + 120_000,
      createdAt: T0 - 30_000,
      verifiedAt: T0,
      seen: { "run-1": { k: "running:", t: 0 } },
      lastDeliveryAt: null,
      lastError: null,
      failedSince: null,
      ...options,
    };
    store.rows.set(subscription.id, subscription);
    return {
      store,
      events,
      sent,
      get attempts() {
        return attempts;
      },
      tick(ms: number) {
        clock += ms;
      },
    };
  }

  it("sends a change once, signed, with a stable event ID", async () => {
    const { events, sent, store } = setup();
    await events.observe("user-1", payment());
    await events.observe("user-1", payment());
    expect(sent).toHaveLength(1);
    const [delivery] = sent;
    expect(delivery?.body).toMatchObject({
      eventId: eventId("sub_test", "run-1", "awaiting_input:req-pay"),
      name: "checkout.needs_you",
      timestamp: new Date(T0).toISOString(),
      cursor: null,
      data: { headline: "store.invalid · Ready to pay", amount: "$31.20" },
    });
    expect(delivery?.headers["webhook-id"]).toBe(delivery?.body.eventId);
    expect(delivery?.headers["x-mcp-subscription-id"]).toBe("sub_test");
    const key = Buffer.from(secret.slice(6), "base64");
    const signed = createHmac("sha256", key)
      .update(
        `${delivery?.headers["webhook-id"]}.${delivery?.headers["webhook-timestamp"]}.${JSON.stringify(delivery?.body)}`,
      )
      .digest("base64");
    expect(delivery?.headers["webhook-signature"]).toBe(`v1,${signed}`);
    expect(store.rows.get("sub_test")?.seen["run-1"]?.k).toBe(
      "awaiting_input:req-pay",
    );
    expect(store.rows.get("sub_test")?.lastDeliveryAt).toBe(T0);
  });

  it("sends only the events the subscription asked for", async () => {
    const { events, sent, store } = setup(() => 200, {
      name: EVENT_NAMES.orderPlaced,
    });
    await events.observe("user-1", payment());
    expect(sent).toHaveLength(0);
    // The state is still recorded, so the next change is compared against it.
    expect(store.rows.get("sub_test")?.seen["run-1"]?.k).toBe(
      "awaiting_input:req-pay",
    );
    await events.observe("user-1", succeeded());
    expect(sent.map((item) => item.body.name)).toEqual([
      "checkout.order_placed",
    ]);
  });

  it("keeps a subscription for one checkout to that checkout", async () => {
    const { events, sent } = setup(() => 200, { runId: "run-2" });
    await events.observe("user-1", payment());
    expect(sent).toHaveLength(0);
  });

  it("ignores other users and expired subscriptions", async () => {
    const other = setup();
    await other.events.observe("user-2", payment());
    expect(other.sent).toHaveLength(0);
    const expired = setup(() => 200, { expiresAt: T0 - 1 });
    await expired.events.observe("user-1", payment());
    expect(expired.sent).toHaveLength(0);
  });

  it("tells about checkouts started after subscribing, not old ones", async () => {
    const fresh = setup(() => 200, { seen: {}, createdAt: T0 - 120_000 });
    await fresh.events.observe("user-1", payment());
    expect(fresh.sent).toHaveLength(1);
    const old = setup(() => 200, { seen: {}, createdAt: T0 + 60_000 });
    await old.events.observe("user-1", payment());
    expect(old.sent).toHaveLength(0);
  });

  it("retries transient failures, then keeps the event for the next check", async () => {
    const run = setup((attempt) => (attempt < 3 ? 503 : 200));
    await run.events.observe("user-1", payment());
    expect(run.attempts).toBe(3);
    expect(run.sent).toHaveLength(3);
    expect(run.store.rows.get("sub_test")).toMatchObject({
      lastError: "http_5xx",
      failedSince: T0,
      seen: { "run-1": { k: "running:" } },
    });
    // The next check (a refresh, or another read) sends it again, same ID, fresh signature.
    run.tick(30_000);
    await run.events.sweep(
      run.store.rows.get("sub_test") as EventSubscription,
      {
        list: async () => ({ runs: [payment()], nextCursor: null }),
      } as unknown as Checkouts,
    );
    expect(run.sent).toHaveLength(4);
    const [first, last] = [run.sent[0], run.sent[3]];
    expect(last?.body.eventId).toBe(first?.body.eventId);
    expect(last?.headers["webhook-timestamp"]).not.toBe(
      first?.headers["webhook-timestamp"],
    );
    expect(run.store.rows.get("sub_test")).toMatchObject({
      lastError: null,
      failedSince: null,
      seen: { "run-1": { k: "awaiting_input:req-pay" } },
    });
  });

  it("retries network errors but not a 4xx in the same check", async () => {
    const network = setup(() =>
      Object.assign(new Error("x"), { reason: "timeout" }),
    );
    await network.events.observe("user-1", payment());
    expect(network.attempts).toBe(3);
    const rejected = setup(() => 401);
    await rejected.events.observe("user-1", payment());
    expect(rejected.attempts).toBe(1);
    expect(rejected.store.rows.get("sub_test")?.lastError).toBe("http_4xx");
  });

  it.each([410, 413])(
    "drops an event the receiver refuses with %i",
    async (status) => {
      const run = setup(() => status);
      await run.events.observe("user-1", payment());
      expect(run.attempts).toBe(1);
      expect(run.store.rows.get("sub_test")?.seen["run-1"]?.k).toBe(
        "awaiting_input:req-pay",
      );
    },
  );

  it("signs with the old and new secret during a rotation", async () => {
    const old = `whsec_${Buffer.alloc(32, 1).toString("base64")}`;
    const run = setup(() => 200, {
      previousSecret: old,
      previousUntil: T0 + 60_000,
    });
    await run.events.observe("user-1", payment());
    expect(run.sent[0]?.headers["webhook-signature"]?.split(" ")).toHaveLength(
      2,
    );
    const after = setup(() => 200, {
      previousSecret: old,
      previousUntil: T0 - 1,
    });
    await after.events.observe("user-1", payment());
    expect(
      after.sent[0]?.headers["webhook-signature"]?.split(" "),
    ).toHaveLength(1);
  });

  it("holds deliveries while the secret can't be read", async () => {
    const run = setup(() => 200, { secret: null });
    await run.events.observe("user-1", payment());
    expect(run.attempts).toBe(0);
    expect(run.store.rows.get("sub_test")?.seen["run-1"]?.k).toBe("running:");
  });

  it("sweeps one checkout or the user's recent ones", async () => {
    const one = setup(() => 200, { runId: "run-1" });
    const reads: string[] = [];
    await one.events.sweep(
      one.store.rows.get("sub_test") as EventSubscription,
      {
        get: async (userId: string, runId: string) => {
          reads.push(`get ${userId} ${runId}`);
          return payment();
        },
      } as unknown as Checkouts,
    );
    expect(reads).toEqual(["get user-1 run-1"]);
    expect(one.sent).toHaveLength(1);
  });

  it("keeps the per-run memory bounded", async () => {
    const seen = Object.fromEntries(
      Array.from({ length: 50 }, (_, index) => [
        `old-${index}`,
        { k: "succeeded:", t: index },
      ]),
    );
    const run = setup(() => 200, {
      seen: { ...seen, "run-1": { k: "running:", t: 100 } },
    });
    await run.events.observe("user-1", payment());
    const kept = run.store.rows.get("sub_test")?.seen ?? {};
    expect(Object.keys(kept)).toHaveLength(50);
    expect(kept["run-1"]?.k).toBe("awaiting_input:req-pay");
    expect(kept["old-0"]).toBeUndefined();
  });
});

describe("sealed signing secrets", () => {
  it("round-trips, and refuses tampering or another key", () => {
    const box = createSecretBox("server-secret");
    const sealed = box.seal(secret);
    expect(sealed).not.toContain(secret.slice(6));
    expect(box.open(sealed)).toBe(secret);
    expect(createSecretBox("other").open(sealed)).toBe(null);
    expect(box.open(`${sealed.slice(0, -2)}AA`)).toBe(null);
    expect(box.open(null)).toBe(null);
    expect(box.seal(secret)).not.toBe(sealed);
  });
});

describe("a one-checkout watch ends after the checkout does", () => {
  const at = 1_800_000_000_000;
  const secondsAgo = (ms: number) => Math.floor((at - ms) / 1000);
  it("only for an ended run, after the grace period", () => {
    expect(endedLongAgo(undefined, at)).toBe(false);
    expect(endedLongAgo({ k: "running:", t: secondsAgo(3_600_000) }, at)).toBe(
      false,
    );
    expect(
      endedLongAgo({ k: "awaiting_input:req", t: secondsAgo(3_600_000) }, at),
    ).toBe(false);
    expect(endedLongAgo({ k: "cancelled:", t: secondsAgo(60_000) }, at)).toBe(
      false,
    );
    expect(
      endedLongAgo(
        { k: "cancelled:", t: secondsAgo(ENDED_GRACE_MS + 5000) },
        at,
      ),
    ).toBe(true);
    expect(
      endedLongAgo(
        { k: "succeeded:", t: secondsAgo(ENDED_GRACE_MS + 5000) },
        at,
      ),
    ).toBe(true);
  });
});

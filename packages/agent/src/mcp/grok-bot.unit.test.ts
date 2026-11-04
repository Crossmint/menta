import {
  type Checkouts,
  type CheckoutView,
  toView,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it, vi } from "vitest";
import { createSecretBox } from "./event-store.js";
import {
  BOT_ACTIVE_MS,
  createGrokBotUpdates,
  createMemoryRoutineStore,
  createRoutineKeyBox,
  FOLLOW_CAP_MS,
  grokBotSetup,
  ROUTINE_INSTRUCTION,
  readRoutineInput,
  routineKey,
  routineStatus,
  routineUpdate,
  UPDATES_PHRASE,
  updatesState,
  watchTokens,
} from "./grok-bot.js";
import type { WebhookTransport } from "./webhooks.js";

const origin = "https://commerce.invalid";
const LIVE = "https://live.invalid/LIVE_VIEW_CANARY";
const T0 = Date.parse("2026-10-07T12:00:00.000Z");
const user = "user-1";
const hook = "https://hooks.invalid/routines/abc";
const KEY = "grok-routine-key-4f2a";

function view(status: string, extra: Record<string, unknown> = {}) {
  return toView(
    {
      runId: "run-1",
      revision: 1,
      status,
      createdAt: "2026-10-07T11:59:00.000Z",
      input: {
        request: {
          startUrl: "https://www.store.invalid/",
          task: "One mug from https://www.store.invalid/p/mug",
        },
        constraints: { maxCost: { amount: "40.00", currency: "USD" } },
      },
      browser: { embedUrl: LIVE },
      ...extra,
    } as never,
    (runId) => `${origin}/checkouts/${runId}`,
  );
}

const awaiting = (requestId: string, interaction: Record<string, unknown>) =>
  view("awaiting_input", {
    requiredAction: {
      requestId,
      request: { question: "Which size?", expiresAt: null, interaction },
    },
  });

const payment = awaiting("req-pay", {
  kind: "payment",
  amount: { kind: "exact", value: "31.20", currency: "USD" },
  merchant: { name: "Store", url: "https://store.invalid", countryCode: "US" },
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
const running = view("running");
const placed = view("succeeded", {
  result: {
    summary: "Done.",
    purchase: {
      kind: "receipt_captured",
      receipt: {
        total: { amount: "31.20", currency: "USD" },
        merchantOrderId: "A-1",
      },
    },
  },
});

function setup({
  status = (): number => 200,
  rearm = null as ((token: string) => Promise<void>) | null,
} = {}) {
  let now = T0;
  const store = createMemoryRoutineStore();
  const posts: {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }[] = [];
  const transport: WebhookTransport = async (url, request) => {
    posts.push({
      url: url.href,
      headers: { ...request.headers },
      body: JSON.parse(request.body),
    });
    return { status: status(), body: "" };
  };
  const updates = createGrokBotUpdates({
    store,
    origin,
    transport,
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
    rearm,
    tokenKey: "watch-key-for-tests-0123456789abcdef",
  });
  return {
    store,
    posts,
    updates,
    tick: (ms: number) => {
      now += ms;
    },
    at: () => now,
  };
}

async function withRoutine(
  context: ReturnType<typeof setup>,
  adopt: CheckoutView | null = running,
) {
  await context.store.save(user, { url: hook, key: KEY, keyHint: "4f2a" });
  if (adopt) {
    await context.updates.readByBot(user, adopt);
    // Grok Bot stops reading: its turn is over.
    context.tick(BOT_ACTIVE_MS + 1_000);
  }
}

describe("what the user pastes", () => {
  it("takes the routine's URL and key, or the copied header", () => {
    expect(readRoutineInput(hook, KEY)).toEqual({
      ok: true,
      url: hook,
      key: KEY,
      keyHint: "4f2a",
    });
    for (const pasted of [
      `Bearer ${KEY}`,
      `Authorization: Bearer ${KEY}`,
      `  ${KEY}\n`,
    ]) {
      expect(readRoutineInput(hook, pasted)).toMatchObject({ key: KEY });
    }
  });

  it("reads the key out of the routine panel's Authorization header", () => {
    for (const pasted of [
      KEY,
      `Bearer ${KEY}`,
      `bearer   ${KEY}`,
      `Authorization: Bearer ${KEY}`,
      `authorization:Bearer ${KEY}`,
      `"Authorization: Bearer ${KEY}"`,
      `'Bearer ${KEY}'`,
      `  Authorization: Bearer ${KEY}  \n`,
    ]) {
      expect(routineKey(pasted)).toBe(KEY);
    }
    // Only a leading header name is taken off.
    expect(routineKey("Bearer")).toBe("Bearer");
    expect(routineKey(`x-${KEY}`)).toBe(`x-${KEY}`);
    expect(routineKey("Bearer ")).toBe("Bearer");
  });

  it("refuses URLs MCP Events would refuse, and keys that aren't keys", () => {
    for (const url of [
      "http://hooks.invalid/x",
      "https://127.0.0.1/x",
      "https://10.0.0.5/x",
      "https://hooks.invalid:8443/x",
      "https://user:pw@hooks.invalid/x",
      "https://localhost/x",
      "",
      "not a url",
    ]) {
      expect(readRoutineInput(url, KEY)).toMatchObject({
        ok: false,
        field: "url",
      });
    }
    for (const key of ["", "short", "has space inside", "x".repeat(600)]) {
      expect(readRoutineInput(hook, key)).toMatchObject({
        ok: false,
        field: "key",
      });
    }
  });

  it("never shows the key back, only its last four", async () => {
    const { store } = setup();
    await store.save(user, { url: hook, key: KEY, keyHint: "4f2a" });
    const status = routineStatus(await store.get(user));
    expect(status).toMatchObject({
      configured: true,
      enabled: true,
      host: "hooks.invalid",
      keyHint: "4f2a",
    });
    expect(JSON.stringify(status)).not.toContain(KEY);
    expect(JSON.stringify(status)).not.toContain("routines/abc");
    expect(routineStatus(null)).toEqual({ configured: false });
  });

  it("shows when the last delivery went out and how it went", async () => {
    const context = setup();
    await withRoutine(context, null);
    expect(routineStatus(await context.store.get(user))).toMatchObject({
      lastDelivery: null,
    });
    await context.updates.sendTest(user);
    expect(routineStatus(await context.store.get(user))).toMatchObject({
      lastDelivery: {
        at: new Date(T0).toISOString(),
        ok: true,
        error: null,
      },
    });
    context.tick(60_000);
    await context.store.recordDelivery(user, "http_4xx", context.at());
    expect(routineStatus(await context.store.get(user))).toMatchObject({
      lastDelivery: {
        at: new Date(T0 + 60_000).toISOString(),
        ok: false,
        error: "http_4xx",
      },
    });
  });

  it("seals keys under their own purpose", () => {
    const box = createRoutineKeyBox("server-secret");
    const sealed = box.seal(KEY);
    expect(sealed).not.toContain(KEY);
    expect(box.open(sealed)).toBe(KEY);
    // MCP Events' box can't open it.
    expect(createSecretBox("server-secret").open(sealed)).toBeNull();
  });
});

describe("setting up from Grok Bot", () => {
  it("knows whether updates are on, off or never set up", async () => {
    const context = setup();
    expect(await context.updates.state(user)).toBe("none");
    await withRoutine(context, null);
    context.updates.forget(user);
    expect(await context.updates.state(user)).toBe("on");
    await context.store.setEnabled(user, false);
    context.updates.forget(user);
    expect(await context.updates.state(user)).toBe("off");
    expect(updatesState(null)).toBe("none");
  });

  it("hands Grok Bot the account page's instruction and never a secret", () => {
    for (const state of ["none", "off", "on"] as const) {
      const setupResult = grokBotSetup(origin, state);
      expect(setupResult).toMatchObject({
        updates: state,
        accountUrl: `${origin}/settings#grok-bot`,
        routine: { instruction: ROUTINE_INSTRUCTION },
      });
      expect(setupResult.next).toContain(`${origin}/settings#grok-bot`);
    }
    const none = grokBotSetup(origin, "none").next;
    expect(none).toContain("Create a routine");
    expect(none).toContain("Add a webhook trigger");
    expect(none).toContain(
      "Webhook URL and Webhook key (or the Authorization header)",
    );
    expect(none).toContain("never ask for them in chat");
    expect(grokBotSetup(origin, "on").next).toContain(
      "don't create another routine",
    );
    expect(UPDATES_PHRASE).toBe("Turn on Menta updates");
  });

  it("offers updates once per user", async () => {
    const context = setup();
    expect(await context.updates.offerOnce(user)).toBe(true);
    expect(await context.updates.offerOnce(user)).toBe(false);
    expect(await context.updates.offerOnce("user-2")).toBe(true);
    const broken = createGrokBotUpdates({
      store: {
        ...createMemoryRoutineStore(),
        offer: async () => {
          throw new Error("down");
        },
      },
      origin,
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await broken.offerOnce(user)).toBe(false);
    warn.mockRestore();
  });
});

describe("what a routine run receives", () => {
  it("is the dock's status, the question and options, and the secure page via=grok", () => {
    const asked = routineUpdate(question, origin);
    expect(asked).toMatchObject({
      source: "oca",
      event: "checkout.needs_you",
      runId: "run-1",
      store: "store.invalid",
      status: "Needs your answer",
      kind: "question",
      question: "Which size?",
      fields: [
        {
          key: "size",
          options: [
            { value: "s", label: "Small" },
            { value: "m", label: "Medium" },
          ],
        },
      ],
      url: `${origin}/checkouts/run-1?via=grok`,
    });
    expect(routineUpdate(payment, origin)).toMatchObject({
      status: "Ready to pay",
      amount: "$31.20",
    });
    expect(routineUpdate(placed, origin)).toMatchObject({
      event: "checkout.order_placed",
      orderNumber: "A-1",
    });
    expect(routineUpdate(running, origin)).toBeNull();
    for (const state of [question, payment, placed]) {
      const text = JSON.stringify(routineUpdate(state, origin));
      expect(text).not.toContain("LIVE_VIEW_CANARY");
      expect(text).not.toContain("orderIntent");
    }
  });

  it("has an instruction that pays only from a fitting limit, never approving one", () => {
    expect(ROUTINE_INSTRUCTION).toContain("Read it with history");
    expect(ROUTINE_INSTRUCTION).toContain("send my answer with answer");
    expect(ROUTINE_INSTRUCTION).toContain("listing its options exactly");
    expect(ROUTINE_INSTRUCTION).toContain(
      "pay from one of my spending limits that fits it",
    );
    expect(ROUTINE_INSTRUCTION).toContain(
      "You can never create, approve or raise a spending limit yourself.",
    );
  });
});

describe("pushing to the routine", () => {
  it("ignores checkouts Grok Bot never followed, and users without a routine", async () => {
    const context = setup();
    expect(await context.updates.observe(user, payment)).toBe("ignored");
    await withRoutine(context, null);
    expect(await context.updates.observe(user, payment)).toBe("ignored");
    expect(context.posts).toHaveLength(0);
  });

  it("sends each new state once, with the key as a Bearer token", async () => {
    const context = setup();
    await withRoutine(context);
    expect(await context.updates.observe(user, payment)).toBe("sent");
    expect(await context.updates.observe(user, payment)).toBe("current");
    expect(context.posts).toHaveLength(1);
    expect(context.posts[0]).toMatchObject({
      url: hook,
      headers: { authorization: `Bearer ${KEY}` },
      body: { event: "checkout.needs_you", kind: "payment" },
    });
    // Back to work after approval: Grok Bot hears it went through.
    expect(await context.updates.observe(user, running)).toBe("sent");
    expect(context.posts[1]).toMatchObject({
      body: { event: "checkout.continued", runId: "run-1", status: "Working" },
    });
    expect(await context.updates.observe(user, placed)).toBe("sent");
    expect(context.posts.map((post) => post.body.event)).toEqual([
      "checkout.needs_you",
      "checkout.continued",
      "checkout.order_placed",
    ]);
    expect((await context.store.get(user))?.lastDeliveryAt).toBe(context.at());
  });

  it("holds off while Grok Bot is following the checkout itself", async () => {
    const context = setup();
    await withRoutine(context);
    await context.updates.readByBot(user, running);
    expect(await context.updates.observe(user, payment)).toBe("deferred");
    // Grok Bot's own wait sees it: it tells the user, so nothing is pushed.
    await context.updates.readByBot(user, payment);
    context.tick(BOT_ACTIVE_MS + 1_000);
    expect(await context.updates.observe(user, payment)).toBe("current");
    expect(context.posts).toHaveLength(0);
  });

  it("sends a change Grok Bot saw only after it went quiet", async () => {
    const context = setup();
    await withRoutine(context);
    await context.updates.readByBot(user, running);
    expect(await context.updates.observe(user, payment)).toBe("deferred");
    context.tick(BOT_ACTIVE_MS + 1_000);
    context.updates.forget(user);
    expect(await context.updates.observe(user, payment)).toBe("sent");
  });

  it("retries a failed delivery on the next read, and drops a refused one", async () => {
    let answer = 503;
    const context = setup({ status: () => answer });
    await withRoutine(context);
    expect(await context.updates.observe(user, payment)).toBe("pending");
    expect(context.posts).toHaveLength(3);
    expect((await context.store.get(user))?.seen["run-1"]?.k).toBe("running:");
    answer = 200;
    expect(await context.updates.observe(user, payment)).toBe("sent");
    answer = 401;
    expect(await context.updates.observe(user, placed)).toBe("sent");
    expect(context.posts).toHaveLength(5);
    expect((await context.store.get(user))?.lastError).toBe("http_4xx");
    // Refused means told: it isn't sent again.
    expect(await context.updates.observe(user, placed)).toBe("current");
  });

  it("stops when updates are turned off", async () => {
    const context = setup();
    await withRoutine(context);
    await context.store.setEnabled(user, false);
    context.updates.forget(user);
    expect(await context.updates.observe(user, payment)).toBe("ignored");
    expect(context.posts).toHaveLength(0);
  });

  it("sends a test body", async () => {
    const context = setup();
    expect(await context.updates.sendTest(user)).toEqual({
      ok: false,
      reason: "not_configured",
    });
    await withRoutine(context, null);
    expect(await context.updates.sendTest(user)).toEqual({ ok: true });
    expect(context.posts[0]?.body).toMatchObject({ event: "test" });
  });
});

describe("following a checkout", () => {
  function scripted(states: CheckoutView[]): Checkouts {
    let index = 0;
    return {
      get: vi.fn(async () => states[Math.min(index++, states.length - 1)]),
    } as unknown as Checkouts;
  }

  it("reads until the run settles and its update went out", async () => {
    const context = setup();
    await withRoutine(context);
    const checkouts = scripted([running, payment, payment, running, placed]);
    await context.updates.follow(user, "run-1", checkouts, {
      deadline: context.at() + 60_000,
    });
    expect(checkouts.get).toHaveBeenCalledTimes(5);
    expect(context.posts.map((post) => post.body.event)).toEqual([
      "checkout.needs_you",
      "checkout.continued",
      "checkout.order_placed",
    ]);
    // The lease is released.
    expect((await context.store.get(user))?.watches).toEqual({});
  });

  it("doesn't follow what Grok Bot never read", async () => {
    const context = setup();
    await withRoutine(context, null);
    const checkouts = scripted([payment]);
    await context.updates.follow(user, "run-1", checkouts, {
      deadline: context.at() + 60_000,
    });
    expect(checkouts.get).not.toHaveBeenCalled();
  });

  it("lets one follower at a time hold a checkout", async () => {
    const context = setup();
    await withRoutine(context);
    await context.store.lease(
      user,
      "run-1",
      { c: "other", u: context.at() + 30_000 },
      context.at(),
    );
    const checkouts = scripted([payment]);
    await context.updates.follow(user, "run-1", checkouts, {
      deadline: context.at() + 60_000,
    });
    expect(checkouts.get).not.toHaveBeenCalled();
  });

  it("ends with its request unless re-arming is on, then hands over within the cap", async () => {
    const plain = setup();
    await withRoutine(plain);
    await plain.updates.follow(user, "run-1", scripted([running]), {
      deadline: plain.at() + 20_000,
    });
    expect((await plain.store.get(user))?.watches).toEqual({});

    const tokens: string[] = [];
    const context = setup({
      rearm: async (token) => {
        tokens.push(token);
      },
    });
    await withRoutine(context);
    await context.updates.follow(user, "run-1", scripted([running]), {
      deadline: context.at() + 20_000,
    });
    expect(tokens).toHaveLength(1);
    // The lease stays with the chain for the next link.
    const chain = Object.values(
      (await context.store.get(user))?.watches ?? {},
    )[0]?.c;
    expect(chain).toBeTruthy();
    const checkouts = scripted([running, placed]);
    const resumed = context.updates.resume(
      tokens[0] ?? "",
      checkouts,
      context.at() + 280_000,
    );
    expect(resumed).not.toBeNull();
    await resumed;
    expect(context.posts.map((post) => post.body.event)).toEqual([
      "checkout.order_placed",
    ]);
    // A forged or expired token does nothing.
    expect(
      context.updates.resume("x.y", checkouts, context.at() + 1000),
    ).toBeNull();
    context.tick(FOLLOW_CAP_MS);
    expect(
      context.updates.resume(tokens[0] ?? "", checkouts, context.at() + 1000),
    ).toBeNull();
  });

  it("stops re-arming after the cap", async () => {
    const tokens: string[] = [];
    const context = setup({
      rearm: async (token) => {
        tokens.push(token);
      },
    });
    await withRoutine(context);
    await context.updates.follow(user, "run-1", scripted([running]), {
      deadline: context.at() + 20_000,
      since: context.at() - FOLLOW_CAP_MS,
    });
    expect(tokens).toHaveLength(0);
  });
});

describe("re-arm tokens", () => {
  it("are signed and expire", () => {
    const tokens = watchTokens("k".repeat(32));
    const sealed = tokens.seal({
      u: user,
      r: "run-1",
      c: "c1",
      s: T0,
      e: T0 + 60_000,
    });
    expect(tokens.open(sealed, T0)).toMatchObject({ u: user, r: "run-1" });
    expect(tokens.open(sealed, T0 + 60_001)).toBeNull();
    const [payload] = sealed.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        u: "someone-else",
        r: "run-1",
        c: "c1",
        s: T0,
        e: T0 + 60_000,
      }),
    ).toString("base64url");
    expect(tokens.open(`${forged}.${sealed.split(".")[1]}`, T0)).toBeNull();
    expect(watchTokens("other-key".repeat(4)).open(sealed, T0)).toBeNull();
    expect(payload).toBeTruthy();
  });
});

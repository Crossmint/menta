import { createHmac } from "node:crypto";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  type CheckoutsApi,
  createCheckouts,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createStytchFixture } from "../auth/fixtures/stytch.js";
import { createStytchAuthenticators } from "../auth/index.js";
import { createMemoryEventStore } from "./event-store.js";
import { createCheckoutEvents, TTL_MAX_MS } from "./events.js";
import { createMcpEndpoint } from "./index.js";
import type { WebhookTransport } from "./webhooks.js";

const origin = "https://commerce.invalid";
const callback = "https://hooks.example.com/mcp-events/cb_1";
const secret = `whsec_${Buffer.alloc(32, 5).toString("base64")}`;
const LIVE = "https://live.invalid/LIVE_VIEW_CAPABILITY_CANARY";

function run(
  status: string,
  extra: Record<string, unknown> = {},
  runId = "run-1",
) {
  return {
    runId,
    revision: 1,
    status,
    createdAt: new Date(Date.now() - 1000).toISOString(),
    input: {
      request: { startUrl: "https://www.store.invalid/", task: "One mug" },
      constraints: { maxCost: { amount: "40.00", currency: "USD" } },
    },
    browser: { embedUrl: LIVE },
    ...extra,
  };
}

const payment = run("awaiting_input", {
  requiredAction: {
    requestId: "req-pay",
    request: {
      question: "Approve the payment",
      expiresAt: null,
      interaction: {
        kind: "payment",
        amount: { kind: "exact", value: "31.20", currency: "USD" },
        merchant: {
          name: "Store",
          url: "https://store.invalid",
          countryCode: "US",
        },
      },
    },
  },
});

/** Crossmint, scoped by the user header: other users' runs are 404. */
function fakeCrossmint(owner: string) {
  let current: Record<string, unknown> = run("running");
  const calls: string[] = [];
  const user = (options: { headers?: Record<string, string> }) =>
    options.headers?.["x-crossmint-user-id"];
  const api = {
    get: (options: {
      headers: Record<string, string>;
      path: { id: string };
    }) => {
      calls.push(`get ${options.path.id}`);
      if (user(options) !== owner || options.path.id !== current.runId) {
        return Promise.resolve({
          error: { message: "Not found" },
          response: new Response(null, { status: 404 }),
        });
      }
      return Promise.resolve({ data: current });
    },
    list: (options: { headers: Record<string, string> }) => {
      calls.push("list");
      return Promise.resolve({
        data: {
          data: user(options) === owner ? [current] : [],
          nextCursor: null,
        },
      });
    },
  } as unknown as CheckoutsApi;
  return {
    calls,
    set(value: Record<string, unknown>) {
      current = value;
    },
    checkouts: createCheckouts({
      api,
      actionUrl: (runId) => `${origin}/checkouts/${runId}`,
      buyerProfiles: false,
      browserProfiles: false,
    }),
  };
}

type Posted = {
  url: string;
  headers: Readonly<Record<string, string>>;
  body: Record<string, unknown>;
  raw: string;
};

const resultSchema = z.object({}).passthrough();

describe("MCP-002 MCP Events for checkouts", () => {
  let fixture: Awaited<ReturnType<typeof createStytchFixture>>;
  let crossmint: ReturnType<typeof fakeCrossmint>;
  let store: ReturnType<typeof createMemoryEventStore>;
  let posted: Posted[];
  let reply: (body: Record<string, unknown>) => {
    status: number;
    body: string;
  };
  let tasks: Promise<unknown>[];
  let endpoint: ReturnType<typeof createMcpEndpoint>;
  /** Raw JSON-RPC exchanges, to see exactly what goes over the wire. */
  let wire: { request: string; response: string }[];

  const echo = (body: Record<string, unknown>) =>
    body.type === "verification"
      ? { status: 200, body: JSON.stringify({ challenge: body.challenge }) }
      : { status: 200, body: "" };

  beforeAll(async () => {
    fixture = await createStytchFixture();
  });
  afterAll(async () => fixture?.close());

  beforeEach(() => {
    crossmint = fakeCrossmint(fixture.userId);
    store = createMemoryEventStore();
    posted = [];
    tasks = [];
    wire = [];
    reply = echo;
    const transport: WebhookTransport = async (url, request) => {
      const body = JSON.parse(request.body) as Record<string, unknown>;
      posted.push({
        url: url.href,
        headers: request.headers,
        body,
        raw: request.body,
      });
      return reply(body);
    };
    const auth = createStytchAuthenticators({
      client: fixture.client,
      ...fixture.config,
    });
    endpoint = createMcpEndpoint({
      origin,
      oauth: {
        authorizationServerUrl: "https://auth.invalid",
        scopes: ["commerce:invoke"],
        authenticate: auth.authenticateMcpToken,
      },
      checkouts: () => crossmint.checkouts,
      events: createCheckoutEvents({
        store,
        origin,
        transport,
        sleep: async () => {},
      }),
    });
  });

  async function connect(
    mode: "legacy" | "auto" = "auto",
    claims: Record<string, unknown> = {},
  ) {
    const token = await fixture.sign(claims);
    const client = new Client(
      { name: "chatgpt-test", version: "1.0.0" },
      { versionNegotiation: { mode } },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
        fetch: async (url, init) => {
          const response = await endpoint.fetch(new Request(url, init), {
            waitUntil: (task) => tasks.push(task),
          });
          wire.push({
            request: String(init?.body ?? ""),
            response: await response.clone().text(),
          });
          return response;
        },
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      }),
    );
    return client;
  }

  /** Lets background checks and deliveries finish. */
  async function settle() {
    while (tasks.length > 0) {
      await Promise.all(tasks.splice(0));
    }
  }

  function subscribe(
    client: Client,
    overrides: Record<string, unknown> = {},
    delivery: Record<string, unknown> = {},
  ) {
    return client.request(
      {
        method: "events/subscribe",
        params: {
          name: "checkout.needs_you",
          arguments: { runId: "run-1" },
          delivery: { mode: "webhook", url: callback, secret, ...delivery },
          cursor: null,
          ...overrides,
        },
      },
      resultSchema,
    );
  }

  async function rpcError(promise: Promise<unknown>) {
    const error = await promise.then(
      () => null,
      (caught: unknown) => caught as { code?: number; data?: unknown },
    );
    expect(error, "expected a JSON-RPC error").not.toBeNull();
    return { code: error?.code, data: error?.data };
  }

  function verify(item: Posted) {
    const key = Buffer.from(secret.slice("whsec_".length), "base64");
    const expected = createHmac("sha256", key)
      .update(
        `${item.headers["webhook-id"]}.${item.headers["webhook-timestamp"]}.${item.raw}`,
      )
      .digest("base64");
    return item.headers["webhook-signature"]
      ?.split(" ")
      .includes(`v1,${expected}`);
  }

  it("advertises events on server/discover and lists the checkout events", async () => {
    const client = await connect();
    const discover = wire.find((item) =>
      item.request.includes("server/discover"),
    );
    expect(
      JSON.parse(discover?.response ?? "{}").result.capabilities,
    ).toMatchObject({
      tools: expect.any(Object),
      events: {},
    });
    const listed = await client.request(
      { method: "events/list", params: {} },
      z.object({ events: z.array(z.record(z.string(), z.unknown())) }),
    );
    expect(listed.events.map((item) => item.name)).toEqual([
      "checkout.needs_you",
      "checkout.order_placed",
      "checkout.ended",
    ]);
    for (const item of listed.events) {
      expect(item).toMatchObject({
        delivery: ["webhook"],
        inputSchema: {
          type: "object",
          properties: { runId: { type: "string" } },
        },
        payloadSchema: { type: "object" },
      });
    }
    // Params are optional on a list request.
    const bare = await client.request(
      { method: "events/list" },
      z.object({ events: z.array(z.unknown()) }),
    );
    expect(bare.events).toHaveLength(3);
    await client.close();
  });

  it("verifies the callback, then grants a short refreshable subscription", async () => {
    const client = await connect();
    const before = Date.now();
    const result = await subscribe(client, { ttlMs: 3_600_000 });
    expect(result).toMatchObject({
      id: expect.stringMatching(/^sub_[0-9a-f]{32}$/),
      cursor: null,
      truncated: false,
    });
    const refreshBefore = Date.parse(String(result.refreshBefore));
    expect(refreshBefore).toBeGreaterThan(before);
    expect(refreshBefore).toBeLessThanOrEqual(Date.now() + TTL_MAX_MS);

    // The challenge went to the callback, signed with the client's secret.
    expect(posted).toHaveLength(1);
    const [challenge] = posted;
    expect(challenge?.url).toBe(callback);
    expect(challenge?.body).toEqual({
      type: "verification",
      challenge: expect.any(String),
    });
    expect(challenge?.headers["x-mcp-subscription-id"]).toBe(result.id);
    expect(verify(challenge as Posted)).toBe(true);

    // Stored for the token's user, with the run's current state as the baseline.
    expect(store.rows.get(String(result.id))).toMatchObject({
      userId: fixture.userId,
      runId: "run-1",
      url: callback,
      secret,
      seen: { "run-1": { k: "running:" } },
    });
    await client.close();
  });

  it("is idempotent: the same identity refreshes without a second challenge", async () => {
    const client = await connect();
    const first = await subscribe(client);
    const again = await subscribe(client, {
      arguments: { runId: "run-1" },
    });
    expect(again.id).toBe(first.id);
    expect(again.deliveryStatus).toMatchObject({
      active: true,
      lastError: null,
    });
    expect(
      posted.filter((item) => item.body.type === "verification"),
    ).toHaveLength(1);
    expect(store.rows.size).toBe(1);
    await settle();
    await client.close();
  });

  it("delivers a change it finds on refresh, signed, once", async () => {
    const client = await connect();
    const { id } = await subscribe(client);
    crossmint.set(payment);
    await subscribe(client);
    await settle();
    const events = posted.filter((item) => item.body.eventId);
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event?.body).toMatchObject({
      name: "checkout.needs_you",
      cursor: null,
      data: {
        runId: "run-1",
        status: "Ready to pay",
        headline: "store.invalid · Ready to pay",
        amount: "$31.20",
        amountNote: "Exact amount to Store",
        url: `${origin}/checkouts/run-1`,
      },
    });
    expect(event?.headers["webhook-id"]).toBe(event?.body.eventId);
    expect(event?.headers["x-mcp-subscription-id"]).toBe(id);
    expect(verify(event as Posted)).toBe(true);
    expect(event?.raw).not.toContain("LIVE_VIEW");

    // Nothing new on the next refresh.
    await subscribe(client);
    await settle();
    expect(posted.filter((item) => item.body.eventId)).toHaveLength(1);
    await client.close();
  });

  it("ends a one-checkout watch a while after the checkout ended", async () => {
    const client = await connect();
    const { id } = await subscribe(client, { name: "checkout.ended" });
    crossmint.set(run("cancelled"));
    await subscribe(client, { name: "checkout.ended" });
    await settle();
    expect(posted.filter((item) => item.body.eventId)).toHaveLength(1);
    // Right after it ended, a refresh still works.
    await subscribe(client, { name: "checkout.ended" });
    // Later, the refresh is refused and the subscription is gone.
    const row = store.rows.get(String(id));
    const seen = row?.seen["run-1"];
    expect(seen?.k).toMatch(/^cancelled:/);
    store.rows.set(String(id), {
      ...(row as NonNullable<typeof row>),
      seen: {
        "run-1": { k: seen?.k ?? "", t: Math.floor(Date.now() / 1000) - 3600 },
      },
    });
    expect(
      await rpcError(subscribe(client, { name: "checkout.ended" })),
    ).toEqual({ code: -32012, data: { reason: "checkout_ended" } });
    expect(store.rows.has(String(id))).toBe(false);
    // Subscribing again doesn't start a new watch of an ended checkout.
    expect(
      await rpcError(subscribe(client, { name: "checkout.ended" })),
    ).toEqual({ code: -32012, data: { reason: "checkout_ended" } });
    expect(store.rows.size).toBe(0);
    await client.close();
  });

  it("delivers when a tool read sees the change, without a refresh", async () => {
    const client = await connect();
    await subscribe(client);
    crossmint.set(payment);
    await client.callTool({
      name: "history",
      arguments: { runId: "run-1" },
    });
    await settle();
    expect(
      posted.filter((item) => item.body.eventId).map((item) => item.body.name),
    ).toEqual(["checkout.needs_you"]);
    await client.close();
  });

  it("stops delivering after unsubscribe, and unsubscribing again is fine", async () => {
    const client = await connect();
    await subscribe(client);
    const params = {
      name: "checkout.needs_you",
      arguments: { runId: "run-1" },
      delivery: { mode: "webhook", url: callback },
    };
    expect(
      await client.request(
        { method: "events/unsubscribe", params },
        resultSchema,
      ),
    ).toEqual(expect.not.objectContaining({ error: expect.anything() }));
    expect(store.rows.size).toBe(0);
    expect(
      await client.request(
        { method: "events/unsubscribe", params },
        resultSchema,
      ),
    ).toBeTruthy();
    crossmint.set(payment);
    await client.callTool({
      name: "history",
      arguments: { runId: "run-1" },
    });
    await settle();
    expect(posted.filter((item) => item.body.eventId)).toEqual([]);
    await client.close();
  });

  it("follows all of a user's checkouts when no runId is given", async () => {
    const client = await connect();
    await subscribe(client, { name: "checkout.order_placed", arguments: {} });
    crossmint.set(
      run("succeeded", {
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
      }),
    );
    await client.callTool({ name: "history", arguments: {} });
    await settle();
    const events = posted.filter((item) => item.body.eventId);
    expect(events.map((item) => item.body.data)).toEqual([
      expect.objectContaining({
        status: "Order placed",
        total: "$31.20",
        orderNumber: "A-1",
      }),
    ]);
    await client.close();
  });

  it("refuses what it can't serve, with the spec's error codes", async () => {
    const client = await connect();
    expect(
      await rpcError(subscribe(client, { name: "checkout.nope" })),
    ).toEqual({
      code: -32011,
      data: { kind: "event" },
    });
    expect(
      await rpcError(subscribe(client, {}, { mode: "poll" })),
    ).toMatchObject({
      code: -32014,
      data: { feature: "deliveryMode", value: "poll" },
    });
    expect(
      await rpcError(
        subscribe(client, { arguments: { runId: "run-1", x: 1 } }),
      ),
    ).toMatchObject({ code: -32602 });
    for (const url of [
      "http://hooks.example.com/cb",
      "https://127.0.0.1/cb",
      "https://localhost/cb",
      "https://10.0.0.8/cb",
    ]) {
      expect(await rpcError(subscribe(client, {}, { url }))).toMatchObject({
        code: -32602,
      });
    }
    for (const bad of ["nope", "whsec_c2hvcnQ=", undefined]) {
      expect(
        await rpcError(subscribe(client, {}, { secret: bad })),
      ).toMatchObject({
        code: -32602,
      });
    }
    // Another user's (or no) checkout.
    expect(
      await rpcError(subscribe(client, { arguments: { runId: "run-other" } })),
    ).toMatchObject({ code: -32012 });
    expect(posted).toEqual([]);
    expect(store.rows.size).toBe(0);
    await client.close();
  });

  it("refuses a callback that fails the challenge", async () => {
    const client = await connect();
    reply = () => ({
      status: 200,
      body: JSON.stringify({ challenge: "wrong" }),
    });
    expect(await rpcError(subscribe(client))).toEqual({
      code: -32015,
      data: { reason: "challenge_failed" },
    });
    reply = () => ({ status: 503, body: "" });
    expect(await rpcError(subscribe(client))).toEqual({
      code: -32015,
      data: { reason: "http_5xx" },
    });
    expect(store.rows.size).toBe(0);
    await client.close();
  });

  it("keeps users apart: same callback, separate subscriptions", async () => {
    const mine = await connect();
    const theirs = await connect("auto", { sub: fixture.otherUserId });
    const a = await subscribe(mine, { arguments: {} });
    const b = await subscribe(theirs, { arguments: {} });
    expect(a.id).not.toBe(b.id);
    // Each user's callback is challenged separately.
    expect(
      posted.filter((item) => item.body.type === "verification"),
    ).toHaveLength(2);
    expect(store.rows.get(String(b.id))?.userId).toBe(fixture.otherUserId);
    // The other user can't remove mine.
    await theirs.request(
      {
        method: "events/unsubscribe",
        params: {
          name: "checkout.needs_you",
          arguments: {},
          delivery: { mode: "webhook", url: callback },
        },
      },
      resultSchema,
    );
    expect(store.rows.has(String(a.id))).toBe(true);
    await mine.close();
    await theirs.close();
  });

  it("rotates the secret on refresh, signing with both for a while", async () => {
    const client = await connect();
    await subscribe(client);
    const next = `whsec_${Buffer.alloc(32, 6).toString("base64")}`;
    crossmint.set(payment);
    await subscribe(client, {}, { secret: next });
    await settle();
    const [event] = posted.filter((item) => item.body.eventId);
    expect(event?.headers["webhook-signature"]?.split(" ")).toHaveLength(2);
    expect(verify(event as Posted)).toBe(true);
    await client.close();
  });

  it("leaves 2025-era clients exactly as before", async () => {
    const client = await connect("legacy");
    const initialize = wire.find((item) =>
      item.request.includes('"initialize"'),
    );
    expect(initialize?.response).toContain('"capabilities"');
    expect(initialize?.response).not.toContain('"events"');
    expect(client.getServerCapabilities()).not.toHaveProperty("events");
    expect(
      await rpcError(
        client.request({ method: "events/list", params: {} }, resultSchema),
      ),
    ).toMatchObject({
      code: -32601,
    });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain("start");
    await client.close();
  });

  it("serves no events at all when they aren't configured", async () => {
    const auth = createStytchAuthenticators({
      client: fixture.client,
      ...fixture.config,
    });
    endpoint = createMcpEndpoint({
      origin,
      oauth: {
        authorizationServerUrl: "https://auth.invalid",
        scopes: ["commerce:invoke"],
        authenticate: auth.authenticateMcpToken,
      },
      checkouts: () => crossmint.checkouts,
    });
    const client = await connect();
    const discover = wire.find((item) =>
      item.request.includes("server/discover"),
    );
    expect(
      JSON.parse(discover?.response ?? "{}").result.capabilities,
    ).not.toHaveProperty("events");
    await rpcError(
      client.request({ method: "events/list", params: {} }, resultSchema),
    );
    expect(wire.at(-1)?.response).toContain("-32601");
    await client.close();
  });
});

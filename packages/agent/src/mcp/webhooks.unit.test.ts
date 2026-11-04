import { createHmac } from "node:crypto";
import type { LookupAddress } from "node:dns";
import { describe, expect, it } from "vitest";
import {
  callbackProblem,
  isPublicAddress,
  postSigned,
  publicOnlyLookup,
  publicTransport,
  sign,
  signingKey,
  verifyCallback,
  WebhookError,
  type WebhookTransport,
} from "./webhooks.js";

// The Standard Webhooks reference vector (libraries/javascript/src/webhook.test.ts).
const vector = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: 1614265330,
  body: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};

function whsec(bytes: number) {
  return `whsec_${Buffer.alloc(bytes, 7).toString("base64")}`;
}

describe("Standard Webhooks signing", () => {
  it("matches the reference vector", () => {
    const key = signingKey(vector.secret);
    expect(key).not.toBeNull();
    expect(
      sign([key as Buffer], vector.id, vector.timestamp, vector.body),
    ).toBe(vector.signature);
  });

  it("signs with every key during a rotation, space-separated", () => {
    const keys = [
      signingKey(vector.secret) as Buffer,
      signingKey(whsec(32)) as Buffer,
    ];
    const header = sign(keys, vector.id, vector.timestamp, vector.body);
    const parts = header.split(" ");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(vector.signature);
    expect(parts[1]).toMatch(/^v1,[A-Za-z0-9+/]+=*$/);
  });

  it.each([
    ["no prefix", "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"],
    ["too short (16 bytes)", whsec(16)],
    ["too long (65 bytes)", whsec(65)],
    ["not base64", "whsec_not*base64!!"],
    ["empty", "whsec_"],
  ])("rejects a secret that is %s", (_label, secret) => {
    expect(signingKey(secret)).toBeNull();
  });

  it("accepts 24 to 64 byte secrets", () => {
    expect(signingKey(whsec(24))?.length).toBe(24);
    expect(signingKey(whsec(64))?.length).toBe(64);
  });
});

describe("callback address guard", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "198.18.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
    "2001:db8::1",
    "2002:7f00:1::1",
    "ff02::1",
    "not-an-ip",
  ])("treats %s as not public", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "104.18.0.1", "2606:4700::1111", "2a00:1450:4001::1"])(
    "treats %s as public",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it.each([
    ["http://hooks.example.com/x", "https"],
    ["https://user:pass@hooks.example.com/x", "credentials"],
    ["https://hooks.example.com:8443/x", "port"],
    ["https://localhost/x", "public host"],
    ["https://api.localhost/x", "public host"],
    ["https://metadata.internal/x", "public host"],
    ["https://intranet/x", "public host"],
    ["https://127.0.0.1/x", "public address"],
    ["https://[::1]/x", "public address"],
    ["https://169.254.169.254/latest", "public address"],
    ["not a url", "valid URL"],
    [`https://hooks.example.com/${"a".repeat(2100)}`, "too long"],
  ])("refuses %s", (url, reason) => {
    expect(callbackProblem(url)).toContain(reason);
  });

  it("accepts a public https URL", () => {
    expect(callbackProblem("https://hooks.example.com/mcp/cb_1?x=1")).toBe(
      null,
    );
    expect(callbackProblem("https://8.8.8.8/cb")).toBe(null);
  });

  it("refuses at connect time when a name resolves to a private address", async () => {
    const result = await new Promise<{ error: unknown; addresses: unknown }>(
      (resolve) =>
        (
          publicOnlyLookup as unknown as (
            host: string,
            options: { all: boolean },
            callback: (
              error: unknown,
              addresses: string | LookupAddress[],
            ) => void,
          ) => void
        )("localhost", { all: true }, (error, addresses) =>
          resolve({ error, addresses }),
        ),
    );
    expect(result.error).toMatchObject({ code: "ECONNREFUSED" });
  });

  it("never connects to a loopback or private URL", async () => {
    for (const url of [
      "https://127.0.0.1/cb",
      "https://localhost/cb",
      "https://[::1]/cb",
    ]) {
      await expect(
        publicTransport(new URL(url), {
          headers: {},
          body: "{}",
          timeoutMs: 2000,
        }),
      ).rejects.toMatchObject({ reason: "connection_refused" });
    }
  });
});

describe("signed delivery", () => {
  function recorder(
    reply: (body: string) => { status: number; body: string } = () => ({
      status: 200,
      body: "",
    }),
  ) {
    const sent: {
      url: string;
      headers: Readonly<Record<string, string>>;
      body: string;
    }[] = [];
    const transport: WebhookTransport = async (url, request) => {
      sent.push({
        url: url.href,
        headers: request.headers,
        body: request.body,
      });
      return reply(request.body);
    };
    return { sent, transport };
  }

  it("sends Standard Webhooks headers over the exact body", async () => {
    const { sent, transport } = recorder();
    const key = signingKey(vector.secret) as Buffer;
    await postSigned({
      url: "https://hooks.example.com/cb",
      id: "evt_1",
      subscriptionId: "sub_1",
      body: '{"eventId":"evt_1"}',
      keys: [key],
      transport,
      now: () => 1_700_000_000_123,
    });
    const [request] = sent;
    expect(request?.headers).toMatchObject({
      "content-type": "application/json",
      "webhook-id": "evt_1",
      "webhook-timestamp": "1700000000",
      "x-mcp-subscription-id": "sub_1",
    });
    const expected = createHmac("sha256", key)
      .update(`evt_1.1700000000.{"eventId":"evt_1"}`)
      .digest("base64");
    expect(request?.headers["webhook-signature"]).toBe(`v1,${expected}`);
  });

  it("refuses bodies over 256 KiB", async () => {
    const { sent, transport } = recorder();
    await expect(
      postSigned({
        url: "https://hooks.example.com/cb",
        id: "evt_1",
        subscriptionId: "sub_1",
        body: "x".repeat(256 * 1024 + 1),
        keys: [signingKey(vector.secret) as Buffer],
        transport,
      }),
    ).rejects.toThrow(RangeError);
    expect(sent).toEqual([]);
  });

  it("passes the challenge when the endpoint echoes it", async () => {
    const { sent, transport } = recorder((body) => ({
      status: 200,
      body: JSON.stringify({ challenge: JSON.parse(body).challenge }),
    }));
    await verifyCallback({
      url: "https://hooks.example.com/cb",
      subscriptionId: "sub_1",
      keys: [signingKey(vector.secret) as Buffer],
      transport,
    });
    const [request] = sent;
    expect(JSON.parse(request?.body ?? "")).toEqual({
      type: "verification",
      challenge: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
    });
    expect(request?.headers["webhook-id"]).toMatch(/^msg_verification_/);
  });

  it("uses a fresh challenge each time", async () => {
    const { sent, transport } = recorder((body) => ({
      status: 200,
      body: JSON.stringify({ challenge: JSON.parse(body).challenge }),
    }));
    const options = {
      url: "https://hooks.example.com/cb",
      subscriptionId: "sub_1",
      keys: [signingKey(vector.secret) as Buffer],
      transport,
    };
    await verifyCallback(options);
    await verifyCallback(options);
    const [first, second] = sent.map((item) => JSON.parse(item.body).challenge);
    expect(first).not.toBe(second);
  });

  it.each([
    [{ status: 200, body: '{"challenge":"wrong"}' }, "challenge_failed"],
    [{ status: 200, body: "not json" }, "challenge_failed"],
    [{ status: 200, body: "{}" }, "challenge_failed"],
    [{ status: 404, body: "" }, "http_4xx"],
    [{ status: 503, body: "" }, "http_5xx"],
    [{ status: 302, body: "" }, "http_4xx"],
  ])("fails verification on %o", async (reply, reason) => {
    const { transport } = recorder(() => reply);
    const error = await verifyCallback({
      url: "https://hooks.example.com/cb",
      subscriptionId: "sub_1",
      keys: [signingKey(vector.secret) as Buffer],
      transport,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WebhookError);
    expect((error as WebhookError).reason).toBe(reason);
  });
});

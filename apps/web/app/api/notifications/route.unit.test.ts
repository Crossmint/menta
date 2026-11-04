import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  push: {
    store: { save: vi.fn(), enrollment: vi.fn(), remove: vi.fn() },
    test: vi.fn(),
  },
}));
vi.mock("../../../lib/server/user", () => ({
  currentUser: mocks.user,
  sameOrigin: (r: Request) =>
    r.headers.get("origin") === "https://commerce.invalid",
  unauthorized: () => new Response(null, { status: 401 }),
}));
vi.mock("@oca/agent/push", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@oca/agent/push")>()),
  getWebPush: () => mocks.push,
}));

import { DELETE, GET, POST } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const request = (
  method: string,
  body: unknown,
  origin = "https://commerce.invalid",
) =>
  new Request("https://commerce.invalid/api/notifications", {
    method,
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const subscription = {
  endpoint: "https://fcm.googleapis.com/wp/private",
  keys: {
    p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString(
      "base64url",
    ),
    auth: Buffer.alloc(16, 2).toString("base64url"),
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "verified-user" });
  mocks.push.store.save.mockResolvedValue(id);
  mocks.push.store.enrollment.mockResolvedValue({
    id,
    endpointHash: createHash("sha256")
      .update(subscription.endpoint)
      .digest("hex"),
  });
});
describe("desktop notification routes", () => {
  it("requires authentication and same-origin writes", async () => {
    expect(
      (
        await POST(
          request(
            "POST",
            { action: "subscribe", subscription },
            "https://evil.invalid",
          ),
        )
      ).status,
    ).toBe(403);
    mocks.user.mockResolvedValue(null);
    expect(
      (await GET(new Request("https://commerce.invalid/api/notifications")))
        .status,
    ).toBe(401);
    expect(
      (await POST(request("POST", { action: "subscribe", subscription })))
        .status,
    ).toBe(401);
    expect(mocks.push.store.save).not.toHaveBeenCalled();
  });
  it("binds subscriptions to the verified user and exposes no endpoint or private keys", async () => {
    const response = await POST(
      request("POST", {
        action: "subscribe",
        subscription,
        userId: "attacker",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id });
    expect(mocks.push.store.save).toHaveBeenCalledWith(
      "verified-user",
      subscription,
      undefined,
    );
    const settings = await GET(
      new Request(`https://commerce.invalid/api/notifications?id=${id}`),
    );
    expect(await settings.text()).not.toContain("private");
    expect(mocks.push.store.enrollment).toHaveBeenCalledWith(
      "verified-user",
      id,
    );
  });
  it("validates endpoints and keys before saving or sending anything", async () => {
    expect(
      (
        await POST(
          request("POST", {
            action: "subscribe",
            subscription: {
              ...subscription,
              endpoint: "https://127.0.0.1/internal",
            },
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.push.store.save).not.toHaveBeenCalled();
  });
  it("only renews the previous endpoint owned by the current signed-in person", async () => {
    const renewal = new Request("https://commerce.invalid/api/notifications", {
      method: "POST",
      headers: {
        origin: "https://commerce.invalid",
        cookie: `oca_push_device=${id}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "refresh",
        previousEndpoint: subscription.endpoint,
        subscription,
      }),
    });
    expect((await POST(renewal)).status).toBe(200);
    expect(mocks.push.store.save).toHaveBeenCalledWith(
      "verified-user",
      subscription,
      id,
    );
    mocks.push.store.enrollment.mockResolvedValue(null);
    expect(
      (
        await POST(
          new Request("https://commerce.invalid/api/notifications", {
            method: "POST",
            headers: {
              origin: "https://commerce.invalid",
              cookie: `oca_push_device=${id}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "refresh",
              previousEndpoint: subscription.endpoint,
              subscription,
            }),
          }),
        )
      ).status,
    ).toBe(409);
  });
  it("scopes tests and deletion to the verified user", async () => {
    await POST(request("POST", { action: "test", id, userId: "other" }));
    await DELETE(request("DELETE", { id, userId: "other" }));
    expect(mocks.push.test).toHaveBeenCalledWith("verified-user", id);
    expect(mocks.push.store.remove).toHaveBeenCalledWith("verified-user", id);
  });
});

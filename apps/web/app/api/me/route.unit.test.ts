import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  listOrderIntents: vi.fn(),
  cancelOrderIntent: vi.fn(),
  prepareCards: vi.fn(),
  removeCard: vi.fn(),
  addresses: vi.fn(),
  deleteAddress: vi.fn(),
  clearSignIns: vi.fn(),
  forgetUser: vi.fn(),
  deleteStytchUser: vi.fn(),
}));
vi.mock("../../../lib/server/user", () => ({
  currentUser: mocks.user,
  origin: () => "https://oca.example",
  sameOrigin: (r: Request) => r.headers.get("origin") === "https://oca.example",
  stytch: () => ({ users: { delete: mocks.deleteStytchUser } }),
  unauthorized: () => new Response(null, { status: 401 }),
}));
vi.mock("@oca/agent/crossmint", () => ({
  crossmintKey: () => "ck_test",
  listOrderIntents: mocks.listOrderIntents,
  cancelOrderIntent: mocks.cancelOrderIntent,
  prepareCardsForOrderIntents: mocks.prepareCards,
  removeCard: mocks.removeCard,
  getCheckouts: () => ({
    addresses: mocks.addresses,
    deleteAddress: mocks.deleteAddress,
    clearSignIns: mocks.clearSignIns,
  }),
}));
vi.mock("@oca/agent/forget-user", () => ({ forgetUser: mocks.forgetUser }));

import { DELETE } from "./route";

const user = {
  id: "verified-user",
  jwt: "jwt",
  principal: { issuer: "stytch.com/p", subject: "verified-user" },
};
const request = (origin = "https://oca.example") =>
  new Request("https://oca.example/api/me", {
    method: "DELETE",
    headers: { origin },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue(user);
  mocks.listOrderIntents.mockResolvedValue([
    { orderIntentId: "oi-active", status: "active" },
    { orderIntentId: "oi-old", status: "expired" },
  ]);
  mocks.cancelOrderIntent.mockResolvedValue(true);
  mocks.prepareCards.mockResolvedValue({
    cards: [{ paymentMethodId: "pm-1" }],
  });
  mocks.removeCard.mockResolvedValue(true);
  mocks.addresses.mockResolvedValue([{ id: "addr-1" }]);
  mocks.deleteAddress.mockResolvedValue([]);
  mocks.clearSignIns.mockResolvedValue(undefined);
  mocks.forgetUser.mockResolvedValue(undefined);
  mocks.deleteStytchUser.mockResolvedValue({});
});

describe("DELETE /api/me", () => {
  it("refuses other origins and signed-out callers, touching nothing", async () => {
    expect((await DELETE(request("https://evil.example"))).status).toBe(403);
    mocks.user.mockResolvedValue(null);
    expect((await DELETE(request())).status).toBe(401);
    expect(mocks.listOrderIntents).not.toHaveBeenCalled();
    expect(mocks.forgetUser).not.toHaveBeenCalled();
    expect(mocks.deleteStytchUser).not.toHaveBeenCalled();
  });

  it("removes the user's data, then their Stytch user, and clears the cookies", async () => {
    const response = await DELETE(request());
    expect(response.status).toBe(204);
    expect(mocks.cancelOrderIntent).toHaveBeenCalledTimes(1);
    expect(mocks.cancelOrderIntent.mock.calls[0]?.[0]).toMatchObject({
      orderIntentId: "oi-active",
      jwt: "jwt",
    });
    expect(mocks.prepareCards.mock.calls[0]?.[0]).toMatchObject({
      email: null,
    });
    expect(mocks.removeCard.mock.calls[0]?.[0]).toMatchObject({
      paymentMethodId: "pm-1",
    });
    expect(mocks.deleteAddress).toHaveBeenCalledWith("verified-user", "addr-1");
    expect(mocks.clearSignIns).toHaveBeenCalledWith("verified-user");
    expect(mocks.forgetUser).toHaveBeenCalledWith(user);
    expect(mocks.deleteStytchUser).toHaveBeenCalledWith({
      user_id: "verified-user",
    });
    expect(mocks.forgetUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteStytchUser.mock.invocationCallOrder[0] ?? 0,
    );
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toContain("Max-Age=0");
    }
  });

  it("stops with a 502 before deleting the sign-in when a Crossmint step fails", async () => {
    mocks.removeCard.mockResolvedValue(false);
    const response = await DELETE(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Couldn't delete your account. Try again.",
    });
    expect(mocks.deleteAddress).not.toHaveBeenCalled();
    expect(mocks.forgetUser).not.toHaveBeenCalled();
    expect(mocks.deleteStytchUser).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("treats an approval list it couldn't read as a failure", async () => {
    mocks.listOrderIntents.mockResolvedValue(null);
    expect((await DELETE(request())).status).toBe(502);
    expect(mocks.deleteStytchUser).not.toHaveBeenCalled();
  });

  it("doesn't leak provider errors", async () => {
    mocks.deleteAddress.mockRejectedValue(
      Object.assign(new Error("secret street"), { status: 500 }),
    );
    const response = await DELETE(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret street");
  });
});

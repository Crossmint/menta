import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  remove: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("../../../../lib/auth/runtime", () => ({
  getWebLoginHandlers: () => ({ logout: mocks.logout }),
}));
vi.mock("../../../../lib/server/user", () => ({
  currentUser: mocks.user,
  sameOrigin: (r: Request) => r.headers.get("origin") === "https://oca.example",
}));
vi.mock("@oca/agent/push", () => ({
  getWebPush: () => ({ store: { remove: mocks.remove } }),
}));

import { POST } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const request = () =>
  new Request("https://oca.example/api/auth/logout", {
    method: "POST",
    headers: {
      origin: "https://oca.example",
      cookie: `oca_push_device=${id}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "verified-user" });
  mocks.remove.mockResolvedValue(undefined);
  mocks.logout.mockImplementation(async () =>
    Response.json({ signedOut: true }),
  );
});
it("revokes this browser's server enrollment before signing out on any surface", async () => {
  const response = await POST(request());
  expect(mocks.remove).toHaveBeenCalledWith("verified-user", id);
  expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.logout.mock.invocationCallOrder[0] ?? 0,
  );
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
});
it("does not treat a supplied device cookie as authority for another person", async () => {
  mocks.user.mockResolvedValue(null);
  await POST(request());
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("preserves sign-out if push storage is temporarily unavailable", async () => {
  mocks.remove.mockRejectedValue(new Error("unavailable"));
  expect((await POST(request())).status).toBe(200);
  expect(mocks.logout).toHaveBeenCalledOnce();
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
const forget = vi.hoisted(() => vi.fn());

vi.mock("@oca/agent/web", () => ({
  getSessionOwners: () => ({ forget }),
}));
vi.mock("./user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./user")>()),
  currentUser,
}));

const { DELETE } = await import(
  "../../app/api/conversations/[sessionId]/route"
);

const origin = "https://commerce.invalid";
const principal = {
  authenticator: "stytch",
  principalType: "user",
  principalId: "user-test-1",
  issuer: "stytch.com/project-test",
  subject: "user-test-1",
  attributes: {},
};

function remove(
  sessionId: string,
  headers: Record<string, string> = { origin },
) {
  return DELETE(
    new Request(`${origin}/api/conversations/${sessionId}`, {
      method: "DELETE",
      headers,
    }),
    { params: Promise.resolve({ sessionId }) },
  );
}

beforeEach(() => {
  vi.stubEnv("OCA_WEB_ORIGIN", origin);
  currentUser.mockResolvedValue({ id: "user-test-1", principal });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("DELETE /api/conversations/:sessionId", () => {
  it("deletes the signed-in user's own conversation", async () => {
    forget.mockResolvedValue(true);
    const response = await remove("wrun_A");
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(forget).toHaveBeenCalledWith("wrun_A", principal);
  });

  it("answers 404 for a conversation the user doesn't own", async () => {
    forget.mockResolvedValue(false);
    const response = await remove("wrun_someone_elses");
    expect(response.status).toBe(404);
    expect(forget).toHaveBeenCalledWith("wrun_someone_elses", principal);
  });

  it("requires a signed-in user", async () => {
    currentUser.mockResolvedValue(null);
    const response = await remove("wrun_A");
    expect(response.status).toBe(401);
    expect(forget).not.toHaveBeenCalled();
  });

  it.each([
    ["no origin", {}],
    ["another origin", { origin: "https://evil.invalid" }],
  ])("refuses requests with %s", async (_, headers) => {
    const response = await remove("wrun_A", headers);
    expect(response.status).toBe(403);
    expect(currentUser).not.toHaveBeenCalled();
    expect(forget).not.toHaveBeenCalled();
  });
});

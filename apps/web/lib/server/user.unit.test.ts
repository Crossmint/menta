import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("stytch", () => ({
  Client: class {
    sessions = { authenticate: mocks.authenticate };
  },
}));
vi.mock("@oca/agent/mcp", () => ({ mcpAuthorizationServerUrl: () => null }));

import { currentUser, sameOrigin, sessionToken } from "./user";

const origin = "https://oca.example";
const cookie = "__Host-oca_session=cookie-token";
const live = new Map([
  ["bearer-token", "user-bearer"],
  ["cookie-token", "user-cookie"],
]);

function request(headers: Record<string, string>, method = "GET") {
  return new Request(`${origin}/api/me`, { method, headers });
}

beforeEach(() => {
  vi.stubEnv("STYTCH_PROJECT_ID", "project-test-user");
  vi.stubEnv("STYTCH_SECRET", "inert-fixture-secret");
  vi.stubEnv("OCA_WEB_ORIGIN", origin);
  mocks.authenticate.mockReset();
  mocks.authenticate.mockImplementation(
    async ({ session_token }: { session_token: string }) => {
      const id = live.get(session_token);
      if (!id) {
        throw new Error("session_not_found");
      }
      return {
        session_jwt: `jwt-for-${id}`,
        user: {
          user_id: id,
          name: { first_name: "Ada", last_name: "" },
          emails: [{ email: `${id}@example.invalid` }],
          providers: [],
        },
      };
    },
  );
});
afterEach(() => vi.unstubAllEnvs());

describe("currentUser", () => {
  it("verifies the session cookie with Stytch", async () => {
    expect((await currentUser(request({ cookie })))?.id).toBe("user-cookie");
    expect(sessionToken(request({ cookie }))).toBe("cookie-token");
    expect(await currentUser(request({}))).toBeNull();
  });

  it("ignores an Authorization bearer", async () => {
    expect(
      await currentUser(request({ authorization: "Bearer bearer-token" })),
    ).toBeNull();
    expect(
      (
        await currentUser(
          request({ authorization: "Bearer bearer-token", cookie }),
        )
      )?.id,
    ).toBe("user-cookie");
    expect(mocks.authenticate).not.toHaveBeenCalledWith({
      session_token: "bearer-token",
    });
  });
});

describe("sameOrigin", () => {
  it("requires our exact Origin", () => {
    expect(sameOrigin(request({ cookie, origin }, "POST"))).toBe(true);
    expect(sameOrigin(request({ cookie }, "POST"))).toBe(false);
    expect(
      sameOrigin(request({ cookie, origin: "https://evil.example" }, "POST")),
    ).toBe(false);
    expect(
      sameOrigin(request({ authorization: "Bearer bearer-token" }, "POST")),
    ).toBe(false);
  });
});

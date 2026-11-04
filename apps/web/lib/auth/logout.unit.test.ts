import type { Client } from "stytch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWebLoginHandlers } from "./handlers.js";

const origin = "https://commerce.invalid";
const live = new Set<string>();
const client = {
  otps: { email: { loginOrCreate: vi.fn() }, authenticate: vi.fn() },
  sessions: {
    authenticate: vi.fn(
      async ({ session_token }: { session_token: string }) => {
        if (!live.has(session_token)) {
          throw new Error("session_not_found");
        }
        return {
          status_code: 200,
          session: { user_id: "user-1" },
          user: { user_id: "user-1" },
        };
      },
    ),
    revoke: vi.fn(async ({ session_token }: { session_token: string }) => {
      live.delete(session_token);
      return { status_code: 200 };
    }),
  },
} as unknown as Pick<Client, "otps" | "sessions">;
const handlers = createWebLoginHandlers({
  origin,
  projectId: "project-test-logout",
  client,
  sessionDurationMinutes: 10080,
});

function logout(headers: Record<string, string>, method = "POST") {
  return handlers.logout(
    new Request(`${origin}/api/auth/logout`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: "{}",
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  live.clear();
  live.add("bearer-token");
  live.add("cookie-token");
});

describe("logout", () => {
  it("ignores an Authorization bearer: only our cookie, from our Origin, signs out", async () => {
    const response = await logout({
      authorization: "Bearer bearer-token",
      origin,
    });
    expect(response.status).toBe(401);
    expect(client.sessions.revoke).not.toHaveBeenCalled();
    expect(live.has("bearer-token")).toBe(true);
  });

  it("requires the exact Origin, then revoke and clear", async () => {
    const cookie = "__Host-oca_session=cookie-token";
    const forged = await logout({ cookie });
    expect(forged.status).toBe(403);
    expect(client.sessions.revoke).not.toHaveBeenCalled();

    const response = await logout({ cookie, origin });
    expect(response.status).toBe(200);
    expect(client.sessions.revoke).toHaveBeenCalledWith({
      session_token: "cookie-token",
    });
    expect(response.headers.getSetCookie().join("\n")).toContain(
      "__Host-oca_session=; Path=/; Max-Age=0",
    );
  });
});

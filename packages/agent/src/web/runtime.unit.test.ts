import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("stytch", () => ({
  Client: class {
    sessions = { authenticate: mocks.authenticate };
  },
}));

import { authenticateWebRequest } from "./runtime.js";

const sessions: Record<string, string> = {
  "bearer-token": "user-bearer",
  "cookie-token": "user-cookie",
};

function request(headers: Record<string, string>) {
  return new Request("https://commerce.invalid/eve/v1/session", { headers });
}

beforeEach(() => {
  vi.stubEnv("STYTCH_PROJECT_ID", "project-test-eve");
  vi.stubEnv("STYTCH_SECRET", "inert-fixture-secret");
  vi.stubEnv("OCA_WEB_ORIGIN", "https://commerce.invalid");
  mocks.authenticate.mockReset();
  mocks.authenticate.mockImplementation(
    async ({ session_token }: { session_token: string }) => {
      const user = sessions[session_token];
      if (!user) {
        throw new Error("session_not_found");
      }
      return {
        status_code: 200,
        session: { user_id: user },
        user: { user_id: user },
      };
    },
  );
});

describe("Eve channel authentication", () => {
  it("accepts the web cookie, verified with Stytch", async () => {
    const principal = await authenticateWebRequest(
      request({ cookie: "__Host-oca_session=cookie-token" }),
    );
    expect(principal.subject).toBe("user-cookie");
    expect(mocks.authenticate).toHaveBeenCalledWith({
      session_token: "cookie-token",
    });
  });

  it("ignores an Authorization bearer", async () => {
    await expect(
      authenticateWebRequest(request({ authorization: "Bearer bearer-token" })),
    ).rejects.toThrow("Not signed in");
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
});

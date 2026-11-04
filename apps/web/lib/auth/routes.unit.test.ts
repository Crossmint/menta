import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as logout } from "../../app/api/auth/logout/route.js";
import { POST as requestCode } from "../../app/api/auth/request-code/route.js";
import { GET as session } from "../../app/api/auth/session/route.js";
import { POST as verifyCode } from "../../app/api/auth/verify-code/route.js";

beforeEach(() => {
  // Explicit inert configuration; no credential values are read by these cases.
  vi.stubEnv("STYTCH_PROJECT_ID", "");
  vi.stubEnv("STYTCH_SECRET", "");
  vi.stubEnv("OCA_WEB_ORIGIN", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("WEB-LOGIN native route import and fail-closed composition", () => {
  it.each([
    ["request-code", "POST", requestCode],
    ["verify-code", "POST", verifyCode],
    ["session", "GET", session],
    ["logout", "POST", logout],
  ] as const)(
    "unconfigured %s is a safe unavailable route",
    async (path, method, handler) => {
      const response = await handler(
        new Request(`https://commerce.invalid/api/auth/${path}`, { method }),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "unavailable" });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.getSetCookie()).toHaveLength(0);
    },
  );
});

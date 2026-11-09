import { Client } from "stytch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as callbackRoute } from "../../app/api/auth/google/callback/route";
import { POST as startRoute } from "../../app/api/auth/google/start/route";
import { createGoogleLoginHandlers } from "./google";

const client = new Client({
  project_id: "project-test-google-fixture",
  secret: "inert-not-a-secret",
  env: "http://127.0.0.1:9",
  timeout: 100,
});
const config = {
  origin: "https://commerce.invalid",
  projectId: "project-test-google-fixture",
  publicToken: "public-token-test-fixture",
  client,
  sessionDurationMinutes: 10080,
};
beforeEach(() => {
  vi.stubEnv("STYTCH_PROJECT_ID", "");
  vi.stubEnv("STYTCH_SECRET", "");
  vi.stubEnv("OCA_WEB_ORIGIN", "");
  vi.stubEnv("NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("GOOGLE-LOGIN configuration and missing-provider route safety", () => {
  it.each([
    { projectId: "project-live-fixture" },
    { publicToken: "public-token-live-fixture" },
    { projectId: "project-test-fixture " },
    { publicToken: " public-token-test-fixture" },
    { projectId: "" },
    { publicToken: "" },
    { origin: "https://commerce.invalid/" },
    { origin: "https://user:pass@commerce.invalid" },
    { origin: "http://merchant.invalid" },
    { origin: "invalid" },
    { sessionDurationMinutes: 4 },
    { sessionDurationMinutes: 527041 },
    { sessionDurationMinutes: 5.5 },
  ])("rejects inconsistent/invalid trusted configuration %j", (changes) => {
    expect(() => createGoogleLoginHandlers({ ...config, ...changes })).toThrow(
      "Invalid Google login configuration",
    );
  });
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("accepts explicit local canonical origin %s", (origin) => {
    expect(() =>
      createGoogleLoginHandlers({ ...config, origin }),
    ).not.toThrow();
  });
  it("unconfigured start redirects only to a fixed relative login error", async () => {
    const response = await startRoute(
      new Request("https://untrusted.invalid/api/auth/google/start", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/login?error=google_sign_in_failed",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.getSetCookie()).toHaveLength(0);
    expect(await response.text()).toBe("");
  });
  it("unconfigured callback clears only verifier variants and removes token URL", async () => {
    const response = await callbackRoute(
      new Request(
        "https://untrusted.invalid/api/auth/google/callback?token=OAUTH_CANARY&stytch_token_type=oauth",
        { headers: { cookie: "__Host-oca_session=EXISTING_CANARY" } },
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/login?error=google_sign_in_failed",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(
      cookies.every(
        (cookie) =>
          cookie.includes("oca_google_pkce=;") && cookie.includes("Max-Age=0"),
      ),
    ).toBe(true);
    expect(cookies.join(" ")).not.toMatch(/oca_session|CANARY/);
    expect(await response.text()).toBe("");
  });
});

describe("GOOGLE-LOGIN failure keeps where the user was headed", () => {
  it("a cancelled sign-in returns to sign-in with its connect request", async () => {
    const next = "/oauth/authorize?client_id=connected-app-test-chatgpt";
    const response = await createGoogleLoginHandlers(config).callback(
      new Request(
        "https://commerce.invalid/api/auth/google/callback?error=access_denied",
        {
          headers: {
            cookie: `__Secure-oca_login_next=${encodeURIComponent(next)}`,
          },
        },
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `https://commerce.invalid/login?error=google_sign_in_failed&next=${encodeURIComponent(next)}`,
    );
  });
  it("a next cookie for another site is ignored", async () => {
    const response = await createGoogleLoginHandlers(config).callback(
      new Request("https://commerce.invalid/api/auth/google/callback", {
        headers: { cookie: "__Secure-oca_login_next=%2F%2Fevil.invalid" },
      }),
    );
    expect(response.headers.get("location")).toBe(
      "https://commerce.invalid/login?error=google_sign_in_failed",
    );
  });
});

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "stytch";
import { afterEach, describe, expect, it } from "vitest";
import { writeWebSessionCookies } from "./cookies";
import { createGoogleLoginHandlers } from "./google";

const origin = "https://commerce.invalid";
const userId = "user-google-fixture";
const oauthToken = "OAUTH_TOKEN_CANARY";
const sessionToken = "SESSION_TOKEN_CANARY";
const verifier = "v".repeat(43);
const closing: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closing.splice(0)) {
    await close();
  }
});
async function fixture(configuredOrigin = origin) {
  const calls: { path: string; body: string }[] = [];
  let mode = "valid";
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    let body = "";
    for await (const chunk of request) {
      body += chunk.toString();
    }
    calls.push({ path: request.url ?? "", body });
    if (mode === "provider-error") {
      response.writeHead(401).end(
        JSON.stringify({
          status_code: 401,
          request_id: "fixture",
          error_type: "oauth_invalid",
          error_message: "PROVIDER_ERROR_CANARY",
        }),
      );
      return;
    }
    if (request.url === "/v1/oauth/authenticate") {
      response.end(
        JSON.stringify({
          status_code: 200,
          user_id: userId,
          user: { user_id: mode === "user-mismatch" ? "other-user" : userId },
          user_session:
            mode === "missing-session"
              ? undefined
              : {
                  user_id: mode === "session-mismatch" ? "other-user" : userId,
                },
          session_token: mode === "missing-token" ? undefined : sessionToken,
          provider_type:
            mode === "wrong-provider"
              ? "GitHub"
              : mode === "lowercase-google"
                ? "google"
                : "Google",
          provider_values: {
            access_token: "ACCESS_CANARY",
            refresh_token: "REFRESH_CANARY",
            id_token: "JWT_CANARY",
          },
          session_jwt: "SESSION_JWT_CANARY",
        }),
      );
      return;
    }
    if (request.url === "/v1/sessions/authenticate") {
      const current = mode === "remote-mismatch" ? "other-user" : userId;
      response.end(
        JSON.stringify({
          status_code: 200,
          user: { user_id: current },
          session: { user_id: current },
          session_jwt: "REMOTE_JWT_CANARY",
          session_token: "REMOTE_SESSION_CANARY",
        }),
      );
      return;
    }
    response.writeHead(404).end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closing.push(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const client = new Client({
    project_id: "project-test-google-fixture",
    secret: "inert-not-a-secret",
    env: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    timeout: 2000,
  });
  const config = {
    origin: configuredOrigin,
    projectId: "project-test-google-fixture",
    publicToken: "public-token-test-google-fixture",
    client,
    sessionDurationMinutes: 10080,
  };
  return {
    handlers: createGoogleLoginHandlers(config),
    config,
    calls,
    mode(value: string) {
      mode = value;
    },
  };
}
function pkceCookie(configuredOrigin = origin) {
  return `${configuredOrigin.startsWith("https:") ? "__Secure-" : ""}oca_google_pkce=${verifier}`;
}
function callback(
  query = `token=${oauthToken}&stytch_token_type=oauth`,
  cookie = pkceCookie(),
  configuredOrigin = origin,
) {
  return new Request(`${configuredOrigin}/api/auth/google/callback?${query}`, {
    headers: { cookie, "sec-fetch-site": "cross-site" },
  });
}
function start(configuredOrigin = origin, body?: string) {
  return new Request(`${configuredOrigin}/api/auth/google/start`, {
    method: "POST",
    headers: {
      origin: configuredOrigin,
      "sec-fetch-site": "same-origin",
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
}
async function safeRedirect(response: Response, expected: string) {
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(expected);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(await response.text()).toBe("");
}
function failureUrl(configuredOrigin = origin) {
  return `${configuredOrigin}/login?error=google_sign_in_failed`;
}

describe("GOOGLE-LOGIN installed SDK and browser-bound PKCE contract", () => {
  it.each(["http://127.0.0.1:3000", "http://[::1]:3000"])(
    "accepts Next-normalized localhost only with actual configured Host %s",
    async (configured) => {
      const { handlers, calls } = await fixture(configured);
      const normalized = "http://localhost:3000";
      const host = new URL(configured).host;
      const startRequest = new Request(`${normalized}/api/auth/google/start`, {
        method: "POST",
        headers: { origin: configured, host, "sec-fetch-site": "same-origin" },
      });
      const started = await handlers.start(startRequest);
      expect(started.status).toBe(303);
      const target = new URL(started.headers.get("location") ?? "");
      expect(target.origin).toBe("https://test.stytch.com");
      expect(target.searchParams.get("login_redirect_url")).toBe(
        `${configured}/api/auth/google/callback`,
      );
      expect(calls).toHaveLength(0);
    },
  );
  it.each(["http://127.0.0.1:3000", "http://[::1]:3000"])(
    "accepts Next-normalized callback with actual configured Host %s",
    async (configured) => {
      const { handlers, calls } = await fixture(configured);
      const request = new Request(
        `http://localhost:3000/api/auth/google/callback?token=${oauthToken}&stytch_token_type=oauth`,
        {
          headers: {
            host: new URL(configured).host,
            cookie: pkceCookie(configured),
          },
        },
      );
      await safeRedirect(
        await handlers.callback(request),
        `${configured}/install`,
      );
      expect(calls.map((call) => call.path)).toEqual([
        "/v1/oauth/authenticate",
        "/v1/sessions/authenticate",
      ]);
    },
  );
  it.each([
    ["http://127.0.0.1:3000", "http://localhost:3000", ""],
    ["http://127.0.0.1:3000", "http://localhost:3000", "localhost:3000"],
    ["http://127.0.0.1:3000", "http://localhost:3000", "127.0.0.1:3001"],
    ["http://127.0.0.1:3000", "http://localhost:3001", "127.0.0.1:3000"],
    ["http://127.0.0.1:3000", "https://localhost:3000", "127.0.0.1:3000"],
    ["http://127.0.0.1:3000", "http://other.invalid:3000", "127.0.0.1:3000"],
    ["https://commerce.invalid", "https://localhost", "commerce.invalid"],
  ])(
    "rejects normalization mismatch configured=%s target=%s Host=%s",
    async (configured, target, host) => {
      const { handlers, calls } = await fixture(configured);
      const started = await handlers.start(
        new Request(`${target}/api/auth/google/start`, {
          method: "POST",
          headers: { origin: configured, host },
        }),
      );
      await safeRedirect(started, failureUrl(configured));
      const returned = await handlers.callback(
        new Request(
          `${target}/api/auth/google/callback?token=${oauthToken}&stytch_token_type=oauth`,
          { headers: { host, cookie: pkceCookie(configured) } },
        ),
      );
      await safeRedirect(returned, failureUrl(configured));
      expect(calls).toHaveLength(0);
    },
  );
  it("start uses random SHA256 PKCE and fixed browser-only Stytch navigation", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.start(start());
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe(
      "https://test.stytch.com/v1/public/oauth/google/start",
    );
    expect([...location.searchParams.keys()].sort()).toEqual([
      "code_challenge",
      "login_redirect_url",
      "provider_prompt",
      "public_token",
      "signup_redirect_url",
    ]);
    expect(location.searchParams.get("provider_prompt")).toBe("select_account");
    expect(location.searchParams.get("public_token")).toBe(
      "public-token-test-google-fixture",
    );
    expect(location.searchParams.get("login_redirect_url")).toBe(
      `${origin}/api/auth/google/callback`,
    );
    expect(location.searchParams.get("signup_redirect_url")).toBe(
      `${origin}/api/auth/google/callback`,
    );
    const cookie = response.headers.getSetCookie()[0];
    const secret = cookie.split(";")[0].split("=")[1];
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(location.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(secret).digest("base64url"),
    );
    expect(cookie).toMatch(
      /__Secure-oca_google_pkce=.*Path=\/api\/auth\/google;.*Max-Age=600;.*HttpOnly;.*SameSite=Lax;.*Secure/,
    );
    expect(location.href).not.toContain(secret);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await response.text()).toBe("");
    expect(calls).toHaveLength(0);
    const other = await handlers.start(start());
    expect(other.headers.getSetCookie()[0]).not.toBe(cookie);
  });
  it("valid callback exchanges verifier then remotely checks identity and shares email cookies", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.callback(callback());
    await safeRedirect(response, `${origin}/install`);
    const equivalent = writeWebSessionCookies(new Response(), {
      origin,
      sessionToken,
      sessionDurationMinutes: 10080,
    });
    expect(response.headers.getSetCookie().slice(0, 2)).toEqual(
      equivalent.headers.getSetCookie(),
    );
    expect(response.headers.getSetCookie()[2]).toContain(
      "__Secure-oca_google_pkce=; Path=/api/auth/google; Max-Age=0;",
    );
    expect(response.headers.getSetCookie().join(" ")).not.toMatch(
      /ACCESS_CANARY|REFRESH_CANARY|JWT_CANARY|REMOTE_SESSION/,
    );
    expect(calls.map((call) => call.path)).toEqual([
      "/v1/oauth/authenticate",
      "/v1/sessions/authenticate",
    ]);
    expect(JSON.parse(calls[0].body)).toEqual({
      token: oauthToken,
      code_verifier: verifier,
      session_duration_minutes: 10080,
    });
    expect(JSON.parse(calls[1].body)).toEqual({ session_token: sessionToken });
  });
  it("Live namespaces select only the published Live start endpoint", async () => {
    const { config, calls } = await fixture();
    const handlers = createGoogleLoginHandlers({
      ...config,
      projectId: "project-live-fixture",
      publicToken: "public-token-live-fixture",
    });
    const response = await handlers.start(start());
    expect(new URL(response.headers.get("location") ?? "").origin).toBe(
      "https://api.stytch.com",
    );
    expect(calls).toHaveLength(0);
  });
  it("canonical localHTTP callback uses local cookies", async () => {
    const local = "http://127.0.0.1:3000";
    const { handlers } = await fixture(local);
    const response = await handlers.callback(
      callback(undefined, pkceCookie(local), local),
    );
    await safeRedirect(response, `${local}/install`);
    expect(response.headers.getSetCookie()[0]).toContain("oca_session=");
    expect(response.headers.getSetCookie().join(" ")).not.toContain("Secure");
  });
  it.each([
    "wrong-provider",
    "missing-session",
    "missing-token",
    "user-mismatch",
    "session-mismatch",
    "remote-mismatch",
    "provider-error",
  ])(
    "%s fails safely, clears only verifier, preserves existing sign-in",
    async (mode) => {
      const { handlers, mode: setMode } = await fixture();
      setMode(mode);
      const response = await handlers.callback(
        callback(
          undefined,
          `${pkceCookie()}; __Host-oca_session=EXISTING_SESSION_CANARY`,
        ),
      );
      await safeRedirect(response, failureUrl());
      expect(response.headers.getSetCookie()).toHaveLength(1);
      expect(response.headers.getSetCookie()[0]).toContain(
        "oca_google_pkce=; Path=/api/auth/google; Max-Age=0;",
      );
      expect(response.headers.getSetCookie().join(" ")).not.toContain(
        "oca_session",
      );
    },
  );
  it("returns to the same-origin page the login page saved, then clears it", async () => {
    const { handlers } = await fixture();
    const next = "/oauth/authorize?client_id=abc&scope=commerce%3Ainvoke";
    const response = await handlers.callback(
      callback(
        undefined,
        `${pkceCookie()}; __Secure-oca_login_next=${encodeURIComponent(next)}`,
      ),
    );
    await safeRedirect(response, `${origin}${next}`);
    expect(response.headers.getSetCookie().at(-1)).toContain(
      "__Secure-oca_login_next=; Path=/api/auth/google; Max-Age=0;",
    );
  });
  it.each([
    "https://evil.invalid/",
    "//evil.invalid/path",
    "/\\evil.invalid",
    "/%0D%0ALocation: https://evil.invalid",
    "relative",
    "%GG",
  ])("ignores an unsafe saved destination %s", async (next) => {
    const { handlers } = await fixture();
    const response = await handlers.callback(
      callback(
        undefined,
        `${pkceCookie()}; __Secure-oca_login_next=${encodeURIComponent(next)}`,
      ),
    );
    await safeRedirect(response, `${origin}/install`);
  });
  it("documented Google string may use lowercase spelling", async () => {
    const { handlers, mode } = await fixture();
    mode("lowercase-google");
    await safeRedirect(
      await handlers.callback(callback()),
      `${origin}/install`,
    );
  });
  it.each([
    "",
    `token=${oauthToken}`,
    `stytch_token_type=oauth`,
    `token=${oauthToken}&token=other&stytch_token_type=oauth`,
    `token=${oauthToken}&stytch_token_type=oauth&stytch_token_type=oauth`,
    `token=${oauthToken}&stytch_token_type=magic_links`,
    `token=${oauthToken}&stytch_token_type=oauth&returnTo=https://evil.invalid`,
    `token=%GG&stytch_token_type=oauth`,
    `token=%20padded&stytch_token_type=oauth`,
    `token=%0A&stytch_token_type=oauth`,
    `error=cancelled`,
  ])(
    "rejects malformed/extra/duplicate callback %s before exchange",
    async (query) => {
      const { handlers, calls } = await fixture();
      const response = await handlers.callback(callback(query));
      await safeRedirect(response, failureUrl());
      expect(response.headers.getSetCookie()).toHaveLength(1);
      expect(calls).toHaveLength(0);
    },
  );
  it.each([
    "",
    `${pkceCookie()}; ${pkceCookie()}`,
    "__Secure-oca_google_pkce=%GG",
    "__Secure-oca_google_pkce=short",
    `__Secure-oca_google_pkce=%20${verifier}`,
    `__Secure-oca_google_pkce=${"v".repeat(44)}`,
  ])(
    "rejects absent/duplicate/malformed verifier %s before exchange",
    async (cookie) => {
      const { handlers, calls } = await fixture();
      await safeRedirect(
        await handlers.callback(callback(undefined, cookie)),
        failureUrl(),
      );
      expect(calls).toHaveLength(0);
    },
  );
  it.each([null, "null", "https://other.invalid"])(
    "start rejects wrong Origin %s",
    async (header) => {
      const { handlers, calls } = await fixture();
      const request = start();
      if (header === null) {
        request.headers.delete("origin");
      } else {
        request.headers.set("origin", header);
      }
      await safeRedirect(await handlers.start(request), failureUrl());
      expect(calls).toHaveLength(0);
    },
  );
  it.each(["returnTo=/account", "{}", " "])(
    "start rejects nonempty native form %s",
    async (body) => {
      const { handlers, calls } = await fixture();
      await safeRedirect(
        await handlers.start(start(origin, body)),
        failureUrl(),
      );
      expect(calls).toHaveLength(0);
    },
  );
  it.each(["cross-site", "same-site"])(
    "start rejects %s fetch site",
    async (site) => {
      const { handlers } = await fixture();
      const request = start();
      request.headers.set("sec-fetch-site", site);
      await safeRedirect(await handlers.start(request), failureUrl());
    },
  );
  it.each([
    `${origin}/api/auth/google/start?returnTo=/other`,
    "https://other.invalid/api/auth/google/start",
    `${origin}/wrong-path`,
  ])("start rejects wrong request destination %s", async (target) => {
    const { handlers } = await fixture();
    const request = new Request(target, {
      method: "POST",
      headers: { origin },
    });
    await safeRedirect(await handlers.start(request), failureUrl());
  });
  it.each([
    "https://other.invalid/api/auth/google/callback",
    `${origin}/wrong-path?token=${oauthToken}&stytch_token_type=oauth`,
  ])("callback rejects wrong request destination %s", async (target) => {
    const { handlers, calls } = await fixture();
    await safeRedirect(
      await handlers.callback(
        new Request(target, { headers: { cookie: pkceCookie() } }),
      ),
      failureUrl(),
    );
    expect(calls).toHaveLength(0);
  });
});

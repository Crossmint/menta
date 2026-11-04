import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { webSessionCookieName } from "@oca/agent/auth";
import { Client } from "stytch";
import { afterEach, describe, expect, it } from "vitest";
import { createWebLoginHandlers } from "./handlers.js";

const origin = "https://commerce.invalid";
const projectId = "project-test-login-fixture";
const userId = "user-test-login-fixture";
const token = "OPAQUE_SESSION_CANARY";
const methodId = "EMAIL_METHOD_CANARY";
const closes: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closes.splice(0)) {
    await close();
  }
});

async function fixture(publicOrigin = origin, codeEmailTemplates?: string) {
  const calls: { path: string; body: string }[] = [];
  let mode = "valid";
  let revoked = false;
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    let body = "";
    for await (const chunk of request) {
      body += chunk.toString();
    }
    calls.push({ path: request.url ?? "", body });
    if (
      mode === "provider-error" ||
      (mode === "revoke-error" && request.url === "/v1/sessions/revoke")
    ) {
      response.writeHead(503).end(
        JSON.stringify({
          status_code: 503,
          request_id: "fixture",
          error_type: "unavailable",
          error_message: "PROVIDER_BODY_CANARY",
        }),
      );
      return;
    }
    if (request.url === "/v1/otps/email/login_or_create") {
      response.end(
        JSON.stringify({
          status_code: 200,
          request_id: "fixture",
          email_id: mode === "bad-email-id" ? " padded " : methodId,
          user_id: userId,
          user_created: true,
        }),
      );
      return;
    }
    if (request.url === "/v1/otps/authenticate") {
      if (JSON.parse(body).code !== "inert-code") {
        response.writeHead(401).end(
          JSON.stringify({
            status_code: 401,
            request_id: "fixture",
            error_type: "otp_invalid",
            error_message: "INVALID_CODE_CANARY",
          }),
        );
        return;
      }
      response.end(
        JSON.stringify({
          status_code: 200,
          request_id: "fixture",
          method_id: mode === "wrong-method" ? "other-method" : methodId,
          user_id: userId,
          session_token: mode === "missing-token" ? undefined : token,
          session_jwt: "JWT_CANARY",
          session: {
            user_id: mode === "otp-session-mismatch" ? "other-user" : userId,
          },
          user: { user_id: userId, emails: [{ email: "EMAIL_CANARY" }] },
        }),
      );
      return;
    }
    if (request.url === "/v1/sessions/authenticate") {
      if (revoked || JSON.parse(body).session_token !== token) {
        response.writeHead(401).end(
          JSON.stringify({
            status_code: 401,
            request_id: "fixture",
            error_type: "session_invalid",
            error_message: "REVOKED_CANARY",
          }),
        );
        return;
      }
      const current = mode === "identity-mismatch" ? "other-user" : userId;
      response.end(
        JSON.stringify({
          status_code: 200,
          request_id: "fixture",
          session_token: "REFRESHED_TOKEN_CANARY",
          session_jwt: "REFRESHED_JWT_CANARY",
          session: { user_id: current },
          user: {
            user_id: mode === "session-user-mismatch" ? "other-user" : current,
            email: "EMAIL_CANARY",
          },
        }),
      );
      return;
    }
    if (request.url === "/v1/sessions/revoke") {
      revoked = true;
      response.end(JSON.stringify({ status_code: 200, request_id: "fixture" }));
      return;
    }
    response.writeHead(404).end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closes.push(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const client = new Client({
    project_id: projectId,
    secret: "inert-not-a-secret",
    env: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    timeout: 2000,
  });
  const handlers = createWebLoginHandlers({
    origin: publicOrigin,
    projectId,
    client,
    sessionDurationMinutes: 10080,
    codeEmailTemplates,
  });
  return {
    handlers,
    calls,
    mode(value: string) {
      mode = value;
    },
    client,
  };
}

function post(path: string, input: object, cookie = "", publicOrigin = origin) {
  return new Request(`${publicOrigin}/api/auth/${path}`, {
    method: "POST",
    headers: {
      origin: publicOrigin,
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify(input),
  });
}
function challenge(publicOrigin = origin) {
  return `${publicOrigin.startsWith("https:") ? "__Secure-" : ""}oca_otp_method=${methodId}`;
}
function sessionCookie(publicOrigin = origin) {
  return `${webSessionCookieName(publicOrigin)}=${token}`;
}
async function safeBody(response: Response) {
  const body = await response.text();
  expect(body).not.toMatch(
    /CANARY|inert-code|buyer@|session_token|session_jwt|method_id/,
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  return JSON.parse(body);
}

describe("WEB-LOGIN installed Stytch server contract", () => {
  it("requests code without exposing method or account metadata", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.requestCode(
      post("request-code", { email: "buyer@fixture.invalid" }),
    );
    expect(response.status).toBe(200);
    expect(await safeBody(response)).toEqual({ sent: true });
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringContaining("__Secure-oca_otp_method=EMAIL_METHOD_CANARY;"),
    ]);
    expect(response.headers.get("set-cookie")).toMatch(
      /Path=\/api\/auth;.*HttpOnly;.*SameSite=Strict;.*Secure/,
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=300");
    expect(JSON.parse(calls[0].body)).toEqual({
      email: "buyer@fixture.invalid",
      expiration_minutes: 5,
    });
  });
  it("asks for the code email in the visitor's language", async () => {
    const { handlers, calls } = await fixture();
    const request = (headers: Record<string, string>) => {
      const sent = post("request-code", { email: "buyer@fixture.invalid" });
      for (const [name, value] of Object.entries(headers)) {
        sent.headers.set(name, value);
      }
      return sent;
    };
    await handlers.requestCode(
      request({ "accept-language": "pt-BR,pt;q=0.9" }),
    );
    await handlers.requestCode(
      request({ cookie: "menta_locale=fr", "accept-language": "de" }),
    );
    await handlers.requestCode(request({ "accept-language": "de-DE" }));
    expect(calls.map((call) => JSON.parse(call.body).locale)).toEqual([
      "pt-br",
      "fr",
      undefined,
    ]);
  });
  it("sends the language's own templates when they're configured", async () => {
    const { handlers, calls } = await fixture(origin, "menta-code");
    const sent = post("request-code", { email: "buyer@fixture.invalid" });
    sent.headers.set("accept-language", "ja,en;q=0.5");
    await handlers.requestCode(sent);
    expect(JSON.parse(calls[0].body)).toEqual({
      email: "buyer@fixture.invalid",
      expiration_minutes: 5,
      login_template_id: "menta-code-login-ja",
      signup_template_id: "menta-code-signup-ja",
    });
    expect(() =>
      createWebLoginHandlers({
        origin,
        projectId,
        client: new Client({ project_id: projectId, secret: "inert" }),
        sessionDurationMinutes: 10080,
        codeEmailTemplates: "Not a prefix!",
      }),
    ).toThrow("Invalid login configuration");
  });
  it("verifies code, remotely checks identity, sets only an opaque session cookie", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.verifyCode(
      post("verify-code", { code: "inert-code" }, challenge()),
    );
    expect(response.status).toBe(200);
    expect(await safeBody(response)).toEqual({ authenticated: true, userId });
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain(`__Host-oca_session=${token};`);
    expect(cookies[0]).toMatch(/Path=\/;.*HttpOnly;.*SameSite=Lax;.*Secure/);
    expect(cookies[0]).toContain("Max-Age=604800");
    expect(cookies[1]).toContain("Max-Age=0");
    expect(cookies.join(" ")).not.toMatch(/JWT_CANARY|REFRESHED_TOKEN/);
    expect(calls.map((call) => call.path)).toEqual([
      "/v1/otps/authenticate",
      "/v1/sessions/authenticate",
    ]);
    expect(JSON.parse(calls[0].body)).toEqual({
      method_id: methodId,
      code: "inert-code",
      session_duration_minutes: 10080,
    });
    expect(JSON.parse(calls[1].body)).toEqual({ session_token: token });
  });
  it("every read remotely verifies without extending session and logout revokes", async () => {
    const { handlers, calls } = await fixture();
    const read = () =>
      handlers.session(
        new Request(`${origin}/api/auth/session`, {
          headers: { cookie: sessionCookie() },
        }),
      );
    expect(await safeBody(await read())).toEqual({
      authenticated: true,
      userId,
    });
    expect(await safeBody(await read())).toEqual({
      authenticated: true,
      userId,
    });
    const response = await handlers.logout(post("logout", {}, sessionCookie()));
    expect(response.status).toBe(200);
    expect(await safeBody(response)).toEqual({ signedOut: true });
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(
      response.headers
        .getSetCookie()
        .every((value) => value.includes("Max-Age=0")),
    ).toBe(true);
    const expired = await read();
    expect(expired.status).toBe(401);
    expect(await safeBody(expired)).toEqual({ authenticated: false });
    expect(
      calls
        .filter((call) => call.path === "/v1/sessions/authenticate")
        .every(
          (call) => call.body === JSON.stringify({ session_token: token }),
        ),
    ).toBe(true);
    expect(
      calls.filter((call) => call.path === "/v1/sessions/revoke"),
    ).toHaveLength(1);
  });
  it("allows insecure cookies only with explicit canonical local HTTP origin", async () => {
    const local = "http://127.0.0.1:3000";
    const { handlers } = await fixture(local);
    const response = await handlers.verifyCode(
      post("verify-code", { code: "inert-code" }, challenge(local), local),
    );
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()[0]).toContain("oca_session=");
    expect(response.headers.getSetCookie().join(" ")).not.toContain("Secure");
  });
  it("rejects OTP identity differing from remotely verified session", async () => {
    const { handlers, mode } = await fixture();
    mode("identity-mismatch");
    const response = await handlers.verifyCode(
      post("verify-code", { code: "inert-code" }, challenge()),
    );
    expect(response.status).toBe(401);
    expect(await safeBody(response)).toEqual({
      error: "authentication_failed",
    });
    expect(
      response.headers.getSetCookie().some((cookie) => cookie.includes(token)),
    ).toBe(false);
  });
  it("failed revoke clears local cookies without claiming provider signout", async () => {
    const { handlers, mode } = await fixture();
    mode("revoke-error");
    const response = await handlers.logout(post("logout", {}, sessionCookie()));
    expect(response.status).toBe(503);
    expect(await safeBody(response)).toEqual({ error: "unavailable" });
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(
      response.headers
        .getSetCookie()
        .every((value) => value.includes("Max-Age=0")),
    ).toBe(true);
  });
  it("invalid code and provider errors stay fixed and never leak bodies", async () => {
    const { handlers, mode } = await fixture();
    const wrong = await handlers.verifyCode(
      post("verify-code", { code: "wrong" }, challenge()),
    );
    expect(wrong.status).toBe(401);
    expect(await safeBody(wrong)).toEqual({ error: "authentication_failed" });
    mode("provider-error");
    const unavailable = await handlers.requestCode(
      post("request-code", { email: "buyer@fixture.invalid" }),
    );
    expect(unavailable.status).toBe(503);
    expect(await safeBody(unavailable)).toEqual({ error: "unavailable" });
  });
  it.each([
    "",
    `${challenge()}; ${challenge()}`,
    "__Secure-oca_otp_method=%GG",
    "__Secure-oca_otp_method=%0A",
  ])(
    "missing/ambiguous/malformed challenge fails before provider: %s",
    async (cookie) => {
      const { handlers, calls } = await fixture();
      const response = await handlers.verifyCode(
        post("verify-code", { code: "inert-code" }, cookie),
      );
      expect(response.status).toBe(401);
      expect(await safeBody(response)).toEqual({
        error: "authentication_failed",
      });
      expect(calls).toHaveLength(0);
    },
  );
  it.each([
    "",
    `${sessionCookie()}; ${sessionCookie()}`,
    "__Host-oca_session=%GG",
    "__Host-oca_session=%20padded",
  ])(
    "missing/ambiguous/malformed session fails before provider: %s",
    async (cookie) => {
      const { handlers, calls } = await fixture();
      const response = await handlers.session(
        new Request(`${origin}/api/auth/session`, { headers: { cookie } }),
      );
      expect(response.status).toBe(401);
      expect(await safeBody(response)).toEqual({ authenticated: false });
      expect(calls).toHaveLength(0);
    },
  );
  it.each([
    "https://commerce.invalid/",
    " https://commerce.invalid",
    "http://commerce.invalid",
    "https://user:pass@commerce.invalid",
    "https://commerce.invalid/path",
    "http://192.168.0.2",
  ])("rejects noncanonical/unsafe configuration %s", async (configured) => {
    const { client } = await fixture();
    expect(() =>
      createWebLoginHandlers({
        origin: configured,
        projectId,
        client,
        sessionDurationMinutes: 10080,
      }),
    ).toThrow("Invalid login configuration");
  });
  it.each([null, "https://other.invalid", "null"])(
    "rejects missing or wrong POST origin %s before provider",
    async (requestOrigin) => {
      const { handlers, calls } = await fixture();
      const request = post("request-code", { email: "buyer@fixture.invalid" });
      if (requestOrigin === null) {
        request.headers.delete("origin");
      } else {
        request.headers.set("origin", requestOrigin);
      }
      const response = await handlers.requestCode(request);
      expect(response.status).toBe(403);
      expect(await safeBody(response)).toEqual({ error: "request_rejected" });
      expect(calls).toHaveLength(0);
    },
  );
  it.each(["cross-site", "same-site"])(
    "rejects %s session reads before provider",
    async (site) => {
      const { handlers, calls } = await fixture();
      const response = await handlers.session(
        new Request(`${origin}/api/auth/session`, {
          headers: { cookie: sessionCookie(), "sec-fetch-site": site },
        }),
      );
      expect(response.status).toBe(403);
      expect(await safeBody(response)).toEqual({ error: "request_rejected" });
      expect(calls).toHaveLength(0);
    },
  );
  it.each([
    { email: "not-email" },
    { email: "buyer@fixture.invalid", userId: "injected" },
  ])("rejects invalid/extra JSON %j before provider", async (body) => {
    const { handlers, calls } = await fixture();
    const response = await handlers.requestCode(post("request-code", body));
    expect(response.status).toBe(400);
    expect(await safeBody(response)).toEqual({ error: "request_rejected" });
    expect(calls).toHaveLength(0);
  });
  it.each(["text/plain", "application/x-www-form-urlencoded"])(
    "rejects non-JSON %s before provider",
    async (contentType) => {
      const { handlers, calls } = await fixture();
      const request = post("request-code", { email: "buyer@fixture.invalid" });
      request.headers.set("content-type", contentType);
      const response = await handlers.requestCode(request);
      expect(response.status).toBe(400);
      expect(calls).toHaveLength(0);
    },
  );
  it("bounds actual body bytes without trusting content-length", async () => {
    const { handlers, calls } = await fixture();
    const request = new Request(`${origin}/api/auth/request-code`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ email: `${"x".repeat(5000)}@fixture.invalid` }),
    });
    const response = await handlers.requestCode(request);
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("rejects method-ID injection into code-only verification", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.verifyCode(
      post(
        "verify-code",
        { code: "inert-code", methodId: "caller-selected" },
        challenge(),
      ),
    );
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it.each([
    ["wrong-method", 401],
    ["otp-session-mismatch", 401],
    ["session-user-mismatch", 401],
    ["missing-token", 503],
  ])("fails closed for provider %s", async (kind, status) => {
    const { handlers, mode } = await fixture();
    mode(String(kind));
    const response = await handlers.verifyCode(
      post("verify-code", { code: "inert-code" }, challenge()),
    );
    expect(response.status).toBe(status);
    expect(await safeBody(response)).toEqual({
      error: status === 401 ? "authentication_failed" : "unavailable",
    });
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
  it("malformed provider challenge never becomes a browser cookie", async () => {
    const { handlers, mode } = await fixture();
    mode("bad-email-id");
    const response = await handlers.requestCode(
      post("request-code", { email: "buyer@fixture.invalid" }),
    );
    expect(response.status).toBe(503);
    expect(await safeBody(response)).toEqual({ error: "unavailable" });
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
  it("rejects a foreign explicit GET Origin", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.session(
      new Request(`${origin}/api/auth/session`, {
        headers: { cookie: sessionCookie(), origin: "https://other.invalid" },
      }),
    );
    expect(response.status).toBe(403);
    expect(await safeBody(response)).toEqual({ error: "request_rejected" });
    expect(calls).toHaveLength(0);
  });
  it("rejects logout credential injection without revoking", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.logout(
      post("logout", { session_token: "caller-selected" }, sessionCookie()),
    );
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("missing logout session does not claim provider signout", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.logout(post("logout", {}));
    expect(response.status).toBe(401);
    expect(await safeBody(response)).toEqual({
      error: "authentication_failed",
    });
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(calls).toHaveLength(0);
  });
  it("rejects cross-site POST despite a forged matching Origin", async () => {
    const { handlers, calls } = await fixture();
    const request = post("request-code", { email: "buyer@fixture.invalid" });
    request.headers.set("sec-fetch-site", "cross-site");
    const response = await handlers.requestCode(request);
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("rejects malformed JSON before provider", async () => {
    const { handlers, calls } = await fixture();
    const response = await handlers.requestCode(
      new Request(`${origin}/api/auth/request-code`, {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

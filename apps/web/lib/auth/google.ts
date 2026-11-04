import { createHash, randomBytes } from "node:crypto";
import { createStytchWebAuthenticator } from "@oca/agent/auth";
import type { Client } from "stytch";
import { z } from "zod";
import { writeWebSessionCookies } from "./cookies";

const opaque = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => {
    return value === value.trim() && !/\p{Cc}/u.test(value);
  });
const verifier = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const oauthSession = z.object({
  status_code: z.literal(200),
  provider_type: z.string().regex(/^google$/i),
  user_id: opaque,
  user: z.object({ user_id: opaque }),
  user_session: z.object({ user_id: opaque }),
  session_token: opaque,
});

/**
 * Cookie the login page sets (Path=/api/auth/google, `__Secure-` on HTTPS)
 * with the same-origin path to open after Google sign-in.
 */
export const googleNextCookie = "oca_login_next";

/** Server-only Google login; Stytch owns OAuth state and identity matching. */
export function createGoogleLoginHandlers(options: {
  origin: string;
  projectId: string;
  publicToken: string;
  client: Pick<Client, "oauth" | "sessions">;
  sessionDurationMinutes: number;
}) {
  let secure: boolean;
  let configuredOrigin: URL;
  let configuredLoopback: boolean;
  let environment: "test" | "live";
  let authenticator: ReturnType<typeof createStytchWebAuthenticator>;
  try {
    const url = new URL(options.origin);
    const loopback =
      url.hostname === "localhost" ||
      url.hostname === "[::1]" ||
      /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
    const project = /^project-(test|live)-\S+$/.exec(options.projectId);
    const publicToken = /^public-token-(test|live)-\S+$/.exec(
      options.publicToken,
    );
    if (
      url.origin !== options.origin ||
      !(url.protocol === "https:" || (url.protocol === "http:" && loopback)) ||
      !project ||
      !publicToken ||
      project[1] !== publicToken[1] ||
      !Number.isInteger(options.sessionDurationMinutes) ||
      options.sessionDurationMinutes < 5 ||
      options.sessionDurationMinutes > 527040 ||
      typeof options.client?.oauth?.authenticate !== "function"
    ) {
      throw new Error();
    }
    secure = url.protocol === "https:";
    configuredOrigin = url;
    configuredLoopback = loopback;
    environment = project[1] as "test" | "live";
    authenticator = createStytchWebAuthenticator({
      projectId: options.projectId,
      client: options.client,
    });
  } catch {
    throw new Error("Invalid Google login configuration");
  }
  const { origin, publicToken, client, sessionDurationMinutes } = options;
  const cookieName = `${secure ? "__Secure-" : ""}oca_google_pkce`;
  const nextCookieName = `${secure ? "__Secure-" : ""}${googleNextCookie}`;
  const callbackPath = "/api/auth/google/callback";
  const failurePath = "/login?error=google_sign_in_failed";

  function redirect(path: string) {
    // Response.redirect creates immutable headers; cookie publication requires
    // this mutable native Response instead.
    return new Response(null, {
      status: 303,
      headers: {
        Location: `${origin}${path}`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  function cookie(value: string, maxAge: number) {
    return `${cookieName}=${value}; Path=/api/auth/google; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  }
  function clearVerifier(response: Response) {
    response.headers.append("Set-Cookie", cookie("", 0));
    return response;
  }
  function destination(request: Request, path: string) {
    const url = new URL(request.url);
    // Next normalizes loopback Request URLs to localhost. The actual Host must
    // still identify the exact trusted configured authority for this exception.
    const normalizedLoopback =
      configuredLoopback &&
      url.hostname === "localhost" &&
      url.protocol === configuredOrigin.protocol &&
      url.port === configuredOrigin.port &&
      request.headers.get("host") === configuredOrigin.host;
    if (
      (url.origin !== origin && !normalizedLoopback) ||
      url.pathname !== path ||
      url.username ||
      url.password ||
      url.hash
    ) {
      throw new Error();
    }
    return url;
  }
  /**
   * Where to land after sign-in. The login page sets this cookie before
   * leaving for Google; only same-origin paths are honored.
   */
  function readNext(request: Request) {
    const matches = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${nextCookieName}=`));
    if (matches.length !== 1) {
      return null;
    }
    try {
      const path = decodeURIComponent(
        matches[0].slice(nextCookieName.length + 1),
      );
      if (
        path.length > 2048 ||
        !/^\/(?![/\\])[^\s\\]*$/.test(path) ||
        new URL(path, origin).origin !== origin
      ) {
        return null;
      }
      return path;
    } catch {
      return null;
    }
  }
  function clearNext(response: Response) {
    response.headers.append(
      "Set-Cookie",
      `${nextCookieName}=; Path=/api/auth/google; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`,
    );
    return response;
  }
  function readVerifier(request: Request) {
    const matches = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${cookieName}=`));
    if (matches.length !== 1) {
      throw new Error();
    }
    return verifier.parse(
      decodeURIComponent(matches[0].slice(cookieName.length + 1)),
    );
  }
  async function requireEmptyBody(request: Request) {
    if (!request.body) {
      return;
    }
    const reader = request.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        if (value.byteLength > 0) {
          await reader.cancel();
          throw new Error();
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  return {
    async start(request: Request): Promise<Response> {
      try {
        const url = destination(request, "/api/auth/google/start");
        const site = request.headers.get("sec-fetch-site");
        if (
          request.method !== "POST" ||
          url.search ||
          request.headers.get("origin") !== origin ||
          (site !== null && site !== "same-origin" && site !== "none")
        ) {
          throw new Error();
        }
        await requireEmptyBody(request);
        const secret = randomBytes(32).toString("base64url");
        const challenge = createHash("sha256")
          .update(secret)
          .digest("base64url");
        const target = new URL(
          `https://${environment === "test" ? "test" : "api"}.stytch.com/v1/public/oauth/google/start`,
        );
        target.searchParams.set("public_token", publicToken);
        target.searchParams.set(
          "login_redirect_url",
          `${origin}${callbackPath}`,
        );
        target.searchParams.set(
          "signup_redirect_url",
          `${origin}${callbackPath}`,
        );
        target.searchParams.set("code_challenge", challenge);
        // Always show Google's account picker instead of reusing the signed-in account.
        target.searchParams.set("provider_prompt", "select_account");
        const response = redirect(failurePath);
        response.headers.set("Location", target.href);
        response.headers.append("Set-Cookie", cookie(secret, 600));
        return response;
      } catch {
        return redirect(failurePath);
      }
    },
    async callback(request: Request): Promise<Response> {
      try {
        const url = destination(request, callbackPath);
        if (request.method !== "GET") {
          throw new Error();
        }
        // URLSearchParams is deliberately forgiving of malformed %-encoding;
        // reject it first rather than exchanging altered input.
        decodeURIComponent(url.search.slice(1));
        const parameters = [...url.searchParams.keys()];
        if (
          parameters.length !== 2 ||
          url.searchParams.getAll("token").length !== 1 ||
          url.searchParams.getAll("stytch_token_type").length !== 1 ||
          url.searchParams.get("stytch_token_type") !== "oauth"
        ) {
          throw new Error();
        }
        const token = opaque.parse(url.searchParams.get("token"));
        const secret = readVerifier(request);
        const result = oauthSession.parse(
          await client.oauth.authenticate({
            token,
            code_verifier: secret,
            session_duration_minutes: sessionDurationMinutes,
          }),
        );
        if (
          result.user_id !== result.user.user_id ||
          result.user_id !== result.user_session.user_id
        ) {
          throw new Error();
        }
        const principal = await authenticator.authenticateWebSession(
          result.session_token,
        );
        if (principal.subject !== result.user_id) {
          throw new Error();
        }
        const next = readNext(request);
        const response = clearVerifier(
          writeWebSessionCookies(redirect(next ?? "/install"), {
            origin,
            sessionToken: result.session_token,
            sessionDurationMinutes,
          }),
        );
        return next ? clearNext(response) : response;
      } catch {
        return clearVerifier(redirect(failurePath));
      }
    },
  };
}

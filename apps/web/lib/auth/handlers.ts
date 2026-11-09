import { createHash, timingSafeEqual } from "node:crypto";
import {
  createStytchWebAuthenticator,
  readWebSessionToken,
  webSessionCookieName,
} from "@oca/agent/auth";
import bcrypt from "bcryptjs";
import { type Client, StytchError } from "stytch";
import { z } from "zod";
import {
  isLocale,
  LOCALE_COOKIE,
  type Locale,
  negotiate,
} from "../i18n/locales";
import { CODE_LIFETIME_MINUTES } from "./code-email";
import {
  anonymousSession,
  authErrorResult,
  authenticatedSession,
  logoutResult,
  passwordInput,
  requestCodeInput,
  requestCodeResult,
  verifyCodeInput,
} from "./contracts";
import { writeWebSessionCookies } from "./cookies";

const opaque = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => {
    return value === value.trim() && !/\p{Cc}/u.test(value);
  });
const userId = opaque;
const codeSent = z.object({ status_code: z.literal(200), email_id: opaque });
const codeVerified = z.object({
  status_code: z.literal(200),
  method_id: opaque,
  user_id: userId,
  user: z.object({ user_id: userId }),
  session: z.object({ user_id: userId }),
  session_token: opaque,
});
const passwordVerified = z.object({
  status_code: z.literal(200),
  user_id: userId,
  user: z.object({ user_id: userId }),
  session_token: opaque,
});
const revokedSession = z.object({ status_code: z.literal(200) });
const maximumBodyBytes = 4096;
const challengeLifetimeSeconds = 300;

/** The languages Stytch's default emails come in, besides English. */
const STYTCH_LOCALES: Partial<Record<Locale, string>> = {
  es: "es",
  fr: "fr",
  pt: "pt-br",
};

/** The visitor's language: their choice on the site, else their browser's. API routes skip the proxy that decides it for pages. */
function requestLocale(request: Request): Locale {
  const chosen = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(chosen)
    ? chosen
    : negotiate(request.headers.get("accept-language"));
}

class LoginFailure extends Error {
  constructor(readonly status: 400 | 401 | 403 | 503) {
    super("Login request failed");
  }
}

function digest(password: string) {
  return createHash("sha256").update(password).digest();
}

/** Server-owned configuration; never derive the trusted origin from request headers. */
export function createWebLoginHandlers(options: {
  origin: string;
  projectId: string;
  /** `passwords` only when there are review accounts. */
  client: Pick<Client, "otps" | "sessions"> &
    Partial<Pick<Client, "passwords">>;
  sessionDurationMinutes: number;
  /**
   * Prefix of the Stytch custom HTML templates for the code email, one per
   * language and action (`{prefix}-login-{locale}`, `{prefix}-signup-{locale}`).
   * Without it, Stytch's default email in the four languages it has.
   */
  codeEmailTemplates?: string;
  /**
   * Emails that sign in with a Stytch password instead of a code: the review
   * account OpenAI's reviewers use, who can't receive our emails. Lowercase.
   */
  reviewAccounts?: readonly string[];
  /**
   * The review accounts' password. Set, Menta checks it and, when Stytch
   * doesn't hold it yet, writes it there (as a bcrypt hash) and signs in again,
   * so nobody needs the Stytch secret to set it. Unset, the password is
   * whatever was set in Stytch.
   */
  reviewPassword?: string;
}) {
  let secure: boolean;
  let authenticator: ReturnType<typeof createStytchWebAuthenticator>;
  try {
    const configured = new URL(options.origin);
    const loopback =
      configured.hostname === "localhost" ||
      configured.hostname === "[::1]" ||
      /^127\.\d+\.\d+\.\d+$/.test(configured.hostname);
    if (
      configured.origin !== options.origin ||
      !(
        configured.protocol === "https:" ||
        (configured.protocol === "http:" && loopback)
      ) ||
      !Number.isInteger(options.sessionDurationMinutes) ||
      options.sessionDurationMinutes < 5 ||
      options.sessionDurationMinutes > 527040 ||
      typeof options.client?.otps?.email?.loginOrCreate !== "function" ||
      typeof options.client?.otps?.authenticate !== "function" ||
      typeof options.client?.sessions?.revoke !== "function" ||
      (options.reviewAccounts?.length &&
        typeof options.client?.passwords?.authenticate !== "function") ||
      (options.reviewPassword !== undefined &&
        (options.reviewPassword.length < 16 ||
          options.reviewPassword.length > 256 ||
          typeof options.client?.passwords?.migrate !== "function")) ||
      options.reviewAccounts?.some(
        (email) =>
          email !== email.trim().toLowerCase() ||
          !z.email().safeParse(email).success,
      ) ||
      (options.codeEmailTemplates !== undefined &&
        !/^[a-z0-9-]{1,40}$/.test(options.codeEmailTemplates))
    ) {
      throw new Error();
    }
    secure = configured.protocol === "https:";
    authenticator = createStytchWebAuthenticator({
      projectId: options.projectId,
      client: options.client,
    });
  } catch {
    throw new Error("Invalid login configuration");
  }
  const { origin, client, sessionDurationMinutes, codeEmailTemplates } =
    options;
  const reviewAccounts = new Set(options.reviewAccounts);
  const reviewPassword =
    options.reviewPassword === undefined
      ? undefined
      : digest(options.reviewPassword);
  const sessionName = webSessionCookieName(origin);
  const challengeName = `${secure ? "__Secure-" : ""}oca_otp_method`;

  function json(body: object, status = 200) {
    return Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  function failure(error: unknown) {
    const status = error instanceof LoginFailure ? error.status : 503;
    return json(
      authErrorResult.parse({
        error:
          status === 401
            ? "authentication_failed"
            : status === 503
              ? "unavailable"
              : "request_rejected",
      }),
      status,
    );
  }
  function cookie(
    name: string,
    value: string,
    maxAge: number,
    challenge = false,
  ) {
    return `${name}=${encodeURIComponent(value)}; Path=${challenge ? "/api/auth" : "/"}; Max-Age=${maxAge}; HttpOnly; SameSite=${challenge ? "Strict" : "Lax"}${secure ? "; Secure" : ""}`;
  }
  function clearCookies(response: Response) {
    response.headers.append("Set-Cookie", cookie(sessionName, "", 0));
    response.headers.append("Set-Cookie", cookie(challengeName, "", 0, true));
    return response;
  }
  function checkSite(request: Request, post: boolean) {
    const requestOrigin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    if (
      request.method !== (post ? "POST" : "GET") ||
      (post
        ? requestOrigin !== origin
        : requestOrigin !== null && requestOrigin !== origin) ||
      (site !== null && site !== "same-origin" && site !== "none")
    ) {
      throw new LoginFailure(403);
    }
  }
  async function body(request: Request) {
    checkSite(request, true);
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    ) {
      throw new LoginFailure(400);
    }
    if (!request.body) {
      throw new LoginFailure(400);
    }
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        length += value.byteLength;
        if (length > maximumBodyBytes) {
          await reader.cancel();
          throw new LoginFailure(400);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new LoginFailure(400);
    } finally {
      reader.releaseLock();
    }
  }
  async function input<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
    const parsed = schema.safeParse(await body(request));
    if (!parsed.success) {
      throw new LoginFailure(400);
    }
    return parsed.data;
  }
  /** The template (or Stytch's own language) for the code email in this language. */
  function codeEmail(locale: Locale) {
    if (codeEmailTemplates) {
      return {
        login_template_id: `${codeEmailTemplates}-login-${locale}`,
        signup_template_id: `${codeEmailTemplates}-signup-${locale}`,
      };
    }
    const stytchLocale = STYTCH_LOCALES[locale];
    return stytchLocale ? { locale: stytchLocale } : {};
  }
  function challenge(request: Request) {
    const matching = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${challengeName}=`));
    try {
      if (matching.length !== 1) {
        throw new Error();
      }
      return opaque.parse(
        decodeURIComponent(matching[0].slice(challengeName.length + 1)),
      );
    } catch {
      throw new LoginFailure(401);
    }
  }
  async function verified(request: Request) {
    const token = readWebSessionToken(request, origin);
    if (!token) {
      throw new LoginFailure(401);
    }
    try {
      const principal = await authenticator.authenticateWebSession(token);
      return { token, userId: principal.subject };
    } catch {
      throw new LoginFailure(401);
    }
  }

  /** Stytch signed this user in: check the session is theirs and set the cookies. */
  async function signedIn(sessionToken: string, userId: string) {
    let principal: Awaited<
      ReturnType<typeof authenticator.authenticateWebSession>
    >;
    try {
      principal = await authenticator.authenticateWebSession(sessionToken);
    } catch {
      throw new LoginFailure(401);
    }
    if (principal.subject !== userId) {
      throw new LoginFailure(401);
    }
    const result = json(
      authenticatedSession.parse({
        authenticated: true,
        userId: principal.subject,
      }),
    );
    return writeWebSessionCookies(result, {
      origin,
      sessionToken,
      sessionDurationMinutes,
    });
  }
  /** Stytch refused the credentials (4xx) or couldn't answer. */
  function refused(error: unknown): never {
    if (
      error instanceof StytchError &&
      error.status_code >= 400 &&
      error.status_code < 500
    ) {
      throw new LoginFailure(401);
    }
    throw new LoginFailure(503);
  }

  return {
    async requestCode(request: Request): Promise<Response> {
      try {
        const { email } = await input(request, requestCodeInput);
        // A review account signs in at /login?password; asking for its code
        // looks like any other email's and sends nothing.
        if (reviewAccounts.has(email.toLowerCase())) {
          return json(requestCodeResult.parse({ sent: true }));
        }
        const sent = codeSent.parse(
          await client.otps.email.loginOrCreate({
            email,
            expiration_minutes: CODE_LIFETIME_MINUTES,
            ...codeEmail(requestLocale(request)),
          }),
        );
        const response = json(requestCodeResult.parse({ sent: true }));
        response.headers.append(
          "Set-Cookie",
          cookie(challengeName, sent.email_id, challengeLifetimeSeconds, true),
        );
        return response;
      } catch (error) {
        return failure(error);
      }
    },
    async verifyCode(request: Request): Promise<Response> {
      try {
        const { code } = await input(request, verifyCodeInput);
        const methodId = challenge(request);
        let response: Awaited<ReturnType<typeof client.otps.authenticate>>;
        try {
          response = await client.otps.authenticate({
            method_id: methodId,
            code,
            session_duration_minutes: sessionDurationMinutes,
          });
        } catch (error) {
          refused(error);
        }
        const session = codeVerified.parse(response);
        if (
          session.method_id !== methodId ||
          session.user_id !== session.user.user_id ||
          session.user_id !== session.session.user_id
        ) {
          throw new LoginFailure(401);
        }
        return await signedIn(session.session_token, session.user_id);
      } catch (error) {
        return failure(error);
      }
    },
    /** Only the review accounts have a password; anyone else signs in with a code. */
    async signInWithPassword(request: Request): Promise<Response> {
      try {
        const { email, password } = await input(request, passwordInput);
        const passwords = client.passwords;
        if (!passwords || !reviewAccounts.has(email.toLowerCase())) {
          throw new LoginFailure(401);
        }
        if (
          reviewPassword &&
          !timingSafeEqual(digest(password), reviewPassword)
        ) {
          throw new LoginFailure(401);
        }
        const authenticate = () =>
          passwords.authenticate({
            email,
            password,
            session_duration_minutes: sessionDurationMinutes,
          });
        let response: Awaited<ReturnType<typeof passwords.authenticate>>;
        try {
          response = await authenticate();
        } catch (error) {
          if (
            !reviewPassword ||
            !(error instanceof StytchError) ||
            error.status_code >= 500 ||
            error.error_type === "too_many_requests" ||
            error.error_type === "reset_password"
          ) {
            refused(error);
          }
          // Stytch doesn't hold the configured password yet: give it, then sign
          // in. A migrate refused because a concurrent sign-in just gave it
          // still signs in; one refused because Stytch holds another password
          // doesn't.
          try {
            await passwords.migrate({
              email,
              hash: await bcrypt.hash(password, 12),
              hash_type: "bcrypt",
            });
          } catch (migrate) {
            if (
              !(migrate instanceof StytchError) ||
              migrate.status_code >= 500
            ) {
              refused(migrate);
            }
          }
          try {
            response = await authenticate();
          } catch (retry) {
            refused(retry);
          }
        }
        const session = passwordVerified.parse(response);
        if (session.user_id !== session.user.user_id) {
          throw new LoginFailure(401);
        }
        return await signedIn(session.session_token, session.user_id);
      } catch (error) {
        return failure(error);
      }
    },
    async session(request: Request): Promise<Response> {
      try {
        checkSite(request, false);
        const current = await verified(request);
        return json(
          authenticatedSession.parse({
            authenticated: true,
            userId: current.userId,
          }),
        );
      } catch (error) {
        if (error instanceof LoginFailure && error.status === 401) {
          const response = json(
            anonymousSession.parse({ authenticated: false }),
            401,
          );
          response.headers.append("Set-Cookie", cookie(sessionName, "", 0));
          return response;
        }
        return failure(error);
      }
    },
    async logout(request: Request): Promise<Response> {
      try {
        await input(request, z.object({}).strict());
        const current = await verified(request);
        try {
          revokedSession.parse(
            await client.sessions.revoke({ session_token: current.token }),
          );
        } catch {
          return clearCookies(failure(new LoginFailure(503)));
        }
        return clearCookies(json(logoutResult.parse({ signedOut: true })));
      } catch (error) {
        const response = failure(error);
        return error instanceof LoginFailure && error.status === 401
          ? clearCookies(response)
          : response;
      }
    },
  };
}

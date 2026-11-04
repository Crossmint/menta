import { readWebSessionToken, webSessionCookieName } from "@oca/agent/auth";
import { mcpAuthorizationServerUrl } from "@oca/agent/mcp";
import { Client } from "stytch";

let client: Client | undefined;
/** Server-side Stytch client for the configured Consumer project. */
export function stytch() {
  client ??= new Client({
    project_id: env("STYTCH_PROJECT_ID"),
    secret: env("STYTCH_SECRET"),
    timeout: 10000,
  });
  return client;
}

let connectedApps: Client | undefined;
/**
 * Stytch client for Connected Apps consent. It calls through the project
 * domain because Stytch stamps the authorization response's `iss` with the
 * domain it was called on (stytch.com/{project} otherwise), and assistants
 * require it to equal the advertised issuer (RFC 9207).
 */
export function stytchConnectedApps() {
  const issuer = mcpAuthorizationServerUrl();
  if (!issuer) {
    return stytch();
  }
  connectedApps ??= new Client({
    project_id: env("STYTCH_PROJECT_ID"),
    secret: env("STYTCH_SECRET"),
    timeout: 10000,
    custom_base_url: issuer,
  });
  return connectedApps;
}

export function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export function origin() {
  return new URL(env("OCA_WEB_ORIGIN")).origin;
}

export interface CurrentUser {
  /** Stytch user ID: also the Crossmint user the server and browser act for. */
  readonly id: string;
  readonly email: string | null;
  readonly name: string | null;
  /** Profile photo from the sign-in provider (e.g. Google), https only. */
  readonly picture: string | null;
  /** Short-lived Stytch session JWT, accepted by Crossmint's browser components. */
  readonly jwt: string;
  readonly principal: {
    authenticator: "stytch";
    principalType: "user";
    principalId: string;
    issuer: string;
    subject: string;
    attributes: Record<string, never>;
  };
}

/** Verifies the caller's Stytch session cookie on every call. */
export async function currentUser(
  request: Request,
): Promise<CurrentUser | null> {
  const token = readWebSessionToken(request, origin());
  if (!token) {
    return null;
  }
  try {
    const result = await stytch().sessions.authenticate({
      session_token: token,
    });
    const name = [result.user.name?.first_name, result.user.name?.last_name]
      .filter(Boolean)
      .join(" ");
    const id = result.user.user_id;
    const picture =
      result.user.providers
        .map((provider) => provider.profile_picture_url)
        .find((url) => url?.startsWith("https://")) ?? null;
    return {
      id,
      email: result.user.emails[0]?.email ?? null,
      name: name || null,
      picture,
      jwt: result.session_jwt,
      principal: {
        authenticator: "stytch",
        principalType: "user",
        principalId: id,
        issuer: `stytch.com/${env("STYTCH_PROJECT_ID")}`,
        subject: id,
        attributes: {},
      },
    };
  } catch {
    return null;
  }
}

/** The caller's Stytch session token, for provider calls made on their behalf. */
export function sessionToken(request: Request) {
  return readWebSessionToken(request, origin());
}

/** State-changing JSON routes accept only requests sent by our own pages. */
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === origin();
}

export function sessionCookieName() {
  return webSessionCookieName(origin());
}

export function unauthorized() {
  return Response.json(
    { error: "Sign in to continue." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

/** The signed-in user for a server component, from the request's cookies. */
export async function currentUserFromCookies() {
  const { cookies } = await import("next/headers");
  const cookie = (await cookies()).toString();
  return currentUser(new Request(origin(), { headers: { cookie } }));
}

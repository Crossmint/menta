import { randomUUID } from "node:crypto";
import { calculateJwkThumbprint, exportJWK, importPKCS8, SignJWT } from "jose";
import { Client } from "stytch";

/**
 * Credentials for Crossmint's components inside the checkout card: the client
 * key plus a short-lived Stytch session JWT for the card's user (Crossmint's
 * project trusts Stytch session JWTs; the host's MCP access token is not one).
 * They travel only in an app-only tool result's `_meta`, never in model content.
 */
export interface CardCredentials {
  readonly apiKey: string;
  readonly jwt: string;
  /** The buyer's email: Crossmint needs it to enroll a card for agent payments. */
  readonly email: string;
  /** When the JWT stops working (ms since epoch). */
  readonly expiresAt: number;
}

export interface CardCredentialsOptions {
  readonly stytch: Pick<Client, "users" | "sessions">;
  /** Stytch Trusted Auth Token profile that trusts our signing key. */
  readonly profileId: string;
  /** PKCS#8 PEM RSA private key. Its public half is on the Stytch profile. */
  readonly privateKey: string;
  /** `iss` and `aud` the profile expects. */
  readonly issuer: string;
  readonly audience: string;
  /** Crossmint client key for the browser components. */
  readonly apiKey: string;
  readonly now?: () => number;
}

/** Stytch's shortest session; attested sessions can't be extended. */
const SESSION_MINUTES = 5;
/** The assertion we sign only needs to live long enough to be attested. */
const ASSERTION_SECONDS = 60;

/**
 * Mints card credentials for a verified user through Stytch Trusted Auth
 * Tokens: we sign an assertion for the user's email with our own key, Stytch
 * attests it into a five-minute session, and we keep the session only if
 * Stytch resolved it to the same user. Anything unexpected returns null, so
 * the card falls back to the secure page. Tokens are never logged.
 */
export function createCardCredentials(options: CardCredentialsOptions) {
  const now = options.now ?? Date.now;
  const key = importPKCS8(options.privateKey, "RS256", { extractable: true });
  const kid = key.then(async (value) =>
    calculateJwkThumbprint(await exportJWK(value)),
  );
  // Surface a bad key once, at first use, without an unhandled rejection now.
  key.catch(() => undefined);

  return async function mint(userId: string): Promise<CardCredentials | null> {
    if (!userId) {
      return null;
    }
    let sessionToken: string | null = null;
    try {
      const user = await options.stytch.users.get({ user_id: userId });
      if (user.user_id !== userId) {
        return null;
      }
      const email = (
        user.emails.find((item) => item.verified) ?? user.emails[0]
      )?.email;
      if (!email) {
        return null;
      }
      const issuedAt = Math.floor(now() / 1000);
      const assertion = await new SignJWT({ email })
        .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: await kid })
        .setIssuer(options.issuer)
        .setAudience(options.audience)
        .setSubject(userId)
        .setJti(randomUUID())
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + ASSERTION_SECONDS)
        .sign(await key);
      const attested = await options.stytch.sessions.attest({
        profile_id: options.profileId,
        token: assertion,
        session_duration_minutes: SESSION_MINUTES,
      });
      sessionToken = attested.session_token || null;
      if (
        attested.user_id !== userId ||
        attested.user?.user_id !== userId ||
        typeof attested.session_jwt !== "string" ||
        !attested.session_jwt
      ) {
        throw new Error("mismatch");
      }
      sessionToken = null;
      return {
        apiKey: options.apiKey,
        jwt: attested.session_jwt,
        email,
        expiresAt: now() + SESSION_MINUTES * 60_000,
      };
    } catch {
      // Stytch matched someone else (or answered oddly): end that session.
      if (sessionToken) {
        await options.stytch.sessions
          .revoke({ session_token: sessionToken })
          .catch(() => undefined);
      }
      console.error("Card credentials unavailable for this request.");
      return null;
    }
  };
}

export type MintCardCredentials = ReturnType<typeof createCardCredentials>;

/** `iss` and `aud` of our Trusted Auth Token assertions; the Stytch profile must match. */
export function cardTokenClaims(origin: string) {
  return { issuer: origin, audience: `${origin}/mcp/card` };
}

/**
 * The minter, when its Stytch Trusted Auth Token profile and signing key are
 * configured (`OCA_MCP_CARD_TOKEN_PROFILE_ID`, `OCA_MCP_CARD_TOKEN_PRIVATE_KEY`).
 * Missing or invalid: null, and whatever needs a user session for Crossmint
 * falls back to the user's browser. Never echoes values.
 */
export function cardCredentialsFromEnv(
  origin: string,
  apiKey: () => string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): MintCardCredentials | null {
  const profileId = env.OCA_MCP_CARD_TOKEN_PROFILE_ID?.trim();
  const privateKey = env.OCA_MCP_CARD_TOKEN_PRIVATE_KEY?.trim().replaceAll(
    "\\n",
    "\n",
  );
  if (!profileId || !privateKey) {
    return null;
  }
  if (
    !/^trusted-(?:auth-)?token-profile-[A-Za-z0-9-]+$/.test(profileId) ||
    !privateKey.includes("-----BEGIN PRIVATE KEY-----")
  ) {
    console.error(
      "User sessions for Crossmint disabled: check OCA_MCP_CARD_TOKEN_PROFILE_ID and OCA_MCP_CARD_TOKEN_PRIVATE_KEY (PKCS#8 PEM).",
    );
    return null;
  }
  try {
    const projectId = env.STYTCH_PROJECT_ID?.trim();
    const secret = env.STYTCH_SECRET?.trim();
    if (!projectId || !secret) {
      throw new Error("missing Stytch credentials");
    }
    return createCardCredentials({
      stytch: new Client({ project_id: projectId, secret }),
      profileId,
      privateKey,
      ...cardTokenClaims(origin),
      apiKey: apiKey(),
    });
  } catch {
    console.error(
      "User sessions for Crossmint disabled: STYTCH_PROJECT_ID, STYTCH_SECRET and the Crossmint client key are required.",
    );
    return null;
  }
}

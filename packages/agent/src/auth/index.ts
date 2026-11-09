import type { SessionAuthContext } from "eve/context";
import { decodeProtectedHeader } from "jose";
import type { Client } from "stytch";
import { z } from "zod";

export interface StytchAuthConfig {
  readonly projectId: string;
  readonly tokenIssuer: string;
  readonly mcpResourceUrl: string;
  readonly requiredMcpScopes: readonly string[];
  readonly maxAccessTokenLifetimeSeconds: number;
}

export class AuthVerificationError extends Error {
  constructor() {
    super("Authentication failed");
    this.name = "AuthVerificationError";
  }
}

export class AuthOwnershipError extends Error {
  constructor() {
    super("Resource access denied");
    this.name = "AuthOwnershipError";
  }
}

const nonemptyString = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const scopeToken = z.string().regex(/^[\x21\x23-\x5b\x5d-\x7e]+$/);
const configSchema = z.object({
  projectId: nonemptyString,
  tokenIssuer: nonemptyString,
  mcpResourceUrl: nonemptyString.pipe(z.url()).refine(isResourceUrl),
  requiredMcpScopes: z.array(scopeToken).min(1),
  maxAccessTokenLifetimeSeconds: z.number().int().positive(),
});
/** HTTPS, or plain HTTP on a loopback host outside production (local MCP clients). */
function isResourceUrl(value: string) {
  const url = new URL(value);
  return (
    url.protocol === "https:" ||
    (process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  );
}
const timestamp = z.number().int().nonnegative();
const mcpClaimsSchema = z.object({
  subject: nonemptyString,
  issuer: nonemptyString,
  audience: z.union([nonemptyString, z.array(nonemptyString).min(1)]),
  scope: z
    .string()
    .regex(/^[\x21\x23-\x5b\x5d-\x7e]+(?: [\x21\x23-\x5b\x5d-\x7e]+)*$/),
  issued_at: timestamp,
  not_before: timestamp,
  expires_at: timestamp,
  custom_claims: z.object({ client_id: nonemptyString }),
});
const webSessionSchema = z.object({
  status_code: z.literal(200),
  session: z.object({ user_id: nonemptyString }),
  user: z.object({ user_id: nonemptyString }),
});

function principal(
  projectId: string,
  subject: string,
  attributes: Record<string, string> = {},
): SessionAuthContext {
  return {
    attributes,
    authenticator: "stytch",
    issuer: `stytch.com/${projectId}`,
    principalId: subject,
    principalType: "user",
    subject,
  };
}

/** Server-only web verification; Connected Apps configuration is independent. */
export function createStytchWebAuthenticator(options: {
  readonly projectId: string;
  readonly client: Pick<Client, "sessions">;
}) {
  const parsedProject = nonemptyString.safeParse(options.projectId);
  if (
    !parsedProject.success ||
    typeof options.client?.sessions?.authenticate !== "function"
  ) {
    throw new Error("Invalid auth configuration");
  }
  const projectId = parsedProject.data;
  const { client } = options;
  return {
    /** Remote validation on every call observes Stytch session revocation. */
    async authenticateWebSession(
      sessionToken: string,
    ): Promise<SessionAuthContext> {
      try {
        const credential = nonemptyString.parse(sessionToken);
        const response = webSessionSchema.parse(
          await client.sessions.authenticate({ session_token: credential }),
        );
        if (response.session.user_id !== response.user.user_id) {
          throw new AuthVerificationError();
        }
        return principal(projectId, response.session.user_id);
      } catch {
        // Never attach the provider error, credentials, or response as a cause.
        throw new AuthVerificationError();
      }
    },
  };
}

/** Server-only: provider clients are constructed by the consuming application. */
export function createStytchAuthenticators(
  options: StytchAuthConfig & {
    readonly client: Pick<Client, "sessions" | "idp">;
  },
) {
  const parsedConfig = configSchema.safeParse(options);
  if (!parsedConfig.success) {
    throw new Error("Invalid auth configuration");
  }
  const config = parsedConfig.data;
  const { client } = options;
  if (
    typeof client?.sessions?.authenticate !== "function" ||
    typeof client?.idp?.introspectTokenLocal !== "function"
  ) {
    throw new Error("Invalid auth configuration");
  }

  return {
    authenticateWebSession: createStytchWebAuthenticator({
      projectId: config.projectId,
      client,
    }).authenticateWebSession,
    /**
     * Local JWT validation cannot observe remote revocation before expiry.
     * Maximum exposure is the configured lifetime, with zero clock tolerance.
     */
    async authenticateMcpToken(
      accessToken: string,
    ): Promise<SessionAuthContext> {
      try {
        const credential = nonemptyString.parse(accessToken);
        if (decodeProtectedHeader(credential).alg !== "RS256") {
          throw new AuthVerificationError();
        }
        const now = new Date();
        const claims = mcpClaimsSchema.parse(
          await client.idp.introspectTokenLocal(credential, {
            clock_tolerance_seconds: 0,
            current_date: now,
          }),
        );
        const audiences =
          typeof claims.audience === "string"
            ? [claims.audience]
            : claims.audience;
        const scopes = new Set(claims.scope.split(" "));
        const nowSeconds = Math.floor(now.getTime() / 1000);
        const failed = [
          claims.issuer !== config.tokenIssuer && "issuer",
          !audiences.includes(config.projectId) && "audience (project)",
          !audiences.includes(config.mcpResourceUrl) && "audience (resource)",
          !config.requiredMcpScopes.every((scope) => scopes.has(scope)) &&
            "scope",
          (claims.issued_at > nowSeconds ||
            claims.not_before > nowSeconds ||
            claims.expires_at <= claims.issued_at ||
            claims.expires_at <= claims.not_before ||
            claims.expires_at <= nowSeconds) &&
            "time",
          claims.expires_at - claims.issued_at >
            config.maxAccessTokenLifetimeSeconds && "lifetime",
        ].filter(Boolean);
        if (failed.length > 0) {
          // Claim values only, never the token: enough to fix configuration.
          console.warn("MCP access token rejected", {
            failed,
            issuer: claims.issuer,
            audience: audiences,
            scope: claims.scope,
            lifetimeSeconds: claims.expires_at - claims.issued_at,
          });
          throw new AuthVerificationError();
        }
        // The SDK sets token_type unconditionally; scope, client and resource
        // claims establish this access-token seam instead of that label.
        // The signed client ID tells which assistant holds the token.
        return principal(config.projectId, claims.subject, {
          clientId: claims.custom_claims.client_id,
        });
      } catch (error) {
        if (!(error instanceof AuthVerificationError)) {
          console.warn("MCP access token could not be verified", {
            reason: error instanceof Error ? error.message : String(error),
          });
        }
        throw new AuthVerificationError();
      }
    },
  };
}

/** Compare only trusted server-derived contexts, after authenticating the caller. */
export function requireSamePrincipal(
  current: SessionAuthContext | null | undefined,
  owner: SessionAuthContext | null | undefined,
): void {
  function isUser(auth: SessionAuthContext | null | undefined) {
    return (
      auth?.authenticator === "stytch" &&
      auth.principalType === "user" &&
      typeof auth.issuer === "string" &&
      auth.issuer.trim().length > 0 &&
      typeof auth.principalId === "string" &&
      auth.principalId.trim().length > 0 &&
      auth.principalId === auth.subject
    );
  }
  if (
    !isUser(current) ||
    !isUser(owner) ||
    current?.issuer !== owner?.issuer ||
    current?.subject !== owner?.subject
  ) {
    throw new AuthOwnershipError();
  }
}

export { readWebSessionToken, webSessionCookieName } from "./web-cookie.js";

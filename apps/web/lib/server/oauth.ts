import type { Client } from "stytch";
import { z } from "zod";
import { type Assistant, describeClient, officialIcon } from "./assistant";

const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !/\p{Cc}/u.test(value));

/**
 * The OAuth authorization request Stytch forwards to our consent page
 * (Connected Apps "Authorization URL"). Stytch validates the client, redirect
 * URI and scopes; this only bounds and shapes what we pass along.
 */
export const authorizationRequest = z.object({
  client_id: text(512),
  redirect_uri: text(2048).pipe(z.url()),
  response_type: z.literal("code"),
  scope: z.string().max(2048).default(""),
  state: text(2048).optional(),
  nonce: text(512).optional(),
  code_challenge: z
    .string()
    .regex(/^[A-Za-z0-9._~-]{43,128}$/)
    .optional(),
  // Stytch's authorize call takes only the challenge; it is always S256.
  code_challenge_method: z.literal("S256").optional(),
  prompt: text(64).optional(),
  resource: z.array(text(2048).pipe(z.url())).max(8).default([]),
});
export type AuthorizationRequest = z.infer<typeof authorizationRequest>;

/** Query parameters to the request shape; `resource` may repeat (RFC 8707). */
export function readAuthorizationRequest(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
) {
  const value: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined) {
      continue;
    }
    const list = typeof raw === "string" ? [raw] : [...raw];
    value[key] = key === "resource" ? list : list[0];
  }
  return authorizationRequest.safeParse(value);
}

/**
 * Fills in what an assistant left out. A request without `scope` or
 * `resource` (OpenAI's dashboard when the plugin names the endpoints) gets what
 * every MCP token needs, since Stytch refuses it otherwise. Every request also
 * asks for a refresh token: an assistant that takes the scopes from discovery
 * (ChatGPT asks for just `commerce:invoke`) otherwise gets none, and OpenAI
 * can't keep a review account connected for its scans.
 */
export function withDefaults(
  request: AuthorizationRequest,
  mcp: { readonly scopes: readonly string[]; readonly resource: string },
): AuthorizationRequest {
  const scopes = request.scope.split(" ").filter(Boolean);
  const asked = scopes.length > 0 ? scopes : [...mcp.scopes];
  return {
    ...request,
    scope: asked.includes("offline_access")
      ? asked.join(" ")
      : [...asked, "offline_access"].join(" "),
    resource: request.resource.length > 0 ? request.resource : [mcp.resource],
  };
}

export interface ConsentScreen {
  readonly kind: "consent";
  readonly client: Assistant & { readonly description: string };
  /** Host of the page the user returns to, so a look-alike client name stands out. */
  readonly returnsTo: string;
  readonly scopes: readonly {
    readonly scope: string;
    readonly description: string;
    readonly grantable: boolean;
  }[];
}
export interface ConsentRedirect {
  readonly kind: "redirect";
  readonly redirectUri: string;
}

export class ConsentError extends Error {
  constructor() {
    super(
      "This connection request isn't valid. Start again from your assistant.",
    );
    this.name = "ConsentError";
  }
}

/**
 * Stytch no longer has the session the cookie names (ended elsewhere, or
 * expired before the cookie's JWT did): the user signs in again, rather than
 * being told the request isn't valid.
 */
export class SessionGone extends Error {
  constructor() {
    super("Sign in again.");
    this.name = "SessionGone";
  }
}

/** What a Stytch failure means for the page: sign in again, or the one fixed message. */
function failure(error: unknown) {
  const type = (error as { error_type?: unknown } | null)?.error_type;
  return type === "session_not_found" ||
    type === "session_expired" ||
    type === "invalid_session_token"
    ? new SessionGone()
    : new ConsentError();
}

function scopesOf(request: AuthorizationRequest) {
  return request.scope.split(" ").filter(Boolean);
}

const navigable = z
  .url()
  .refine(
    (value) =>
      !["javascript:", "data:", "vbscript:", "file:", "blob:"].includes(
        new URL(value).protocol,
      ),
  );

/**
 * Stytch Connected Apps consent for a signed-in web user. The session token
 * identifies the user; ownership never comes from the request.
 */
export function createConsent(client: Pick<Client, "idp" | "connectedApp">) {
  async function submit(
    sessionToken: string,
    request: AuthorizationRequest,
    granted: boolean,
  ): Promise<ConsentRedirect> {
    try {
      const response = await client.idp.oauth.authorize({
        consent_granted: granted,
        scopes: scopesOf(request),
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        response_type: request.response_type,
        session_token: sessionToken,
        ...(request.prompt ? { prompt: request.prompt } : {}),
        ...(request.state ? { state: request.state } : {}),
        ...(request.nonce ? { nonce: request.nonce } : {}),
        ...(request.code_challenge
          ? { code_challenge: request.code_challenge }
          : {}),
        ...(request.resource.length > 0 ? { resources: request.resource } : {}),
      });
      return {
        kind: "redirect",
        redirectUri: navigable.parse(response.redirect_uri),
      };
    } catch (error) {
      // Never surface provider bodies; the page shows one fixed message.
      throw failure(error);
    }
  }
  return {
    /** Validate the request and either show consent or, if already granted, finish it. */
    async start(
      sessionToken: string,
      request: AuthorizationRequest,
    ): Promise<ConsentScreen | ConsentRedirect> {
      let started: Awaited<ReturnType<typeof client.idp.oauth.authorizeStart>>;
      try {
        started = await client.idp.oauth.authorizeStart({
          client_id: request.client_id,
          redirect_uri: request.redirect_uri,
          response_type: request.response_type,
          scopes: scopesOf(request),
          session_token: sessionToken,
          ...(request.prompt ? { prompt: request.prompt } : {}),
        });
      } catch (error) {
        throw failure(error);
      }
      if (!started.consent_required) {
        return submit(sessionToken, request, true);
      }
      // As sign-in names it (Grok Bot by its redirects); else what Stytch returned.
      const known = await describeClient(client, request.client_id);
      const name = known?.name ?? started.client.client_name;
      return {
        kind: "consent",
        client: {
          name,
          description: started.client.client_description,
          logoUrl:
            known?.logoUrl ??
            (started.client.logo_url?.startsWith("https://")
              ? started.client.logo_url
              : null),
          icon: known?.icon ?? officialIcon(name),
        },
        returnsTo:
          new URL(request.redirect_uri).host ||
          new URL(request.redirect_uri).protocol.replace(/:$/, ""),
        scopes: started.scope_results.map((result) => ({
          scope: result.scope,
          description: result.description,
          grantable: result.is_grantable,
        })),
      };
    },
    /** Record the user's decision; Stytch puts the code or `access_denied` on the redirect. */
    decide: submit,
  };
}

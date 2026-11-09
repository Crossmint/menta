import { createHmac } from "node:crypto";
import { Client } from "stytch";
import { z } from "zod";
import { getAgentUse } from "../agent-use.js";
import {
  createStytchAuthenticators,
  createStytchWebAuthenticator,
} from "../auth/index.js";
import { getCheckoutAgents } from "../checkout-agents.js";
import {
  crossmintEnvironment,
  crossmintKey,
  getCheckouts,
  getLimitPayments,
} from "../crossmint.js";
import { requireEnv, webOrigin } from "../env.js";
import { getCheckoutPush } from "../push.js";
import { createNeonClientStore } from "./clients.js";
import {
  createMcpEndpoint,
  MCP_PATH,
  type McpEndpoint,
  type McpOAuth,
} from "./endpoint.js";
import { createNeonEventStore } from "./event-store.js";
import { type CheckoutEvents, createCheckoutEvents } from "./events.js";
import {
  createFeedbackChannel,
  type FeedbackChannel,
  slackWebhook,
} from "./feedback.js";
import {
  createGrokBotUpdates,
  createNeonRoutineStore,
  type GrokBotUpdates,
} from "./grok-bot.js";
import {
  createClientNameResolver,
  createCursorAgentResolver,
  createHostResolver,
} from "./hosts.js";
import { cardCredentialsFromEnv } from "./secure.js";

export { cardTokenClaims } from "./secure.js";

import type { SecureStepOptions } from "./server.js";

/**
 * The key that signs native forms' `requestState`: derived from the Stytch
 * secret (HMAC-SHA256 with a fixed label), so every instance has it and no
 * new secret is needed. No Stytch secret: null, and no forms.
 */
export function formStateKeyFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Uint8Array | null {
  const secret = env.STYTCH_SECRET?.trim();
  if (!secret) {
    return null;
  }
  return new Uint8Array(
    createHmac("sha256", secret)
      // Old product name, kept: a fixed label for the key, not copy.
      .update("open-commerce/mcp-form-state/v1")
      .digest(),
  );
}

/**
 * The in-card secure step, when its Stytch Trusted Auth Token profile and
 * signing key are configured. Missing or invalid: null, and the card links to
 * the secure page instead. Never echoes values.
 */
export function secureStepFromEnv(
  origin: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): SecureStepOptions | null {
  const mint = cardCredentialsFromEnv(
    origin,
    () => crossmintKey("CLIENT"),
    env,
  );
  if (!mint) {
    return null;
  }
  return {
    crossmintOrigin:
      crossmintEnvironment() === "staging"
        ? "https://staging.crossmint.com"
        : "https://www.crossmint.com",
    mint,
    checkouts: getCheckouts,
  };
}

const loopback = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Crossmint's production live views (`browser.embedUrl`), served by Agent
 * Checkouts' public API origin.
 */
const PRODUCTION_LIVE_VIEW_ORIGIN = "https://uc.crossmint.com";

/**
 * Where checkout live views are served, so feedback removes their capability
 * URLs: `CROSSMINT_LIVE_VIEW_ORIGIN` (an https origin, or http on loopback for
 * local fixtures), else Crossmint's production origin. Staging has no known
 * origin unless one is set.
 */
export function liveViewOriginFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const configured = env.CROSSMINT_LIVE_VIEW_ORIGIN?.trim();
  if (!configured) {
    return env.CROSSMINT_ENV === "staging" ? null : PRODUCTION_LIVE_VIEW_ORIGIN;
  }
  try {
    const url = new URL(configured);
    const ok =
      url.origin === configured.replace(/\/+$/, "") &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && loopback.includes(url.hostname)));
    if (ok) {
      return url.origin;
    }
  } catch {
    // Reported below.
  }
  console.error(
    "Live view URLs not redacted from feedback: CROSSMINT_LIVE_VIEW_ORIGIN must be an https origin.",
  );
  return null;
}

/**
 * The team's feedback channel: `OCA_FEEDBACK_SLACK_WEBHOOK_URL`, a Slack
 * Incoming Webhook (bound to one channel, so Menta holds no broader Slack
 * token). Unset or invalid: no `feedback` tool.
 */
export function feedbackFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): FeedbackChannel | null {
  const configured = env.OCA_FEEDBACK_SLACK_WEBHOOK_URL?.trim();
  if (!configured) {
    return null;
  }
  const parsed = z
    .url({ protocol: /^https$/, hostname: /^hooks\.slack\.com$/ })
    .safeParse(configured);
  if (
    !parsed.success ||
    !new URL(parsed.data).pathname.startsWith("/services/")
  ) {
    console.error(
      "Feedback disabled: OCA_FEEDBACK_SLACK_WEBHOOK_URL must be a https://hooks.slack.com/services/… webhook.",
    );
    return null;
  }
  return createFeedbackChannel({
    environment: `${env.VERCEL_ENV ?? "local"} · Crossmint ${env.CROSSMINT_ENV === "staging" ? "staging" : "production"}`,
    post: slackWebhook(new URL(parsed.data)),
  });
}

const oauthConfig = z.object({
  /** Stytch project domain (or custom auth domain): issuer, JWKS and discovery. */
  authorizationServerUrl: z
    .url({ protocol: /^https$/ })
    .transform((value) => value.replace(/\/+$/, ""))
    .refine((value) => {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash;
    }),
  scopes: z
    .string()
    .default("commerce:invoke")
    .transform((value) => value.split(" ").filter(Boolean))
    .pipe(z.array(z.string()).min(1)),
  // Stytch Connected Apps issues 8-hour access tokens and has no setting to shorten them.
  maxLifetime: z.coerce.number().int().positive().default(28800),
});

/**
 * Local development only, and only when every guard holds: `next dev`
 * (NODE_ENV is compiled to "production" in builds), not on Vercel, and a
 * loopback web origin. Lets a local MCP client use a Stytch web session token
 * before Connected Apps tokens are available.
 */
export function devSessionsAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  try {
    return (
      env.NODE_ENV === "development" &&
      !env.VERCEL &&
      loopback.includes(new URL(env.OCA_WEB_ORIGIN ?? "").hostname)
    );
  } catch {
    return false;
  }
}

/**
 * The Stytch project domain assistants are told to use (the RFC 8414 issuer),
 * or null when MCP OAuth is not configured or the value is invalid.
 */
export function mcpAuthorizationServerUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const parsed = oauthConfig.shape.authorizationServerUrl.safeParse(
    env.OCA_MCP_AUTHORIZATION_SERVER_URL?.trim(),
  );
  return parsed.success ? parsed.data : null;
}

/** The scopes every MCP token must carry (`OCA_MCP_SCOPES`), or the default. */
export function mcpScopes(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const parsed = oauthConfig.shape.scopes.safeParse(
    env.OCA_MCP_SCOPES?.trim() || undefined,
  );
  return parsed.success ? parsed.data : ["commerce:invoke"];
}

function oauthFromEnv(origin: string): McpOAuth | null {
  const configured = process.env.OCA_MCP_AUTHORIZATION_SERVER_URL?.trim();
  if (!configured) {
    return null;
  }
  try {
    const settings = oauthConfig.parse({
      authorizationServerUrl: configured,
      scopes: process.env.OCA_MCP_SCOPES?.trim() || undefined,
      maxLifetime:
        process.env.OCA_MCP_MAX_TOKEN_LIFETIME_SECONDS?.trim() || undefined,
    });
    const projectId = requireEnv("STYTCH_PROJECT_ID");
    // Connected Apps tokens carry the project domain as `iss`, and the SDK
    // fetches signing keys from it, so the client points there too.
    const auth = createStytchAuthenticators({
      projectId,
      tokenIssuer: settings.authorizationServerUrl,
      mcpResourceUrl: `${origin}${MCP_PATH}`,
      requiredMcpScopes: settings.scopes,
      maxAccessTokenLifetimeSeconds: settings.maxLifetime,
      client: new Client({
        project_id: projectId,
        secret: requireEnv("STYTCH_SECRET"),
        custom_base_url: settings.authorizationServerUrl,
      }),
    });
    const clients = new Client({
      project_id: projectId,
      secret: requireEnv("STYTCH_SECRET"),
    });
    return {
      authorizationServerUrl: settings.authorizationServerUrl,
      scopes: settings.scopes,
      authenticate: auth.authenticateMcpToken,
      hostOf: createHostResolver(clients),
      isCursorAgent: createCursorAgentResolver(clients),
      nameOf: createClientNameResolver(clients),
    };
  } catch {
    // Misconfigured: say which variables without echoing values, then fail closed.
    console.error(
      "MCP OAuth disabled: check OCA_MCP_AUTHORIZATION_SERVER_URL, OCA_MCP_SCOPES, OCA_MCP_MAX_TOKEN_LIFETIME_SECONDS, STYTCH_PROJECT_ID and STYTCH_SECRET.",
    );
    return null;
  }
}

/**
 * The user's name and verified email from Stytch, for an address the model
 * saves without an email. Null when Stytch isn't configured.
 */
function profileFromEnv() {
  const projectId = process.env.STYTCH_PROJECT_ID?.trim();
  const secret = process.env.STYTCH_SECRET?.trim();
  if (!projectId || !secret) {
    return null;
  }
  const stytch = new Client({ project_id: projectId, secret });
  return async (userId: string) => {
    const user = await stytch.users.get({ user_id: userId });
    if (user.user_id !== userId) {
      return null;
    }
    const name = [user.name?.first_name, user.name?.last_name]
      .filter(Boolean)
      .join(" ");
    return {
      name: name || null,
      email:
        (user.emails.find((item) => item.verified) ?? user.emails[0])?.email ??
        null,
    };
  };
}

let events: CheckoutEvents | null | undefined;
/**
 * MCP Events (checkout notifications to ChatGPT by webhook), when Neon and a
 * server secret to seal signing secrets with are configured. Set
 * OCA_MCP_EVENTS=off to turn them off. Null: no `events` capability.
 */
export function getCheckoutEvents(): CheckoutEvents | null {
  if (events === undefined) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const keyMaterial = process.env.STYTCH_SECRET?.trim();
    events =
      process.env.OCA_MCP_EVENTS?.trim() === "off" ||
      !databaseUrl ||
      !keyMaterial
        ? null
        : createCheckoutEvents({
            store: createNeonEventStore(databaseUrl, keyMaterial),
            origin: webOrigin(),
          });
  }
  return events;
}

/** Where a Grok Bot updates follower hands over when re-arming is on. */
export const GROK_BOT_WATCH_PATH = "/api/grok-bot/watch";

/**
 * Whether followers re-arm themselves past their request
 * (`OCA_GROK_BOT_WATCH=rearm`). Off by default: it keeps a function running
 * for up to 30 minutes per watched checkout (see EDD, Grok Bot updates).
 */
export function grokBotRearmFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return env.OCA_GROK_BOT_WATCH?.trim() === "rearm";
}

/** The key that signs re-arm tokens, derived from the Stytch secret. */
function watchTokenKey(secret: string) {
  return new Uint8Array(
    createHmac("sha256", secret)
      // Old product name, kept: a fixed label for the key, not copy.
      .update("open-commerce/grok-bot-watch/v1")
      .digest(),
  );
}

let grokBot: GrokBotUpdates | null | undefined;
/**
 * Grok Bot updates (pushes to the user's own Grok Bot routine), when Neon and
 * the server secret that seals routine keys are configured. Set
 * OCA_GROK_BOT_UPDATES=off to turn the feature off.
 */
export function getGrokBotUpdates(): GrokBotUpdates | null {
  if (grokBot === undefined) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const secret = process.env.STYTCH_SECRET?.trim();
    if (
      process.env.OCA_GROK_BOT_UPDATES?.trim() === "off" ||
      !databaseUrl ||
      !secret
    ) {
      grokBot = null;
    } else {
      const origin = webOrigin();
      grokBot = createGrokBotUpdates({
        store: createNeonRoutineStore(databaseUrl, secret),
        origin,
        tokenKey: watchTokenKey(secret),
        rearm: grokBotRearmFromEnv()
          ? async (token) => {
              const response = await fetch(`${origin}${GROK_BOT_WATCH_PATH}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token }),
                signal: AbortSignal.timeout(10_000),
              });
              if (response.status !== 202) {
                throw new Error(`Re-arm refused: ${response.status}`);
              }
            }
          : null,
      });
    }
  }
  return grokBot;
}

let endpoint: McpEndpoint | undefined;
/** The MCP endpoint configured from the environment, built on first use. */
export function getMcpEndpoint() {
  if (!endpoint) {
    const origin = webOrigin();
    const databaseUrl = process.env.DATABASE_URL?.trim();
    endpoint = createMcpEndpoint({
      origin,
      oauth: oauthFromEnv(origin),
      ...(devSessionsAllowed()
        ? {
            devSession: createStytchWebAuthenticator({
              projectId: requireEnv("STYTCH_PROJECT_ID"),
              client: new Client({
                project_id: requireEnv("STYTCH_PROJECT_ID"),
                secret: requireEnv("STYTCH_SECRET"),
              }),
            }).authenticateWebSession,
          }
        : {}),
      checkouts: getCheckouts,
      limitPayments: getLimitPayments,
      agents: getCheckoutAgents(),
      agentUse: getAgentUse(),
      secure: secureStepFromEnv(origin),
      profile: profileFromEnv(),
      events: getCheckoutEvents(),
      formStateKey: formStateKeyFromEnv(),
      liveViewOrigin: liveViewOriginFromEnv(),
      // What 2025-era clients declared at initialize (do they draw cards?).
      clients: databaseUrl ? createNeonClientStore(databaseUrl) : null,
      grokBot: getGrokBotUpdates(),
      push: getCheckoutPush(),
      feedback: feedbackFromEnv(),
    });
  }
  return endpoint;
}

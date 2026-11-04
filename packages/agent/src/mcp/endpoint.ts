import {
  createMcpHandler,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import {
  type Checkouts,
  type CheckoutView,
  notStarted,
} from "@oca/crossmint-agent-checkouts/checkouts";
import type { SessionAuthContext } from "eve/context";
import {
  attributedCheckouts,
  type CheckoutAgents,
} from "../checkout-agents.js";
import { crossmintUserId, type LimitPayments } from "../crossmint.js";
import type { PushTarget } from "../push.js";
import {
  type ClientRecord,
  type ClientStore,
  createClientCards,
  declaredCards,
  isGrokBot,
} from "./clients.js";
import { type CheckoutEvents, observeCheckouts } from "./events.js";
import { formStateCodec } from "./forms.js";
import type { GrokBotUpdates } from "./grok-bot.js";
import type { AppHost } from "./hosts.js";
import {
  type CommerceServerOptions,
  createCommerceServer,
  type SecureStepOptions,
  type UserProfile,
} from "./server.js";

/** Path of the MCP endpoint on the web origin. Stable: hosts store this URL. */
export const MCP_PATH = "/mcp";
/** RFC 9728 metadata location derived from the resource path. */
export const MCP_METADATA_PATH = "/.well-known/oauth-protected-resource/mcp";

export interface McpOAuth {
  /** The Stytch project domain that issues tokens (RFC 8414 issuer). */
  readonly authorizationServerUrl: string;
  readonly scopes: readonly string[];
  readonly authenticate: (token: string) => Promise<SessionAuthContext>;
  /** The MCP Apps host a Connected Apps client belongs to, when known. */
  readonly hostOf?: (clientId: string) => Promise<AppHost | null>;
  /** Whether a client signs in through Cursor's hosted agents (Grok Bot). */
  readonly isCursorAgent?: (clientId: string) => Promise<boolean>;
  /** The name a Connected Apps client registered with Stytch. */
  readonly nameOf?: (clientId: string) => Promise<string | null>;
}

export interface McpEndpointOptions {
  /** Exact public origin, e.g. https://oca.example. */
  readonly origin: string;
  /** Stytch Connected Apps; null when not configured, which rejects every OAuth token. */
  readonly oauth: McpOAuth | null;
  /**
   * Local development only: also accept a Stytch web session token as the
   * bearer. The caller decides whether this exists; it is never set in production.
   */
  readonly devSession?: (token: string) => Promise<SessionAuthContext>;
  readonly checkouts: () => Checkouts;
  /** The user's spending limits and paying with the one the assistant picks; null offers no such tools. */
  readonly limitPayments?: (() => LimitPayments | null) | null;
  /** Notes which agent started each checkout, for Transactions; null keeps no note. */
  readonly agents?: CheckoutAgents | null;
  /** Crossmint's secure step inside the card; null keeps it on the secure page. */
  readonly secure?: SecureStepOptions | null;
  /** The user's name and email (Stytch); an address saved without an email gets theirs. */
  readonly profile?: ((userId: string) => Promise<UserProfile | null>) | null;
  /**
   * MCP Events (checkout notifications by webhook); null leaves the server
   * exactly as before: no `events` capability or methods.
   */
  readonly events?: CheckoutEvents | null;
  /**
   * The key that signs native forms' `requestState` (at least 32 bytes, the
   * same on every instance). Null: no native forms for any client.
   */
  readonly formStateKey?: Uint8Array | string | null;
  /** wait_for_checkout's window and read interval; tests shorten them. */
  readonly wait?: CommerceServerOptions["wait"];
  /**
   * Where what 2025-era clients declared at `initialize` (whether they draw
   * cards) is kept for their later requests; null: this instance only.
   */
  readonly clients?: ClientStore | null;
  /**
   * Grok Bot updates (a routine webhook the user set up in Settings); null:
   * Grok Bot only follows checkouts while its turn runs.
   */
  readonly grokBot?: GrokBotUpdates | null;
  /**
   * Phone and browser notifications (`getCheckoutPush`): a checkout an
   * assistant host reads that needs the user is pushed once, opening its
   * secure page, where the user can answer or approve. Null: none.
   */
  readonly push?: CheckoutPush | null;
}

interface CheckoutPush {
  observe(
    userId: string,
    view: CheckoutView,
    target: PushTarget,
  ): Promise<void>;
}

/**
 * Tells the user's devices about a checkout that needs them, from the reads
 * an assistant host makes (start, status, waits, its card). Single reads
 * only: a list of old runs isn't news, and an outcome is already in the host.
 */
function pushingCheckouts(
  checkouts: Checkouts,
  notify: (view: CheckoutView) => void,
): Checkouts {
  const seen = (view: CheckoutView) => {
    if (view.pending) {
      notify(view);
    }
  };
  return {
    ...checkouts,
    async get(...args: Parameters<Checkouts["get"]>) {
      const view = await checkouts.get(...args);
      seen(view);
      return view;
    },
    async create(...args: Parameters<Checkouts["create"]>) {
      const started = await checkouts.create(...args);
      if (!notStarted(started)) {
        seen(started);
      }
      return started;
    },
  };
}

/** Per-request context from the route: how to keep work alive after the response. */
export interface McpRequestContext {
  readonly waitUntil?: (task: Promise<unknown>) => void;
  /**
   * Until when (epoch ms) background work of this request may run: a Grok
   * Bot updates follower stops there. Without it, none starts.
   */
  readonly followUntil?: number;
}

function isActive(view: { status: string }) {
  return (
    view.status === "queued" ||
    view.status === "running" ||
    view.status === "awaiting_input"
  );
}

/** Without a platform hook, background work just runs (and never rejects). */
function background(task: Promise<unknown>) {
  void task.catch(() => {});
}

const noStore = { "Cache-Control": "no-store" };

function bearer(header: string | null) {
  const match = header?.match(/^Bearer +([A-Za-z0-9\-._~+/]+=*) *$/i);
  return match?.[1] ?? null;
}

/**
 * The agent a checkout came from, as Transactions names it: the hosts we know
 * by name, Grok Bot by its Cursor sign-in, else what the client registered.
 */
async function agentName({
  host,
  grokBot,
  clientId,
  nameOf,
}: {
  host: AppHost | null;
  grokBot: boolean;
  clientId: string | null;
  nameOf: ((clientId: string) => Promise<string | null>) | null;
}): Promise<string | null> {
  if (host === "chatgpt") {
    return "ChatGPT";
  }
  if (host === "claude") {
    return "Claude";
  }
  if (grokBot) {
    return "Grok Bot";
  }
  return clientId && nameOf ? nameOf(clientId) : null;
}

/**
 * The Menta MCP server: checkout tools for another assistant, acting
 * as the user its OAuth access token belongs to. Stateless: every request is
 * authenticated and served by a fresh server instance.
 */
export function createMcpEndpoint(options: McpEndpointOptions) {
  const origin = new URL(options.origin).origin;
  const resource = `${origin}${MCP_PATH}`;
  const metadataUrl = `${origin}${MCP_METADATA_PATH}`;
  const allowedOrigin = new URL(origin).hostname;
  const formState = options.formStateKey
    ? formStateCodec(options.formStateKey)
    : null;
  const clientCards = createClientCards(options.clients ?? null);

  const handler = createMcpHandler(({ authInfo, era }) => {
    const userId = authInfo?.extra?.userId;
    if (typeof userId !== "string" || !userId) {
      // Unreachable through `fetch` below; fail closed if it ever is.
      throw new Error("Unauthenticated MCP request");
    }
    const extra = authInfo?.extra;
    const host =
      extra?.host === "claude" ||
      extra?.host === "chatgpt" ||
      extra?.host === "local"
        ? extra.host
        : null;
    const events = options.events ?? null;
    const raw = options.checkouts();
    const waitUntil =
      typeof extra?.waitUntil === "function"
        ? (extra.waitUntil as (task: Promise<unknown>) => void)
        : background;
    const grokBot = extra?.grokBot === true;
    const updates = grokBot ? (options.grokBot ?? null) : null;
    const followUntil =
      typeof extra?.followUntil === "number" ? extra.followUntil : null;
    const clientId =
      typeof extra?.clientId === "string" ? extra.clientId : null;
    const agent = () =>
      agentName({
        host,
        grokBot: grokBot || extra?.cursorAgent === true,
        clientId,
        nameOf: options.oauth?.nameOf ?? null,
      });
    let checkouts = options.agents
      ? attributedCheckouts(raw, agent, options.agents)
      : raw;
    if (updates) {
      // What Grok Bot reads it knows; a follower keeps watching for its routine.
      checkouts = observeCheckouts(checkouts, (view) =>
        waitUntil(
          updates.readByBot(userId, view).then(() =>
            followUntil && isActive(view)
              ? updates.follow(userId, view.runId, raw, {
                  deadline: followUntil,
                })
              : undefined,
          ),
        ),
      );
    }
    const push = options.push ?? null;
    if (push) {
      const via = grokBot ? "grok" : host === "local" ? null : host;
      checkouts = pushingCheckouts(checkouts, (view) =>
        waitUntil(
          push.observe(userId, view, { via }).catch(() => {
            // Notification failures must never reach the host or the model.
            console.warn("Notification delivery unavailable.");
          }),
        ),
      );
    }
    const server = createCommerceServer({
      userId,
      // Every checkout the tools read is also checked for MCP Events.
      checkouts: events
        ? observeCheckouts(checkouts, (view) =>
            waitUntil(events.observe(userId, view)),
          )
        : checkouts,
      origin,
      host,
      cards: extra?.cards === true,
      grokBot: grokBot
        ? {
            updates:
              extra?.grokUpdates === "on" ||
              extra?.grokUpdates === "off" ||
              extra?.grokUpdates === "none"
                ? extra.grokUpdates
                : null,
            offer: updates ? () => updates.offerOnce(userId) : null,
          }
        : null,
      secure: options.secure ?? null,
      limitPayments: options.limitPayments?.() ?? null,
      profile: options.profile ?? null,
      formState,
      wait: options.wait ?? null,
    });
    // MCP Events needs protocol 2026-07-28; 2025-era clients see today's server.
    if (events && era === "modern") {
      events.register(server, { userId, host, checkouts, waitUntil });
    }
    return server;
  });

  function challenge(error?: "invalid_token") {
    const parameters = [
      `resource_metadata="${metadataUrl}"`,
      ...(options.oauth ? [`scope="${options.oauth.scopes.join(" ")}"`] : []),
      ...(error ? [`error="${error}"`] : []),
    ];
    return Response.json(
      {
        error: error ?? "unauthorized",
        error_description: "Sign in to Menta to continue.",
      },
      {
        status: 401,
        headers: {
          ...noStore,
          "WWW-Authenticate": `Bearer ${parameters.join(", ")}`,
        },
      },
    );
  }

  /**
   * The Crossmint user for a bearer token (never from request arguments), and
   * the MCP Apps host when known: from the OAuth client the token was issued
   * to, or `local` for a loopback dev session.
   */
  async function authenticate(token: string): Promise<{
    userId: string;
    host: AppHost | null;
    clientId: string | null;
    cursorAgent: boolean;
  } | null> {
    const oauth = options.oauth;
    if (oauth) {
      try {
        const auth = await oauth.authenticate(token);
        const userId = crossmintUserId(auth);
        if (userId) {
          const claimed = auth.attributes.clientId;
          const clientId =
            typeof claimed === "string" && claimed ? claimed : null;
          const host =
            clientId && oauth.hostOf
              ? await oauth.hostOf(clientId).catch(() => null)
              : null;
          const cursorAgent =
            clientId && !host && oauth.isCursorAgent
              ? await oauth.isCursorAgent(clientId).catch(() => false)
              : false;
          return { userId, host, clientId, cursorAgent };
        }
      } catch {
        // Try the dev verifier; errors never reach the response.
      }
    }
    if (options.devSession) {
      try {
        const userId = crossmintUserId(await options.devSession(token));
        if (userId) {
          return {
            userId,
            host: "local",
            clientId: null,
            cursorAgent: false,
          };
        }
      } catch {
        // Rejected below.
      }
    }
    return null;
  }

  /**
   * Whether this request's client draws our card (see clients.ts): a known
   * host does; otherwise what this request declares (2026-07-28), else what
   * the client declared at its last `initialize` (recorded here), else no.
   * And whether it is Grok Bot: a 2025-era client whose `initialize` said
   * clientInfo Cursor without MCP Apps. 2026-07-28 requests carry no
   * clientInfo, so they never count.
   */
  async function clientOf(
    request: Request,
    caller: {
      host: AppHost | null;
      clientId: string | null;
      cursorAgent: boolean;
    },
  ): Promise<{ cards: boolean; grokBot: boolean }> {
    if (caller.host) {
      return { cards: true, grokBot: false };
    }
    const grok = (record: ClientRecord | null) =>
      isGrokBot(record, { cursorAgent: caller.cursorAgent });
    // Grok Bot declares MCP Apps but draws no card (October 2026): text only.
    const drawn = (cards: boolean, grokBot: boolean) => cards && !grokBot;
    const declared =
      request.method === "POST"
        ? declaredCards(
            await request
              .clone()
              .json()
              .catch(() => null),
          )
        : null;
    if (declared?.initialize) {
      const record = { cards: declared.cards, name: declared.name };
      if (caller.clientId) {
        await clientCards.record(caller.clientId, record);
      }
      const grokBot = grok(record);
      return { cards: drawn(record.cards, grokBot), grokBot };
    }
    if (declared) {
      // 2026-07-28 requests carry no clientInfo: a Cursor-hosted agent is
      // still drawn no card.
      return { cards: declared.cards && !caller.cursorAgent, grokBot: false };
    }
    const recorded = caller.clientId
      ? await clientCards.lookup(caller.clientId)
      : null;
    const grokBot = grok(recorded);
    return { cards: drawn(recorded?.cards ?? false, grokBot), grokBot };
  }

  return {
    resource,
    metadataUrl,

    /** Streamable HTTP (2026-07-28, plus stateless 2025-era) behind Bearer auth. */
    async fetch(
      request: Request,
      context: McpRequestContext = {},
    ): Promise<Response> {
      // DNS-rebinding guard from the spec: browsers may only call from our own origin.
      const rejected = originValidationResponse(request, [allowedOrigin]);
      if (rejected) {
        return rejected;
      }
      const token = bearer(request.headers.get("authorization"));
      if (!token) {
        return challenge();
      }
      const caller = await authenticate(token);
      if (!caller) {
        return challenge("invalid_token");
      }
      const client = await clientOf(request, caller);
      const grokUpdates =
        client.grokBot && options.grokBot
          ? await options.grokBot.state(caller.userId)
          : null;
      return handler.fetch(request, {
        authInfo: {
          token,
          clientId: "oca",
          scopes: [...(options.oauth?.scopes ?? [])],
          resource: new URL(resource),
          extra: {
            userId: caller.userId,
            host: caller.host,
            cards: client.cards,
            grokBot: client.grokBot,
            grokUpdates,
            clientId: caller.clientId,
            cursorAgent: caller.cursorAgent,
            ...(context.waitUntil ? { waitUntil: context.waitUntil } : {}),
            ...(context.followUntil !== undefined
              ? { followUntil: context.followUntil }
              : {}),
          },
        },
      });
    },

    /** RFC 9728 protected-resource metadata, CORS-readable for browser-based clients. */
    metadata(request: Request): Response {
      const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      };
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }
      if (!options.oauth) {
        return Response.json(
          { error: "OAuth is not configured for this server." },
          { status: 404, headers: { ...noStore, ...cors } },
        );
      }
      return Response.json(
        {
          resource,
          authorization_servers: [options.oauth.authorizationServerUrl],
          scopes_supported: [...options.oauth.scopes],
          bearer_methods_supported: ["header"],
          resource_name: "Menta",
          resource_documentation: `${origin}/help`,
        },
        { headers: { ...noStore, ...cors } },
      );
    },
  };
}

export type McpEndpoint = ReturnType<typeof createMcpEndpoint>;

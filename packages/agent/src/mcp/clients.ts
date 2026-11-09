import { CLIENT_CAPABILITIES_META_KEY } from "@modelcontextprotocol/server";
import { neon } from "@neondatabase/serverless";

/**
 * Whether the client behind a request draws our checkout card (MCP Apps).
 * Tool results tell the model to point at a card only where one is drawn:
 * Grok Bot (clientInfo "Cursor", 2025-11-25, elicitation only) once told its
 * user to "pick one on the card below" when nothing was there.
 *
 * Only local dev (the loopback dev session, `local` in hosts.ts) draws
 * cards. Every other client gets links, whatever it declares: ChatGPT,
 * Claude, and clients we can't identify (Cursor's editor, any new assistant).
 *
 * What a 2025-era client declared at `initialize` is still recorded per OAuth
 * client ID (Neon `mcp_clients`, migrations/0005, plus a per-instance cache)
 * and read on its later requests, since we serve each request with a fresh
 * server: its `clientInfo.name` is how Grok Bot is told apart (`isGrokBot`).
 * 2026-07-28 requests carry capabilities in
 * `_meta["io.modelcontextprotocol/clientCapabilities"]` and no clientInfo.
 */

/** The MCP Apps client capability (SEP-1865, ext-apps `EXTENSION_ID`). */
export const MCP_APPS_EXTENSION = "io.modelcontextprotocol/ui";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether client capabilities declare the MCP Apps extension. */
export function declaresCards(capabilities: unknown): boolean {
  return (
    isRecord(capabilities) &&
    isRecord(capabilities.extensions) &&
    isRecord(capabilities.extensions[MCP_APPS_EXTENSION])
  );
}

/** The `clientInfo.name` Grok Bot's hosted MCP client sends (it runs on Cursor's backend). */
export const GROK_BOT_CLIENT_NAME = "Cursor";

/** What we know about an OAuth client from its last `initialize`. */
export interface ClientRecord {
  readonly cards: boolean;
  /** `clientInfo.name`, at most 100 characters; null when not sent. */
  readonly name: string | null;
}

/**
 * Grok Bot (xAI's agent on Cursor's stack): clientInfo `Cursor`, and either
 * no MCP Apps or a sign-in through Cursor's hosted agents (`cursorAgent`,
 * its OAuth redirect on www.cursor.com/agents/). Since October 2026 it
 * declares MCP Apps but never loads our card, so the redirect is what tells
 * it apart. Cursor's IDE names itself differently and signs in through
 * cursor://. Being Grok Bot only changes wording, the secure page's `via`,
 * the Grok Bot updates hint and that no card is assumed, never what a client
 * may do.
 */
export function isGrokBot(
  client: ClientRecord | null,
  { cursorAgent = false }: { cursorAgent?: boolean } = {},
): boolean {
  return (
    client !== null &&
    client.name === GROK_BOT_CLIENT_NAME &&
    (!client.cards || cursorAgent)
  );
}

function clientName(params: Record<string, unknown>): string | null {
  const info = params.clientInfo;
  const name = isRecord(info) ? info.name : null;
  return typeof name === "string" && name.trim()
    ? name.trim().slice(0, 100)
    : null;
}

/** The name and version a 2025-era `initialize` gives the client; null for any other body. */
export function initializeInfo(
  body: unknown,
): { readonly name: string | null; readonly version: string | null } | null {
  for (const message of Array.isArray(body) ? body : [body]) {
    if (
      isRecord(message) &&
      message.method === "initialize" &&
      isRecord(message.params)
    ) {
      const info = message.params.clientInfo;
      const version = isRecord(info) ? info.version : null;
      return {
        name: clientName(message.params),
        version:
          typeof version === "string" && version.trim()
            ? version.trim().slice(0, 40)
            : null,
      };
    }
  }
  return null;
}

/**
 * What a request body says about cards: from a 2026-07-28 request's own
 * capabilities, or a 2025-era `initialize` (to record, with the client's
 * name). Null when it says nothing (2025-era requests after `initialize`,
 * notifications, GET).
 */
export function declaredCards(body: unknown): {
  readonly cards: boolean;
  readonly initialize: boolean;
  readonly name: string | null;
} | null {
  for (const message of Array.isArray(body) ? body : [body]) {
    if (!isRecord(message) || !isRecord(message.params)) {
      continue;
    }
    const meta = message.params._meta;
    if (isRecord(meta) && isRecord(meta[CLIENT_CAPABILITIES_META_KEY])) {
      return {
        cards: declaresCards(meta[CLIENT_CAPABILITIES_META_KEY]),
        initialize: false,
        name: null,
      };
    }
    if (message.method === "initialize") {
      return {
        cards: declaresCards(message.params.capabilities),
        initialize: true,
        name: clientName(message.params),
      };
    }
  }
  return null;
}

/** What each OAuth client declared at its last `initialize`. No secrets: client IDs and names are public. */
export interface ClientStore {
  /** Null when the client was never recorded. */
  client(clientId: string): Promise<ClientRecord | null>;
  setClient(clientId: string, record: ClientRecord): Promise<void>;
}

/** In-process store for tests and local runs without a database. */
export function createMemoryClientStore(): ClientStore & {
  readonly rows: Map<string, ClientRecord>;
} {
  const rows = new Map<string, ClientRecord>();
  return {
    rows,
    async client(clientId) {
      return rows.get(clientId) ?? null;
    },
    async setClient(clientId, record) {
      rows.set(clientId, record);
    },
  };
}

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/** Clients in Postgres (`mcp_clients`, migrations/0005 and 0006). */
export function createSqlClientStore(query: Query): ClientStore {
  return {
    async client(clientId) {
      const [row] = await query(
        "SELECT draws_cards, client_name FROM mcp_clients WHERE client_id = $1",
        [clientId],
      );
      return typeof row?.draws_cards === "boolean"
        ? {
            cards: row.draws_cards,
            name: typeof row.client_name === "string" ? row.client_name : null,
          }
        : null;
    },
    async setClient(clientId, record) {
      await query(
        `INSERT INTO mcp_clients (client_id, draws_cards, client_name) VALUES ($1, $2, $3)
         ON CONFLICT (client_id) DO UPDATE SET
           draws_cards = EXCLUDED.draws_cards,
           client_name = EXCLUDED.client_name,
           updated_at = now()
         WHERE mcp_clients.draws_cards IS DISTINCT FROM EXCLUDED.draws_cards
            OR mcp_clients.client_name IS DISTINCT FROM EXCLUDED.client_name`,
        [clientId, record.cards, record.name],
      );
    },
  };
}

export function createNeonClientStore(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return createSqlClientStore(
    (text, parameters) =>
      sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
  );
}

export interface ClientCardsOptions {
  /** How long this instance trusts what it read or recorded. */
  readonly ttlMs?: number;
  readonly now?: () => number;
}

/** Longest client ID we record (CIMD IDs are URLs). */
const MAX_CLIENT_ID = 2048;

/**
 * Records and reads, per OAuth client, what it declared (whether it draws
 * cards, and its name): the store (null: this instance only) behind a
 * per-instance cache. Never throws; a store failure reads as unknown.
 */
export function createClientCards(
  store: ClientStore | null,
  { ttlMs = 10 * 60_000, now = Date.now }: ClientCardsOptions = {},
) {
  const cache = new Map<string, { record: ClientRecord; at: number }>();
  const remember = (clientId: string, record: ClientRecord) => {
    if (cache.size > 1000) {
      cache.clear();
    }
    cache.set(clientId, { record, at: now() });
  };
  const fresh = (clientId: string) => {
    const hit = cache.get(clientId);
    return hit && now() - hit.at < ttlMs ? hit : null;
  };
  return {
    /** What the client declared at `initialize`. */
    async record(clientId: string, record: ClientRecord): Promise<void> {
      if (!clientId || clientId.length > MAX_CLIENT_ID) {
        return;
      }
      remember(clientId, record);
      // Once per session; another instance may have recorded otherwise since.
      if (!store) {
        return;
      }
      try {
        await store.setClient(clientId, record);
      } catch (error) {
        console.warn("MCP client record failed", {
          reason: error instanceof Error ? error.name : typeof error,
        });
      }
    },
    /** What the client declared; null when it was never recorded. */
    async lookup(clientId: string): Promise<ClientRecord | null> {
      if (!clientId || clientId.length > MAX_CLIENT_ID) {
        return null;
      }
      const hit = fresh(clientId);
      if (hit) {
        return hit.record;
      }
      if (!store) {
        return null;
      }
      try {
        const record = await store.client(clientId);
        // Unknown isn't cached: its `initialize` may land on another instance.
        if (record !== null) {
          remember(clientId, record);
        }
        return record;
      } catch {
        return null;
      }
    },
  };
}

export type ClientCards = ReturnType<typeof createClientCards>;

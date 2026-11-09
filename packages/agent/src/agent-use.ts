import { neon } from "@neondatabase/serverless";

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/** What an agent says about itself at `initialize` (`clientInfo`). */
export interface AgentInfo {
  readonly name: string | null;
  readonly version: string | null;
}

/** When one of the user's connected agents was first and last seen, and what it calls itself. */
export interface AgentUseRecord extends AgentInfo {
  readonly firstUsedAt: string;
  readonly lastUsedAt: string;
}

/**
 * When each connected agent (OAuth client) of a user last used Menta's MCP
 * server, so Agents can tell two connections of the same name apart. Stytch
 * keeps the connection and has no such field.
 */
export interface AgentUse {
  /** A request from this agent; `info` from its `initialize`, when it sent one. */
  touch(
    userId: string,
    clientId: string,
    info: AgentInfo | null,
  ): Promise<void>;
  /** Every agent of this user that has been seen, by client ID. */
  of(userId: string): Promise<Map<string, AgentUseRecord>>;
}

/** How often a busy agent's last use is written. */
const EVERY = "5 minutes";

export function createSqlAgentUse(query: Query): AgentUse {
  return {
    async touch(userId, clientId, info) {
      await query(
        `INSERT INTO agent_use (user_id, client_id, client_name, client_version)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, client_id) DO UPDATE SET
           last_used_at = now(),
           client_name = COALESCE(EXCLUDED.client_name, agent_use.client_name),
           client_version = COALESCE(EXCLUDED.client_version, agent_use.client_version)
         WHERE agent_use.last_used_at < now() - interval '${EVERY}'
            OR EXCLUDED.client_name IS NOT NULL
               AND EXCLUDED.client_name IS DISTINCT FROM agent_use.client_name
            OR EXCLUDED.client_version IS NOT NULL
               AND EXCLUDED.client_version IS DISTINCT FROM agent_use.client_version`,
        [
          userId,
          clientId,
          info?.name?.slice(0, 100) ?? null,
          info?.version?.slice(0, 40) ?? null,
        ],
      );
    },
    async of(userId) {
      const rows = await query(
        `SELECT client_id, client_name, client_version, first_used_at, last_used_at
         FROM agent_use WHERE user_id = $1`,
        [userId],
      );
      return new Map(
        rows.map((row) => [
          String(row.client_id),
          {
            name: typeof row.client_name === "string" ? row.client_name : null,
            version:
              typeof row.client_version === "string"
                ? row.client_version
                : null,
            firstUsedAt: new Date(String(row.first_used_at)).toISOString(),
            lastUsedAt: new Date(String(row.last_used_at)).toISOString(),
          },
        ]),
      );
    },
  };
}

/**
 * Touches at most once per agent every few minutes from this instance (the
 * database skips the rest), except when the agent says who it is. Never
 * throws: a failed note never fails a request.
 */
export function throttledAgentUse(
  use: AgentUse,
  { everyMs = 5 * 60_000, now = Date.now } = {},
): AgentUse["touch"] {
  const seen = new Map<string, number>();
  return async (userId, clientId, info) => {
    const key = `${userId}\n${clientId}`;
    const last = seen.get(key);
    // An initialize with no clientInfo says nothing new: throttled like any request.
    const says = Boolean(info?.name || info?.version);
    if (!says && last !== undefined && now() - last < everyMs) {
      return;
    }
    if (seen.size > 5000) {
      seen.clear();
    }
    seen.set(key, now());
    try {
      await use.touch(userId, clientId, info);
    } catch {
      seen.delete(key);
      console.warn("Couldn't note an agent's last use.");
    }
  };
}

export function createNeonAgentUse(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return createSqlAgentUse(
    (text, parameters) =>
      sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
  );
}

let agentUse: AgentUse | null | undefined;
/** The store, when Neon is configured; built on first use. */
export function getAgentUse(): AgentUse | null {
  if (agentUse === undefined) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    agentUse = databaseUrl ? createNeonAgentUse(databaseUrl) : null;
  }
  return agentUse;
}

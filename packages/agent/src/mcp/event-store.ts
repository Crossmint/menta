import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { neon } from "@neondatabase/serverless";

/** What we last told (or chose not to tell) a subscription about each run. */
export type Seen = Record<string, { readonly k: string; readonly t: number }>;

/**
 * One MCP Events webhook subscription. Times are epoch milliseconds. The
 * signing secrets are the client's `whsec_` values; the SQL store keeps them
 * encrypted and returns null when one can't be read (the next refresh, which
 * carries the secret again, repairs it).
 */
export interface EventSubscription {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  /** Filter: one checkout, or null for all of the user's checkouts. */
  readonly runId: string | null;
  readonly url: string;
  /** The MCP Apps host that subscribed, for the secure page's back link. */
  readonly host: string | null;
  readonly secret: string | null;
  readonly previousSecret: string | null;
  readonly previousUntil: number | null;
  readonly expiresAt: number;
  readonly createdAt: number;
  readonly verifiedAt: number;
  readonly seen: Seen;
  readonly lastDeliveryAt: number | null;
  readonly lastError: string | null;
  readonly failedSince: number | null;
}

export type NewSubscription = Omit<
  EventSubscription,
  "lastDeliveryAt" | "lastError" | "failedSince"
>;

export interface EventStore {
  get(id: string): Promise<EventSubscription | null>;
  /**
   * Inserts, or on refresh updates the secret(s), expiry, verification and
   * host. A refresh keeps `seen` and `createdAt` (deliveries may be updating them).
   */
  save(subscription: NewSubscription): Promise<void>;
  remove(userId: string, id: string): Promise<void>;
  /** Live subscriptions of a user that cover a run (its own, or all checkouts). */
  covering(
    userId: string,
    runId: string,
    now: number,
  ): Promise<EventSubscription[]>;
  /** How many live subscriptions a user has. */
  count(userId: string, now: number): Promise<number>;
  /** When this user's callback URL last passed the challenge, if ever. */
  verifiedAt(userId: string, url: string): Promise<number | null>;
  /** Merges per-run entries into `seen`. */
  markSeen(id: string, patch: Seen): Promise<void>;
  /** Replaces `seen` (pruning). */
  replaceSeen(id: string, seen: Seen): Promise<void>;
  /** Records a delivery outcome: null error means delivered. */
  recordDelivery(id: string, error: string | null, now: number): Promise<void>;
  /** Deletes subscriptions that expired before `before`. */
  purge(before: number): Promise<void>;
}

/** In-process store for tests and local runs without a database. */
export function createMemoryEventStore(): EventStore & {
  readonly rows: Map<string, EventSubscription>;
} {
  const rows = new Map<string, EventSubscription>();
  const update = (id: string, change: Partial<EventSubscription>) => {
    const row = rows.get(id);
    if (row) {
      rows.set(id, { ...row, ...change });
    }
  };
  return {
    rows,
    async get(id) {
      return rows.get(id) ?? null;
    },
    async save(subscription) {
      const existing = rows.get(subscription.id);
      rows.set(
        subscription.id,
        existing
          ? {
              ...existing,
              secret: subscription.secret,
              previousSecret: subscription.previousSecret,
              previousUntil: subscription.previousUntil,
              expiresAt: subscription.expiresAt,
              verifiedAt: subscription.verifiedAt,
              host: subscription.host,
            }
          : {
              ...subscription,
              lastDeliveryAt: null,
              lastError: null,
              failedSince: null,
            },
      );
    },
    async remove(userId, id) {
      if (rows.get(id)?.userId === userId) {
        rows.delete(id);
      }
    },
    async covering(userId, runId, now) {
      return [...rows.values()].filter(
        (row) =>
          row.userId === userId &&
          row.expiresAt > now &&
          (row.runId === null || row.runId === runId),
      );
    },
    async count(userId, now) {
      return [...rows.values()].filter(
        (row) => row.userId === userId && row.expiresAt > now,
      ).length;
    },
    async verifiedAt(userId, url) {
      const times = [...rows.values()]
        .filter((row) => row.userId === userId && row.url === url)
        .map((row) => row.verifiedAt);
      return times.length > 0 ? Math.max(...times) : null;
    },
    async markSeen(id, patch) {
      const row = rows.get(id);
      if (row) {
        update(id, { seen: { ...row.seen, ...patch } });
      }
    },
    async replaceSeen(id, seen) {
      update(id, { seen });
    },
    async recordDelivery(id, error, now) {
      const row = rows.get(id);
      if (row) {
        update(
          id,
          error
            ? { lastError: error, failedSince: row.failedSince ?? now }
            : { lastDeliveryAt: now, lastError: null, failedSince: null },
        );
      }
    },
    async purge(before) {
      for (const [id, row] of rows) {
        if (row.expiresAt < before) {
          rows.delete(id);
        }
      }
    },
  };
}

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * Seals secrets with AES-256-GCM under a key derived (HKDF-SHA256) from a
 * server secret, so a database read alone doesn't reveal them. `purpose`
 * separates keys per use: MCP Events signing secrets by default, Grok Bot
 * routine keys with their own.
 */
export function createSecretBox(
  keyMaterial: string,
  purpose = "mcp-events-signing-secret-v1",
) {
  const key = Buffer.from(
    // The salt keeps the product's old name: changing it would make every
    // stored secret unreadable.
    hkdfSync("sha256", keyMaterial, "open-commerce", purpose, 32),
  );
  return {
    seal(value: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const sealed = Buffer.concat([
        iv,
        cipher.update(value, "utf8"),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
      return `v1.${sealed.toString("base64url")}`;
    },
    open(value: string | null): string | null {
      if (!value?.startsWith("v1.")) {
        return null;
      }
      try {
        const sealed = Buffer.from(value.slice(3), "base64url");
        const decipher = createDecipheriv(
          "aes-256-gcm",
          key,
          sealed.subarray(0, 12),
        );
        decipher.setAuthTag(sealed.subarray(sealed.length - 16));
        return Buffer.concat([
          decipher.update(sealed.subarray(12, sealed.length - 16)),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        return null;
      }
    },
  };
}

const columns = `id, user_id, event_name, run_id, callback_url, host, secret,
  previous_secret, previous_secret_until, expires_at, created_at, verified_at,
  seen, last_delivery_at, last_error, failed_since`;

function time(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed =
    value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function seenOf(value: unknown): Seen {
  const data = typeof value === "string" ? JSON.parse(value) : value;
  const seen: Seen = {};
  if (data && typeof data === "object") {
    for (const [runId, entry] of Object.entries(data)) {
      const k = (entry as { k?: unknown })?.k;
      const t = (entry as { t?: unknown })?.t;
      if (typeof k === "string" && typeof t === "number") {
        seen[runId] = { k, t };
      }
    }
  }
  return seen;
}

/** Subscriptions in Postgres (`mcp_event_subscriptions`, migrations/0004). */
export function createSqlEventStore(
  query: Query,
  box: ReturnType<typeof createSecretBox>,
): EventStore {
  const row = (data: Record<string, unknown>): EventSubscription => ({
    id: String(data.id),
    userId: String(data.user_id),
    name: String(data.event_name),
    runId: data.run_id === null ? null : String(data.run_id),
    url: String(data.callback_url),
    host: data.host === null ? null : String(data.host),
    secret: box.open(data.secret === null ? null : String(data.secret)),
    previousSecret: box.open(
      data.previous_secret === null ? null : String(data.previous_secret),
    ),
    previousUntil: time(data.previous_secret_until),
    expiresAt: time(data.expires_at) ?? 0,
    createdAt: time(data.created_at) ?? 0,
    verifiedAt: time(data.verified_at) ?? 0,
    seen: seenOf(data.seen),
    lastDeliveryAt: time(data.last_delivery_at),
    lastError: data.last_error === null ? null : String(data.last_error),
    failedSince: time(data.failed_since),
  });
  const iso = (value: number | null) =>
    value === null ? null : new Date(value).toISOString();
  return {
    async get(id) {
      const [data] = await query(
        `SELECT ${columns} FROM mcp_event_subscriptions WHERE id = $1`,
        [id],
      );
      return data ? row(data) : null;
    },
    async save(subscription) {
      await query(
        `INSERT INTO mcp_event_subscriptions (id, user_id, event_name, run_id,
           callback_url, host, secret, previous_secret, previous_secret_until,
           expires_at, created_at, verified_at, seen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           secret = EXCLUDED.secret,
           previous_secret = EXCLUDED.previous_secret,
           previous_secret_until = EXCLUDED.previous_secret_until,
           expires_at = EXCLUDED.expires_at,
           verified_at = EXCLUDED.verified_at,
           host = EXCLUDED.host,
           updated_at = now()
         WHERE mcp_event_subscriptions.user_id = EXCLUDED.user_id`,
        [
          subscription.id,
          subscription.userId,
          subscription.name,
          subscription.runId,
          subscription.url,
          subscription.host,
          subscription.secret ? box.seal(subscription.secret) : null,
          subscription.previousSecret
            ? box.seal(subscription.previousSecret)
            : null,
          iso(subscription.previousUntil),
          iso(subscription.expiresAt),
          iso(subscription.createdAt),
          iso(subscription.verifiedAt),
          JSON.stringify(subscription.seen),
        ],
      );
    },
    async remove(userId, id) {
      await query(
        "DELETE FROM mcp_event_subscriptions WHERE id = $1 AND user_id = $2",
        [id, userId],
      );
    },
    async covering(userId, runId, now) {
      const rows = await query(
        `SELECT ${columns} FROM mcp_event_subscriptions
         WHERE user_id = $1 AND expires_at > $2
           AND (run_id IS NULL OR run_id = $3)`,
        [userId, iso(now), runId],
      );
      return rows.map(row);
    },
    async count(userId, now) {
      const [data] = await query(
        "SELECT count(*)::int AS n FROM mcp_event_subscriptions WHERE user_id = $1 AND expires_at > $2",
        [userId, iso(now)],
      );
      return Number(data?.n ?? 0);
    },
    async verifiedAt(userId, url) {
      const [data] = await query(
        "SELECT max(verified_at) AS at FROM mcp_event_subscriptions WHERE user_id = $1 AND callback_url = $2",
        [userId, url],
      );
      return time(data?.at);
    },
    async markSeen(id, patch) {
      await query(
        "UPDATE mcp_event_subscriptions SET seen = seen || $2::jsonb WHERE id = $1",
        [id, JSON.stringify(patch)],
      );
    },
    async replaceSeen(id, seen) {
      await query(
        "UPDATE mcp_event_subscriptions SET seen = $2::jsonb WHERE id = $1",
        [id, JSON.stringify(seen)],
      );
    },
    async recordDelivery(id, error, now) {
      await query(
        error
          ? `UPDATE mcp_event_subscriptions
             SET last_error = $2, failed_since = coalesce(failed_since, $3)
             WHERE id = $1`
          : `UPDATE mcp_event_subscriptions
             SET last_delivery_at = $3, last_error = NULL, failed_since = NULL
             WHERE id = $1 AND $2::text IS NULL`,
        [id, error, iso(now)],
      );
    },
    async purge(before) {
      await query("DELETE FROM mcp_event_subscriptions WHERE expires_at < $1", [
        iso(before),
      ]);
    },
  };
}

export function createNeonEventStore(databaseUrl: string, keyMaterial: string) {
  const sql = neon(databaseUrl);
  return createSqlEventStore(
    (text, parameters) =>
      sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
    createSecretBox(keyMaterial),
  );
}

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type {
  Checkouts,
  CheckoutView,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { createSecretBox } from "./event-store.js";
import { checkoutEvent, checkoutPage, stateKey } from "./events.js";
import {
  callbackProblem,
  type FailureReason,
  postBearer,
  publicTransport,
  statusFailure,
  WebhookError,
  type WebhookTransport,
} from "./webhooks.js";

/**
 * Grok Bot updates: push for Grok Bot through one of the user's own routines.
 *
 * Grok Bot has no MCP Events and no cards, but a routine can start from a
 * webhook (a URL plus a key, sent as `Authorization: Bearer <key>`, with a
 * JSON body the Bot receives along with the routine's instruction), and Grok
 * Bot notifies the user on desktop and phone when a run needs them. The user
 * pastes the routine's webhook URL and key in Settings; we POST a small body
 * when a checkout Grok Bot followed needs them, places the order, or ends.
 *
 * What we keep, per user (Neon `grok_bot_routines`, migrations/0006): the URL,
 * the key sealed like MCP Events secrets, its last four characters, on/off,
 * and per run only the last state we know about (`seen`: key, time, and when
 * Grok Bot itself last read it) plus a short watch lease. Crossmint keeps the
 * checkout.
 *
 * Which checkouts: those Grok Bot reads or starts while updates are on
 * (`readByBot` adopts them). Its own reads never push: it already knows, and
 * while it is following a run (read in the last BOT_ACTIVE_MS) we hold off,
 * because its wait returns within seconds and it tells the user itself.
 *
 * The clock: Crossmint has no webhooks, so changes are found by reading.
 * Every read of an adopted run on our surfaces (Grok Bot's tool calls, the
 * secure page and the web dock) also starts a follower in the background of
 * that request (`follow`, Next's `after()`), which reads the run every few
 * seconds until it settles or the request's time is up. One follower per run
 * at a time (a lease in the row). With re-arming on (OCA_GROK_BOT_WATCH=rearm,
 * off by default because it keeps functions running), a follower that runs
 * out of time hands over to a fresh invocation through a signed request to
 * our own /api/grok-bot/watch, for at most FOLLOW_CAP_MS per checkout.
 */

export const GROK_BOT_VIA = "grok";

/**
 * What the user says to Grok Bot to set updates up: the Bot then calls
 * `grok_bot_updates_setup`, which hands it ROUTINE_INSTRUCTION.
 */
export const UPDATES_PHRASE = "Turn on Menta updates";

/** Name the Bot gives the routine it creates. */
export const ROUTINE_NAME = "Menta updates";

/**
 * The routine's instruction: one source for Settings (Copy, "Set it up by
 * hand") and the `grok_bot_updates_setup` tool, which creates the routine.
 */
export const ROUTINE_INSTRUCTION =
  "When this runs, the body names a Menta checkout (runId) that needs me or has finished. Read it with history for that runId. If the store asked a question, ask me with your question UI, listing its options exactly, and send my answer with answer. For a payment, read it with history and do what its next says: pay from one of my spending limits that fits it, or else send me a link to approve one. For private details, tell me why in one line and send me the body's url: I enter them there myself. If the body's event is checkout.continued, my approval or answer went through: tell me in one line, then follow it with continue until it needs me or finishes. If it finished, tell me the outcome in one line. You can never create, approve or raise a spending limit yourself. If the body's event is test, just tell me Grok Bot updates work.";

/** Grok Bot is following a run when it read it this recently: no push. */
export const BOT_ACTIVE_MS = 30_000;
/** Longest a re-armed follower watches one checkout. */
export const FOLLOW_CAP_MS = 30 * 60_000;
/** How often a follower reads Crossmint (slower after the first minutes). */
const EVERY_MS = 5_000;
const SLOW_AFTER_MS = 5 * 60_000;
/** Retries within one check (then on the next read, once per state). */
const RETRY_DELAYS_MS = [1_000, 3_000];
/** Runs not seen for this long are forgotten. */
const SEEN_FOR_MS = 7 * 24 * 60 * 60_000;
/** Per instance: how long a user's routine row is trusted. */
const CACHE_MS = 15_000;
/** Per instance: Grok Bot's repeated reads of an unchanged run are noted at most this often. */
const NOTE_EVERY_MS = 10_000;
/** How long a re-arm token is good for. */
const TOKEN_MS = 60_000;

/** What we know about one run: state key, when it changed (s), when Grok Bot last read it (s). */
export interface RunSeen {
  readonly k: string;
  readonly t: number;
  readonly g?: number;
}
export type RoutineSeen = Record<string, RunSeen>;
/** One follower at a time per run: its chain and until when (ms). */
export interface Lease {
  readonly c: string;
  readonly u: number;
}

export interface GrokRoutine {
  readonly userId: string;
  readonly url: string;
  /** Null when it can't be opened (the server secret changed): save it again. */
  readonly key: string | null;
  readonly keyHint: string;
  readonly enabled: boolean;
  readonly seen: RoutineSeen;
  readonly watches: Record<string, Lease>;
  readonly lastDeliveryAt: number | null;
  readonly lastError: string | null;
  readonly failedSince: number | null;
  /** When the last delivery (update or test) was tried, whatever came of it. */
  readonly lastAttemptAt: number | null;
}

export interface RoutineStore {
  get(userId: string): Promise<GrokRoutine | null>;
  /** Inserts or replaces the URL and key (turning updates on); keeps `seen`. */
  save(
    userId: string,
    routine: { url: string; key: string; keyHint: string },
  ): Promise<void>;
  /** False when the user has no routine. */
  setEnabled(userId: string, enabled: boolean): Promise<boolean>;
  remove(userId: string): Promise<void>;
  /**
   * Grok Bot read this run: its state is known. Adopts the run; no-op without
   * a routine. Forgets runs whose entry is older than `forgetBefore` (s).
   */
  noteRead(
    userId: string,
    runId: string,
    entry: RunSeen,
    forgetBefore: number,
  ): Promise<void>;
  /**
   * Moves a run's entry from state `from` to `entry`, only if it is still
   * `from` and (with `quietSince`, s) Grok Bot hasn't read it since. True
   * when this caller moved it: it alone sends that change.
   */
  claim(
    userId: string,
    runId: string,
    from: string,
    entry: RunSeen,
    quietSince: number | null,
  ): Promise<boolean>;
  recordDelivery(
    userId: string,
    error: string | null,
    now: number,
  ): Promise<void>;
  /** Takes or renews the run's watch: free, expired (before `now`), or the same chain. */
  lease(
    userId: string,
    runId: string,
    lease: Lease,
    now: number,
  ): Promise<boolean>;
  release(userId: string, runId: string, chain: string): Promise<void>;
  /**
   * Grok Bot offered updates to this user: true only the first time, across
   * instances (`grok_bot_offers`, migrations/0007).
   */
  offer(userId: string): Promise<boolean>;
}

/** In-process store for tests and local runs without a database. */
export function createMemoryRoutineStore(): RoutineStore & {
  readonly rows: Map<string, GrokRoutine>;
} {
  const rows = new Map<string, GrokRoutine>();
  const offered = new Set<string>();
  const update = (userId: string, change: Partial<GrokRoutine>) => {
    const row = rows.get(userId);
    if (row) {
      rows.set(userId, { ...row, ...change });
    }
  };
  return {
    rows,
    async get(userId) {
      return rows.get(userId) ?? null;
    },
    async save(userId, { url, key, keyHint }) {
      const row = rows.get(userId);
      rows.set(userId, {
        userId,
        url,
        key,
        keyHint,
        enabled: true,
        seen: row?.seen ?? {},
        watches: row?.watches ?? {},
        lastDeliveryAt: null,
        lastError: null,
        failedSince: null,
        lastAttemptAt: null,
      });
    },
    async setEnabled(userId, enabled) {
      if (!rows.has(userId)) {
        return false;
      }
      update(userId, { enabled });
      return true;
    },
    async remove(userId) {
      rows.delete(userId);
    },
    async noteRead(userId, runId, entry, forgetBefore) {
      const row = rows.get(userId);
      if (row) {
        const seen = Object.fromEntries(
          Object.entries({ ...row.seen, [runId]: entry }).filter(
            ([, item]) => item.t >= forgetBefore,
          ),
        );
        update(userId, { seen });
      }
    },
    async claim(userId, runId, from, entry, quietSince) {
      const row = rows.get(userId);
      const current = row?.seen[runId];
      if (
        !row ||
        current?.k !== from ||
        (quietSince !== null && (current.g ?? 0) >= quietSince)
      ) {
        return false;
      }
      update(userId, { seen: { ...row.seen, [runId]: entry } });
      return true;
    },
    async recordDelivery(userId, error, now) {
      const row = rows.get(userId);
      if (row) {
        update(
          userId,
          error
            ? {
                lastError: error,
                failedSince: row.failedSince ?? now,
                lastAttemptAt: now,
              }
            : {
                lastDeliveryAt: now,
                lastError: null,
                failedSince: null,
                lastAttemptAt: now,
              },
        );
      }
    },
    async lease(userId, runId, lease, now) {
      const row = rows.get(userId);
      const held = row?.watches[runId];
      if (!row?.enabled || (held && held.u >= now && held.c !== lease.c)) {
        return false;
      }
      const watches = Object.fromEntries(
        Object.entries(row.watches).filter(([, item]) => item.u >= now),
      );
      update(userId, { watches: { ...watches, [runId]: lease } });
      return true;
    },
    async release(userId, runId, chain) {
      const row = rows.get(userId);
      if (row?.watches[runId]?.c === chain) {
        const { [runId]: _, ...watches } = row.watches;
        update(userId, { watches });
      }
    },
    async offer(userId) {
      if (offered.has(userId)) {
        return false;
      }
      offered.add(userId);
      return true;
    },
  };
}

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

function time(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed =
    value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function json(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function seenOf(value: unknown): RoutineSeen {
  const data = json(value);
  const seen: Record<string, RunSeen> = {};
  if (data && typeof data === "object") {
    for (const [runId, entry] of Object.entries(data)) {
      const { k, t, g } = (entry ?? {}) as Record<string, unknown>;
      if (typeof k === "string" && typeof t === "number") {
        seen[runId] = typeof g === "number" ? { k, t, g } : { k, t };
      }
    }
  }
  return seen;
}

function watchesOf(value: unknown): Record<string, Lease> {
  const data = json(value);
  const watches: Record<string, Lease> = {};
  if (data && typeof data === "object") {
    for (const [runId, entry] of Object.entries(data)) {
      const { c, u } = (entry ?? {}) as Record<string, unknown>;
      if (typeof c === "string" && typeof u === "number") {
        watches[runId] = { c, u };
      }
    }
  }
  return watches;
}

const columns = `user_id, webhook_url, key_sealed, key_hint, enabled, seen,
  watches, last_delivery_at, last_error, failed_since, last_attempt_at`;

/** Routines in Postgres (`grok_bot_routines`, migrations/0006). */
export function createSqlRoutineStore(
  query: Query,
  box: ReturnType<typeof createSecretBox>,
): RoutineStore {
  const iso = (value: number) => new Date(value).toISOString();
  return {
    async get(userId) {
      const [data] = await query(
        `SELECT ${columns} FROM grok_bot_routines WHERE user_id = $1`,
        [userId],
      );
      if (!data) {
        return null;
      }
      return {
        userId: String(data.user_id),
        url: String(data.webhook_url),
        key: box.open(String(data.key_sealed)),
        keyHint: String(data.key_hint),
        enabled: data.enabled === true,
        seen: seenOf(data.seen),
        watches: watchesOf(data.watches),
        lastDeliveryAt: time(data.last_delivery_at),
        lastError: data.last_error === null ? null : String(data.last_error),
        failedSince: time(data.failed_since),
        lastAttemptAt: time(data.last_attempt_at),
      };
    },
    async save(userId, { url, key, keyHint }) {
      await query(
        `INSERT INTO grok_bot_routines (user_id, webhook_url, key_sealed, key_hint)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           webhook_url = EXCLUDED.webhook_url,
           key_sealed = EXCLUDED.key_sealed,
           key_hint = EXCLUDED.key_hint,
           enabled = true,
           last_delivery_at = NULL,
           last_error = NULL,
           failed_since = NULL,
           last_attempt_at = NULL,
           updated_at = now()`,
        [userId, url, box.seal(key), keyHint],
      );
    },
    async setEnabled(userId, enabled) {
      const rows = await query(
        `UPDATE grok_bot_routines SET enabled = $2, updated_at = now()
         WHERE user_id = $1 RETURNING user_id`,
        [userId, enabled],
      );
      return rows.length > 0;
    },
    async remove(userId) {
      await query("DELETE FROM grok_bot_routines WHERE user_id = $1", [userId]);
    },
    async noteRead(userId, runId, entry, forgetBefore) {
      await query(
        `UPDATE grok_bot_routines SET seen = (
           SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
           FROM jsonb_each(seen || jsonb_build_object($2::text, $3::jsonb))
           WHERE (value->>'t')::bigint >= $4
         )
         WHERE user_id = $1`,
        [userId, runId, JSON.stringify(entry), forgetBefore],
      );
    },
    async claim(userId, runId, from, entry, quietSince) {
      const rows = await query(
        `UPDATE grok_bot_routines
         SET seen = seen || jsonb_build_object($2::text, $3::jsonb)
         WHERE user_id = $1 AND seen->$2::text->>'k' = $4
           AND ($5::bigint IS NULL OR coalesce((seen->$2::text->>'g')::bigint, 0) < $5::bigint)
         RETURNING user_id`,
        [userId, runId, JSON.stringify(entry), from, quietSince],
      );
      return rows.length > 0;
    },
    async recordDelivery(userId, error, now) {
      await query(
        error
          ? `UPDATE grok_bot_routines
             SET last_error = $2, failed_since = coalesce(failed_since, $3),
               last_attempt_at = $3
             WHERE user_id = $1`
          : `UPDATE grok_bot_routines
             SET last_delivery_at = $3, last_error = NULL, failed_since = NULL,
               last_attempt_at = $3
             WHERE user_id = $1 AND $2::text IS NULL`,
        [userId, error, iso(now)],
      );
    },
    async lease(userId, runId, lease, now) {
      const rows = await query(
        `UPDATE grok_bot_routines SET watches = (
           SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
           FROM jsonb_each(watches)
           WHERE (value->>'u')::bigint >= $4
         ) || jsonb_build_object($2::text, $3::jsonb)
         WHERE user_id = $1 AND enabled
           AND (watches->$2::text IS NULL
             OR (watches->$2::text->>'u')::bigint < $4
             OR watches->$2::text->>'c' = $5)
         RETURNING user_id`,
        [userId, runId, JSON.stringify(lease), now, lease.c],
      );
      return rows.length > 0;
    },
    async release(userId, runId, chain) {
      await query(
        `UPDATE grok_bot_routines SET watches = watches - $2::text
         WHERE user_id = $1 AND watches->$2::text->>'c' = $3`,
        [userId, runId, chain],
      );
    },
    async offer(userId) {
      const rows = await query(
        `INSERT INTO grok_bot_offers (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING RETURNING user_id`,
        [userId],
      );
      return rows.length > 0;
    },
  };
}

/** The key that seals routine keys: its own HKDF purpose under the server secret. */
export function createRoutineKeyBox(keyMaterial: string) {
  return createSecretBox(keyMaterial, "grok-bot-routine-key-v1");
}

export function createNeonRoutineStore(
  databaseUrl: string,
  keyMaterial: string,
) {
  const sql = neon(databaseUrl);
  return createSqlRoutineStore(
    (text, parameters) =>
      sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
    createRoutineKeyBox(keyMaterial),
  );
}

/**
 * The key in what the user pasted from the routine panel: the "Webhook key"
 * itself, or its ready-made "Authorization header" (`Authorization: Bearer
 * …`, or just `Bearer …`), quoted or not.
 */
export function routineKey(pasted: string): string {
  return pasted
    .trim()
    .replace(/^(["'])(.*)\1$/s, "$2")
    .trim()
    .replace(/^authorization\s*:\s*/i, "")
    .replace(/^bearer\s+/i, "")
    .trim();
}

/**
 * Reads what the user pasted: the routine's "Webhook URL" and its key (see
 * `routineKey`). The URL gets the same checks as MCP Events callbacks
 * (https, default port, public host).
 */
export function readRoutineInput(
  url: unknown,
  key: unknown,
):
  | { ok: true; url: string; key: string; keyHint: string }
  | { ok: false; field: "url" | "key"; error: string } {
  const href = typeof url === "string" ? url.trim() : "";
  if (!href) {
    return {
      ok: false,
      field: "url",
      error: "Paste the routine's Webhook URL.",
    };
  }
  const problem = callbackProblem(href);
  if (problem) {
    return {
      ok: false,
      field: "url",
      error: problem.replace("The callback URL", "The URL"),
    };
  }
  const bare = typeof key === "string" ? routineKey(key) : "";
  if (!bare) {
    return { ok: false, field: "key", error: "Paste the routine's key." };
  }
  if (bare.length < 8 || bare.length > 512 || !/^[\x21-\x7e]+$/.test(bare)) {
    return {
      ok: false,
      field: "key",
      error:
        "That doesn't look like a routine key. Copy the Webhook key again.",
    };
  }
  return {
    ok: true,
    url: new URL(href).href,
    key: bare,
    keyHint: bare.slice(-4),
  };
}

/** Updates for a user: on, saved but off (or the key must be pasted again), or never set up. */
export type UpdatesState = "on" | "off" | "none";

export function updatesState(routine: GrokRoutine | null): UpdatesState {
  if (!routine) {
    return "none";
  }
  return routine.enabled && routine.key ? "on" : "off";
}

/**
 * What the account page may show about a routine. Never the key: its last
 * four, the URL's host, and how the last delivery went (when, and the
 * failure reason when it failed).
 */
export function routineStatus(routine: GrokRoutine | null) {
  if (!routine) {
    return { configured: false as const };
  }
  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);
  return {
    configured: true as const,
    enabled: routine.enabled,
    host: new URL(routine.url).hostname,
    keyHint: routine.keyHint,
    keyReadable: routine.key !== null,
    lastDelivery: routine.lastError
      ? {
          at: iso(routine.lastAttemptAt ?? routine.failedSince),
          ok: false as const,
          error: routine.lastError,
        }
      : routine.lastDeliveryAt
        ? { at: iso(routine.lastDeliveryAt), ok: true as const, error: null }
        : null,
  };
}

/**
 * What `grok_bot_updates_setup` tells Grok Bot: whether updates are on, the
 * routine to create (its exact instruction), and where the user pastes the
 * webhook URL and key. Grok Bot can't see those; the user copies them from
 * the routine's panel to Settings, never into chat. No secrets here.
 */
export function grokBotSetup(origin: string, state: UpdatesState) {
  const accountUrl = `${origin}/settings#grok-bot`;
  const routine = { name: ROUTINE_NAME, instruction: ROUTINE_INSTRUCTION };
  if (state === "on") {
    return {
      updates: state,
      accountUrl,
      routine,
      next: `Menta updates are already on for this user: when a checkout you followed needs them or finishes after you stop, their routine starts. Tell them so in one line; don't create another routine. To test them or turn them off, they use ${accountUrl}.`,
    };
  }
  if (state === "off") {
    return {
      updates: state,
      accountUrl,
      routine,
      next: `Menta updates are saved but not working: turned off, or the key has to be pasted again. Give the user ${accountUrl} to turn them on (or paste the routine's Webhook URL and Webhook key again and press Save). Only if they say the routine is gone, set up a new one as described in routine: named routine.name, its instruction exactly routine.instruction, with a webhook trigger.`,
    };
  }
  return {
    updates: state,
    accountUrl,
    routine,
    next: `Set up Menta updates now. 1. Create a routine named "${ROUTINE_NAME}" whose instruction is routine.instruction, exactly as given. 2. Add a webhook trigger to it. You can't see its webhook URL or key; never ask for them in chat. 3. Then tell the user in one short message: open the "${ROUTINE_NAME}" routine's panel in Grok Bot, copy its Webhook URL and Webhook key (or the Authorization header), paste them at ${accountUrl} (signed in to Menta) and press Save. Saving sends a test that starts the routine once, and you then tell them updates work. If you can't create routines here, give them ${accountUrl}: it has the instruction and the same steps.`,
  };
}

/**
 * The body a routine run receives: the MCP Events data for this state (the
 * dock's status copy, the store's question and options, the amount, and the
 * signed-in secure page with `via=grok`). Never the live view, an order
 * intent or progress. Null for states nobody needs to hear about.
 */
export function routineUpdate(view: CheckoutView, origin: string) {
  const event = checkoutEvent(view, origin, GROK_BOT_VIA);
  if (!event) {
    return null;
  }
  return { source: "oca", event: event.name, ...event.data };
}

/**
 * A run that was waiting on the user is working again: their approval or
 * answer went through. Grok Bot picks the checkout back up and follows it,
 * as the web dock would show "Working" right away.
 */
export function continuedUpdate(view: CheckoutView, origin: string) {
  return {
    source: "oca",
    event: "checkout.continued",
    runId: view.runId,
    store: view.store,
    status: "Working",
    headline: `${view.store} · Working`,
    detail:
      "Your approval or answer reached the store and the checkout is continuing. Follow it with continue until it needs you or finishes.",
    url: checkoutPage(origin, view.runId, GROK_BOT_VIA),
  };
}

/** A short, stable, non-reversible tag for a user in logs. */
export function userTag(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 6);
}

export const testUpdate = {
  source: "oca",
  event: "test",
  status: "Test",
  headline: "Menta · Test",
  detail:
    "Grok Bot updates are on. This is a test: there is no checkout to act on.",
} as const;

function retryable(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isActive(view: CheckoutView) {
  return (
    view.status === "queued" ||
    view.status === "running" ||
    view.status === "awaiting_input"
  );
}

/** Signs and checks re-arm tokens: {user, run, chain, since, expiry}, HMAC-SHA256. */
export function watchTokens(key: Uint8Array | string) {
  const mac = (payload: string) =>
    createHmac("sha256", key).update(payload).digest("base64url");
  return {
    seal(token: WatchToken) {
      const payload = Buffer.from(JSON.stringify(token)).toString("base64url");
      return `${payload}.${mac(payload)}`;
    },
    open(value: string, now: number): WatchToken | null {
      const [payload, signature] = value.split(".");
      if (!payload || !signature || value.length > 2000) {
        return null;
      }
      const expected = Buffer.from(mac(payload));
      const actual = Buffer.from(signature);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        return null;
      }
      try {
        const token = JSON.parse(
          Buffer.from(payload, "base64url").toString("utf8"),
        ) as Partial<WatchToken>;
        if (
          typeof token.u !== "string" ||
          typeof token.r !== "string" ||
          typeof token.c !== "string" ||
          typeof token.s !== "number" ||
          typeof token.e !== "number" ||
          token.e < now
        ) {
          return null;
        }
        return token as WatchToken;
      } catch {
        return null;
      }
    },
  };
}

export interface WatchToken {
  /** The Stytch user, from the session or token that started the watch. */
  readonly u: string;
  readonly r: string;
  readonly c: string;
  /** When the chain started (ms). */
  readonly s: number;
  readonly e: number;
}

export interface GrokBotUpdatesOptions {
  readonly store: RoutineStore;
  readonly origin: string;
  readonly transport?: WebhookTransport;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  /**
   * Hands a follower that ran out of time to a fresh invocation (POSTs the
   * signed token to /api/grok-bot/watch). Null: followers end with their
   * request.
   */
  readonly rearm?: ((token: string) => Promise<void>) | null;
  /** Signs re-arm tokens; required for `rearm`. */
  readonly tokenKey?: Uint8Array | string | null;
  readonly everyMs?: number;
}

export type ObserveOutcome =
  | "ignored"
  | "current"
  | "deferred"
  | "sent"
  | "pending";

const sec = (ms: number) => Math.floor(ms / 1000);

export function createGrokBotUpdates({
  store,
  origin,
  transport = publicTransport,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  rearm = null,
  tokenKey = null,
  everyMs = EVERY_MS,
}: GrokBotUpdatesOptions) {
  const cache = new Map<string, { routine: GrokRoutine | null; at: number }>();
  const notes = new Map<string, { k: string; at: number }>();
  const following = new Set<string>();
  const tokens = tokenKey ? watchTokens(tokenKey) : null;

  function remember(userId: string, routine: GrokRoutine | null) {
    if (cache.size > 2000) {
      cache.clear();
    }
    cache.set(userId, { routine, at: now() });
  }

  function forget(userId: string) {
    cache.delete(userId);
  }

  /** The user's routine, from this instance's cache when fresh. Never throws. */
  async function routineOf(userId: string): Promise<GrokRoutine | null> {
    const hit = cache.get(userId);
    if (hit && now() - hit.at < CACHE_MS) {
      return hit.routine;
    }
    try {
      const routine = await store.get(userId);
      remember(userId, routine);
      return routine;
    } catch (error) {
      console.warn("Grok Bot routine read failed", {
        error: error instanceof Error ? error.name : typeof error,
      });
      return null;
    }
  }

  function withSeen(userId: string, runId: string, entry: RunSeen) {
    const hit = cache.get(userId);
    if (hit?.routine) {
      cache.set(userId, {
        routine: {
          ...hit.routine,
          seen: { ...hit.routine.seen, [runId]: entry },
        },
        at: hit.at,
      });
    }
  }

  /** Whether updates are on for the user (Grok Bot's hints and setup tool). */
  async function state(userId: string): Promise<UpdatesState> {
    return updatesState(await routineOf(userId));
  }

  /**
   * True only the first time Grok Bot may offer this user updates (once per
   * user, across instances). Never throws: a failure reads as offered.
   */
  async function offerOnce(userId: string): Promise<boolean> {
    try {
      return await store.offer(userId);
    } catch (error) {
      console.warn("Grok Bot updates offer note failed", {
        error: error instanceof Error ? error.name : typeof error,
      });
      return false;
    }
  }

  /** Delivers one body: "retry" leaves the state to be sent again. */
  async function deliver(
    routine: GrokRoutine,
    body: Record<string, unknown>,
  ): Promise<"delivered" | "dropped" | "retry"> {
    if (!routine.key) {
      return "dropped";
    }
    const text = JSON.stringify(body);
    let failure: FailureReason = "connection_refused";
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 0);
      }
      try {
        const response = await postBearer({
          url: routine.url,
          key: routine.key,
          body: text,
          transport,
        });
        if (response.status >= 200 && response.status < 300) {
          await store.recordDelivery(routine.userId, null, now());
          console.info("Grok Bot update delivered", {
            user: userTag(routine.userId),
            run: String(body.runId ?? "").slice(-6),
            event: body.event,
            attempt: attempt + 1,
          });
          return "delivered";
        }
        failure = statusFailure(response.status);
        if (!retryable(response.status)) {
          // A wrong key or a deleted routine won't fix itself: the account page says so.
          await store.recordDelivery(routine.userId, failure, now());
          console.warn("Grok Bot update refused", {
            event: body.event,
            status: response.status,
          });
          return "dropped";
        }
      } catch (error) {
        failure =
          error instanceof WebhookError ? error.reason : "connection_refused";
      }
    }
    await store.recordDelivery(routine.userId, failure, now());
    console.warn("Grok Bot update failed", {
      event: body.event,
      reason: failure,
    });
    return "retry";
  }

  /**
   * Grok Bot read this checkout through a tool: it knows this state. Adopts
   * the run when updates are on. Never throws.
   */
  async function readByBot(userId: string, view: CheckoutView) {
    try {
      const routine = await routineOf(userId);
      if (!routine?.enabled) {
        return;
      }
      const memo = `${userId}\n${view.runId}`;
      const key = stateKey(view);
      const last = notes.get(memo);
      if (last?.k === key && now() - last.at < NOTE_EVERY_MS) {
        return;
      }
      if (notes.size > 5000) {
        notes.clear();
      }
      notes.set(memo, { k: key, at: now() });
      const entry = { k: key, t: sec(now()), g: sec(now()) };
      await store.noteRead(userId, view.runId, entry, sec(now() - SEEN_FOR_MS));
      withSeen(userId, view.runId, entry);
    } catch (error) {
      console.warn("Grok Bot read note failed", {
        error: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  /**
   * Any other read of a checkout (the secure page, the dock, a follower):
   * tells the user's routine when an adopted run moved into a state they
   * need to hear about. Once per state, across instances. Never throws.
   */
  async function observe(
    userId: string,
    view: CheckoutView,
  ): Promise<ObserveOutcome> {
    try {
      const routine = await routineOf(userId);
      const previous = routine?.seen[view.runId];
      if (!routine?.enabled || !routine.key || !previous) {
        return "ignored";
      }
      const key = stateKey(view);
      if (previous.k === key) {
        return "current";
      }
      const quietSince = sec(now() - BOT_ACTIVE_MS);
      if ((previous.g ?? 0) >= quietSince) {
        return "deferred";
      }
      const entry: RunSeen = {
        k: key,
        t: sec(now()),
        ...(previous.g ? { g: previous.g } : {}),
      };
      if (
        !(await store.claim(userId, view.runId, previous.k, entry, quietSince))
      ) {
        // Another instance sent it, or Grok Bot read it meanwhile: read again next time.
        forget(userId);
        return "deferred";
      }
      withSeen(userId, view.runId, entry);
      const resumed =
        previous.k.startsWith("awaiting_input:") &&
        (view.status === "running" || view.status === "queued");
      const body = resumed
        ? continuedUpdate(view, origin)
        : routineUpdate(view, origin);
      if (!body) {
        return "current";
      }
      const outcome = await deliver(routine, body);
      if (outcome === "retry") {
        await store.claim(userId, view.runId, key, previous, null);
        withSeen(userId, view.runId, previous);
        return "pending";
      }
      return "sent";
    } catch (error) {
      console.warn("Grok Bot update check failed", {
        error: error instanceof Error ? error.name : typeof error,
      });
      return "pending";
    }
  }

  /**
   * Follows an adopted run in the background until it settles (and its
   * update went out), updates are turned off, or `deadline` (ms) is near;
   * then re-arms when that is on. One follower per run (lease).
   */
  async function follow(
    userId: string,
    runId: string,
    checkouts: Checkouts,
    {
      deadline,
      chain,
      since,
    }: { deadline: number; chain?: string; since?: number },
  ): Promise<void> {
    const memo = `${userId}\n${runId}`;
    if (following.has(memo)) {
      return;
    }
    const routine = await routineOf(userId);
    if (!routine?.enabled || !routine.seen[runId]) {
      return;
    }
    const c = chain ?? randomBytes(9).toString("base64url");
    const started = since ?? now();
    try {
      if (
        !(await store.lease(userId, runId, { c, u: deadline + 15_000 }, now()))
      ) {
        return;
      }
    } catch {
      return;
    }
    following.add(memo);
    let done = false;
    let lastStatus = "";
    // What the follower decides, for debugging deliveries (no user data).
    const trace = (what: string, extra: Record<string, unknown> = {}) =>
      console.info("Grok Bot follower", {
        user: userTag(userId),
        run: runId.slice(-6),
        chain: c.slice(0, 4),
        what,
        ...extra,
      });
    trace("start", { resumed: Boolean(chain) });
    try {
      while (now() < deadline) {
        const view = await checkouts.get(userId, runId).catch(() => null);
        if (view) {
          const outcome = await observe(userId, view);
          if (view.status !== lastStatus || outcome !== "current") {
            trace("read", { status: view.status, outcome });
            lastStatus = view.status;
          }
          if (
            outcome === "ignored" ||
            (!isActive(view) && (outcome === "current" || outcome === "sent"))
          ) {
            done = true;
            trace("done", { status: view.status, outcome });
            break;
          }
        }
        const wait = now() - started < SLOW_AFTER_MS ? everyMs : everyMs * 3;
        if (now() + wait >= deadline) {
          break;
        }
        await sleep(wait);
      }
    } finally {
      following.delete(memo);
    }
    if (!done && rearm && tokens && now() - started < FOLLOW_CAP_MS) {
      trace("hand over");
      try {
        await rearm(
          tokens.seal({
            u: userId,
            r: runId,
            c,
            s: started,
            e: now() + TOKEN_MS,
          }),
        );
        return;
      } catch (error) {
        console.warn("Grok Bot follower re-arm failed", {
          error: error instanceof Error ? error.name : typeof error,
        });
      }
    }
    if (!done) {
      trace("stop", {
        rearm: Boolean(rearm && tokens),
        capped: now() - started >= FOLLOW_CAP_MS,
      });
    }
    await store.release(userId, runId, c).catch(() => {});
  }

  /** Continues a re-armed follower; false for a bad or expired token. */
  function resume(
    token: string,
    checkouts: Checkouts,
    deadline: number,
  ): Promise<void> | null {
    const opened = tokens?.open(token, now());
    if (!opened) {
      return null;
    }
    return follow(opened.u, opened.r, checkouts, {
      deadline,
      chain: opened.c,
      since: opened.s,
    });
  }

  /** "Send a test" on the account page. */
  async function sendTest(
    userId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    forget(userId);
    const routine = await routineOf(userId);
    if (!routine) {
      return { ok: false, reason: "not_configured" };
    }
    if (!routine.key) {
      return { ok: false, reason: "key_unreadable" };
    }
    const outcome = await deliver(routine, { ...testUpdate });
    forget(userId);
    if (outcome === "delivered") {
      return { ok: true };
    }
    return {
      ok: false,
      reason: (await routineOf(userId))?.lastError ?? "failed",
    };
  }

  return {
    /** Setup in Settings (save, on/off, remove); call `forget` after. */
    store,
    routineOf,
    state,
    offerOnce,
    readByBot,
    observe,
    follow,
    resume,
    sendTest,
    forget,
  };
}

export type GrokBotUpdates = ReturnType<typeof createGrokBotUpdates>;

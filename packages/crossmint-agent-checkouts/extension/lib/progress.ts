/**
 * Checkout progress from Crossmint's run messages: what the browser agent is
 * doing right now and its last few steps. For the owner's UI only; it never
 * enters model context.
 *
 * Crossmint publishes each browser tool call as an assistant message with a
 * buyer-facing `text` part (already privacy-filtered, at most 240 chars) and
 * an `activity` part (status plus operation kinds). A message is upserted:
 * the same ID comes back with a higher `revision` when the call ends.
 * Checkpoints are assistant messages with only a `progress` part. Everything
 * else (user messages, input requests and responses, results) is ignored.
 */
import { z } from "zod";

export type StepStatus = "running" | "completed" | "incomplete" | "uncertain";

/** One thing the checkout's browser agent did, in Crossmint's buyer-safe words. */
export interface ProgressStep {
  readonly text: string;
  readonly status: StepStatus;
  /** When the step started (ISO). */
  readonly at: string;
}

export interface CheckoutProgress {
  /** The newest step (or checkpoint), or null before the first one. */
  readonly now: ProgressStep | null;
  /** The last few steps, newest first. */
  readonly recent: readonly ProgressStep[];
}

const MAX_TEXT = 240;
const RECENT = 5;
/** Entries kept per run: more than RECENT, so a late revision still finds its step. */
const KEEP = 16;

const message = z.object({
  id: z.string().min(1),
  revision: z.number(),
  role: z.string(),
  createdAt: z.unknown(),
  parts: z.array(z.unknown()),
});
const textPart = z.object({ type: z.literal("text"), text: z.string() });
const activityPart = z.object({
  type: z.literal("activity"),
  status: z.enum(["running", "completed", "incomplete", "uncertain"]),
});
const checkpointPart = z.object({
  type: z.literal("progress"),
  text: z.string(),
});

/** One page of `GET /runs/:id/messages`: oldest first, read forward from a cursor. */
export const messagesPage = z.object({
  data: z.array(z.unknown()),
  /** Present while more messages follow this page. */
  nextCursor: z.string().min(1).nullable().catch(null),
  /** Where this page ends: resume reading (or the run's stream) from here. */
  streamCursor: z.string().min(1).optional().catch(undefined),
});

interface Entry {
  readonly id: string;
  readonly revision: number;
  readonly text: string;
  /** Null for a checkpoint. */
  readonly status: StepStatus | null;
  readonly at: string;
  readonly time: number;
  /** Arrival order, to keep messages with the same timestamp in order. */
  readonly seq: number;
}

/** What has been read of a run's messages so far, display-safe fields only. */
export interface ProgressLog {
  /** Steps and checkpoints, oldest first. */
  readonly entries: readonly Entry[];
  readonly seq: number;
}

export const emptyLog: ProgressLog = { entries: [], seq: 0 };

/** Crossmint's buyer-safe line, on one line and never over 240 chars. */
export function stepText(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_TEXT
    ? `${flat.slice(0, MAX_TEXT - 1).trimEnd()}…`
    : flat;
}

function first<T>(parts: readonly unknown[], schema: z.ZodType<T>) {
  for (const part of parts) {
    const parsed = schema.safeParse(part);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return null;
}

/**
 * Adds a page of raw messages to the log. Unknown shapes and part types are
 * skipped, never errors; a message replaces the one with its ID only at a
 * higher revision.
 */
export function foldMessages(
  log: ProgressLog,
  messages: readonly unknown[],
): ProgressLog {
  const entries = [...log.entries];
  let { seq } = log;
  for (const raw of messages) {
    const parsed = message.safeParse(raw);
    if (!parsed.success || parsed.data.role !== "assistant") {
      continue;
    }
    const { id, revision, createdAt, parts } = parsed.data;
    const time =
      typeof createdAt === "string" ? Date.parse(createdAt) : Number.NaN;
    if (Number.isNaN(time)) {
      continue;
    }
    const activity = first(parts, activityPart);
    const said = first(parts, textPart);
    const checkpoint = activity ? null : first(parts, checkpointPart);
    const text = stepText(
      activity ? (said?.text ?? "") : (checkpoint?.text ?? ""),
    );
    if (!text) {
      continue;
    }
    const index = entries.findIndex((entry) => entry.id === id);
    const known = entries[index];
    if (known && known.revision >= revision) {
      continue;
    }
    const oldest = entries[0];
    if (!known && entries.length >= KEEP && oldest && time < oldest.time) {
      continue;
    }
    const entry: Entry = {
      id,
      revision,
      text,
      status: activity?.status ?? null,
      at: new Date(time).toISOString(),
      time,
      seq: known?.seq ?? seq++,
    };
    if (known) {
      entries[index] = entry;
    } else {
      entries.push(entry);
    }
  }
  entries.sort((a, b) => a.time - b.time || a.seq - b.seq);
  return { entries: entries.slice(-KEEP), seq };
}

const step = (entry: Entry): ProgressStep => ({
  text: entry.text,
  status: entry.status ?? "completed",
  at: entry.at,
});

/** The progress a view shows: the newest step and the last few. */
export function progressOf(log: ProgressLog): CheckoutProgress {
  const steps = log.entries.filter((entry) => entry.status !== null);
  const newest = log.entries.at(-1);
  return {
    now: newest ? step(newest) : null,
    recent: steps.slice(-RECENT).reverse().map(step),
  };
}

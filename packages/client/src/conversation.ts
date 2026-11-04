import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";
import type { EveMessage, EveMessagePart } from "eve/react";
import { withoutFileLines } from "./photos";

/**
 * The conversation logic both chat screens share (web and mobile): what a
 * tool part says about a checkout, which messages to show, and the new-chat
 * examples.
 */

export type ToolPart = Extract<EveMessagePart, { type: "dynamic-tool" }>;

export const activity: Record<string, string> = {
  checkouts__create: "Starting the checkout…",
  checkouts__get: "Checking the checkout…",
  checkouts__list: "Looking up your checkouts…",
  checkouts__answer: "Answering the store…",
  checkouts__cancel: "Asking the store to stop…",
  checkouts__addresses: "Checking your addresses…",
  checkouts__save_address: "Saving the address…",
  checkouts__delete_address: "Deleting the address…",
  checkouts__set_default_address: "Setting the default address…",
};

/** Tools that wait on a checkout in the background; the dock shows the progress. */
export const following = new Set(["watch_checkout", "task_wait"]);

/**
 * The checkout a tool part is about, with the view it returned. A watch's
 * output is a task receipt until the task settles, then the view it ended on.
 */
export function runOf(
  part: ToolPart,
): { runId: string; view: CheckoutView | null } | null {
  const output =
    part.state === "output-available" && !part.partial
      ? (part.output as Partial<CheckoutView> | string | undefined)
      : undefined;
  const view =
    typeof output === "object" && typeof output?.runId === "string"
      ? (output as CheckoutView)
      : null;
  if (
    view &&
    (part.toolName === "checkouts__create" ||
      part.toolName === "checkouts__get" ||
      part.toolName === "watch_checkout")
  ) {
    return { runId: view.runId, view };
  }
  const input = part.input as { runId?: unknown } | undefined;
  if (part.toolName === "watch_checkout" && typeof input?.runId === "string") {
    return { runId: input.runId, view: null };
  }
  return null;
}

/** Whether a checkout can still change: unknown, queued, running or waiting on the user. */
function stillGoing(view: CheckoutView | null | undefined) {
  return (
    !view ||
    view.status === "queued" ||
    view.status === "running" ||
    view.status === "awaiting_input"
  );
}

/**
 * Every checkout the conversation mentions: where it first appears (a
 * one-line row; `rendered[message][part]`), the message that last mentions
 * it, the tool result where the agent saw it end, and its latest snapshot.
 */
export function checkoutMentions(messages: readonly EveMessage[]) {
  const seen = new Set<string>();
  const lastSeen = new Map<string, number>();
  const sawEnd = new Map<string, { message: number; part: number }>();
  const latest = new Map<
    string,
    { runId: string; initial: CheckoutView | null }
  >();
  const rendered = messages.map((message, index) =>
    message.parts.map((part, partIndex) => {
      if (part.type !== "dynamic-tool") {
        return null;
      }
      const run = runOf(part);
      if (!run) {
        return null;
      }
      lastSeen.set(run.runId, index);
      if (run.view && !stillGoing(run.view)) {
        sawEnd.set(run.runId, { message: index, part: partIndex });
      }
      latest.set(run.runId, {
        runId: run.runId,
        initial: run.view ?? latest.get(run.runId)?.initial ?? null,
      });
      if (seen.has(run.runId)) {
        return null;
      }
      seen.add(run.runId);
      return run;
    }),
  );
  return { rendered, lastSeen, sawEnd, refs: [...latest.values()] };
}

/**
 * Where each settled run's outcome card goes: with the tool result where the
 * agent saw it end (its closing words follow), or else at the end of the
 * message where it ended (`part: null`). `endedAt`: the last message on
 * screen when a run settled while the conversation was open.
 */
export function placeOutcomes(
  mentions: Pick<ReturnType<typeof checkoutMentions>, "lastSeen" | "sawEnd">,
  views: ReadonlyMap<string, CheckoutView>,
  endedAt: Readonly<Record<string, number>>,
) {
  const placed = new Map<string, { message: number; part: number | null }>();
  for (const [runId, last] of mentions.lastSeen) {
    const view = views.get(runId);
    if (!view || stillGoing(view)) {
      continue;
    }
    placed.set(
      runId,
      mentions.sawEnd.get(runId) ?? {
        message: Math.max(last, endedAt[runId] ?? -1),
        part: null,
      },
    );
  }
  return placed;
}

/** Runs the agent was asked to cancel in this conversation, plus `extra`. */
export function canceledRuns(
  messages: readonly EveMessage[],
  extra: Iterable<string> = [],
) {
  const runs = new Set(extra);
  for (const message of messages) {
    for (const part of message.parts) {
      const input = part.type === "dynamic-tool" ? part.input : undefined;
      if (
        part.type === "dynamic-tool" &&
        part.toolName === "checkouts__cancel" &&
        typeof (input as { runId?: unknown } | undefined)?.runId === "string"
      ) {
        runs.add((input as { runId: string }).runId);
      }
    }
  }
  return runs;
}

export function textOf(message: EveMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
}

/** What tells two copies of the same user message apart from other messages. */
function echoKey(message: EveMessage) {
  if (message.metadata?.optimistic) {
    const { text, files } = withoutFileLines(textOf(message));
    return `${text}\n${files}`;
  }
  const files = message.parts.filter((part) => part.type === "file").length;
  return `${textOf(message)}\n${files}`;
}

/**
 * For a moment after sending, Eve holds both the optimistic copy of a user
 * message and the server-confirmed one. Drop the optimistic copy once its
 * confirmed twin (same text and photos, same turn) is present, so nothing shifts.
 */
export function withoutConfirmedEchoes(messages: readonly EveMessage[]) {
  return messages.filter((message, index) => {
    if (message.role !== "user" || !message.metadata?.optimistic) {
      return true;
    }
    const text = echoKey(message);
    for (const other of messages.slice(index + 1)) {
      if (other.role === "assistant") {
        break;
      }
      if (!other.metadata?.optimistic && echoKey(other) === text) {
        return false;
      }
    }
    for (const other of messages.slice(0, index).reverse()) {
      if (other.role === "assistant") {
        break;
      }
      if (!other.metadata?.optimistic && echoKey(other) === text) {
        return false;
      }
    }
    return true;
  });
}

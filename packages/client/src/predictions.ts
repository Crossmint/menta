import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";
import { asksForSecret } from "@oca/crossmint-agent-checkouts/secret-fields";
import type { EveMessage } from "eve/react";
import { readDockNote } from "./checkouts";
import { withoutFileLines } from "./photos";

function withoutLinks(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(?:https?:\/\/|\/checkouts\/)[^\s<>]+/g, "[link]");
}

/** Only ordinary, public question descriptors; never values or private fields. */
export function predictionQuestion(run: CheckoutView | null) {
  const pending = run?.pending;
  if (
    run?.status !== "awaiting_input" ||
    pending?.kind !== "question" ||
    asksForSecret(pending.question) ||
    pending.fields.some(
      (field) => field.sensitive || asksForSecret(field.label),
    )
  ) {
    return null;
  }
  return {
    store: withoutLinks(run.store).slice(0, 200),
    question: withoutLinks(pending.question).slice(0, 1500),
    fields: pending.fields.slice(0, 12).map((field) => ({
      label: withoutLinks(field.label).slice(0, 200),
      kind: field.kind,
      options: (field.options ?? [])
        .slice(0, 20)
        .map((option) => withoutLinks(option.label).slice(0, 200)),
    })),
  };
}

/** Keep the latest user request through long agent runs, using visible text only. */
export function predictionContext(messages: readonly EveMessage[]) {
  const context: { role: "user" | "assistant"; text: string }[] = [];
  let hasUserRequest = false;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (context.length === 6 && hasUserRequest) {
      break;
    }
    const message = messages[index];
    if (!message || (message.role !== "user" && message.role !== "assistant")) {
      continue;
    }
    // Once full, scan only roles until the user's intent is found. Do not
    // parse older assistant/tool payloads just to retain one user message.
    if (context.length === 6 && message.role !== "user") {
      continue;
    }
    const raw = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    const text = withoutFileLines(raw).text;
    if (readDockNote(text)) {
      continue;
    }
    if (!text) {
      // A photo-only user request is still a new goal. Its pixels stay out of
      // predictions, and an older text request must not stand in for it.
      if (message.role === "user") {
        break;
      }
      continue;
    }
    if (context.length === 6) {
      context.pop();
    }
    hasUserRequest ||= message.role === "user";
    context.push({
      role: message.role,
      text: withoutLinks(text).slice(-1500),
    });
  }
  return context.reverse();
}

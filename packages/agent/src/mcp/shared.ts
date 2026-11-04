import { createHash } from "node:crypto";
import type { Checkouts } from "@oca/crossmint-agent-checkouts/checkouts";
import { z } from "zod";
import type { Answer } from "./forms.js";

export function failure(message: string) {
  // Our own messages (never card details or addresses): enough to see in the
  // logs why a host's tool call didn't go through.
  console.warn("MCP tool call failed", { message });
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

/** Crossmint's own short messages are safe to show; anything else stays generic. */
export function errorMessage(error: unknown) {
  return error instanceof Error && error.name === "CheckoutError"
    ? error.message
    : "Menta could not reach Crossmint. Try again shortly.";
}

/** Runs a tool's work; a throw becomes a short error result. */
export async function run<T>(
  work: () => Promise<T>,
  onError: (error: unknown) => string = errorMessage,
) {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof Error && error.name === "CheckoutError")) {
      console.error("MCP tool call threw", {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return failure(onError(error));
  }
}

/** Reads of the user's own checkouts or links: safe to repeat, nothing changes. */
export const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const runId = z
  .string()
  .min(1)
  .max(200)
  .describe("The checkout's runId.");

/** A stable message ID per answer, so a retried identical call is the same message to Crossmint. */
export function messageId(parts: unknown[]) {
  const hex = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Sends the store answers, or the user's own words instead; the same answer is the same message. */
export async function sendAnswer(
  checkouts: Checkouts,
  userId: string,
  runId: string,
  requestId: string,
  reply:
    | { readonly answers: Record<string, Answer> }
    | { readonly text: string },
) {
  if ("text" in reply) {
    await checkouts.respond(
      userId,
      runId,
      messageId([userId, runId, requestId, { instead: reply.text }]),
      { requestId, alternative: reply.text },
    );
    return;
  }
  await checkouts.respond(
    userId,
    runId,
    messageId([userId, runId, requestId, reply.answers]),
    { requestId, answers: reply.answers },
  );
}

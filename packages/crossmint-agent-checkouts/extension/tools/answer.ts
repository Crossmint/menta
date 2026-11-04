import { defineTool } from "eve/tools";
import { z } from "zod";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description:
    "Answer the store's current question (kind 'question'). Either send `answers` with values the user gave you or ordinary buyer facts from their relevant saved profile (field keys from the pending request; choice fields take option values), or send `instead` when the user wants something the question doesn't offer or says the options are wrong: a short instruction in the user's words for the checkout to act on (e.g. \"The Perfect Egg Sandwich is on the menu; find it and add one\"). Payment and protected fields cannot be answered here: the user completes them in Crossmint's secure UI. A protected step (kind 'protected') takes only `instead`, for when the user can't give it that way: their words, e.g. \"I don't have a password; sign in with a code sent to my email\". Never put a password or code in it. Call `watch` afterwards.",
  inputSchema: z
    .object({
      runId: z.string().min(1),
      requestId: z.string().min(1),
      // A catchall object, not z.record: a record's key schema becomes JSON
      // Schema `propertyNames`, which OpenAI's tool format drops with a warning.
      answers: z
        .object({})
        .catchall(
          z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
        )
        .optional(),
      instead: z.string().min(1).max(1000).optional(),
    })
    .refine(
      (input) =>
        (input.answers === undefined) !== (input.instead === undefined),
      "Send either answers or instead, not both.",
    ),
  label: { start: () => "Answer the store" },
  async execute(input, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    const run = await checkouts.get(user, input.runId);
    if (run.pending?.requestId !== input.requestId) {
      throw new Error(
        "That question is no longer open. Read the checkout again.",
      );
    }
    // A way round a protected step is the user's own words, never the secret.
    const otherWay =
      run.pending.kind === "protected" && input.instead !== undefined;
    if (run.pending.kind !== "question" && !otherWay) {
      throw new Error(
        run.pending.kind === "protected"
          ? "This step needs Crossmint's secure input. Ask the user to complete it above the message box, or send their way round it (no password, a code by email) as `instead`."
          : "This step needs Crossmint's secure input. Ask the user to complete it above the message box.",
      );
    }
    // The call id is stable across step replays, so a re-run resends the same message.
    return checkouts.respond(
      user,
      input.runId,
      ctx.callId,
      input.instead !== undefined
        ? { requestId: input.requestId, alternative: input.instead }
        : { requestId: input.requestId, answers: input.answers ?? {} },
    );
  },
});

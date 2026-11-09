import { defineTool } from "eve/tools";
import { z } from "zod";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description:
    'Give a running checkout a plain instruction in the user\'s words, with or without a question open: a preference or correction the browser agent should follow from now on (e.g. "Use standard shipping", "Choose navy if black is sold out", "Pickup, not delivery"). To reply to the store\'s open question, use `answer` instead. Never put card numbers, codes or passwords here. Call `watch` afterwards.',
  inputSchema: z.object({
    runId: z.string().min(1),
    text: z.string().min(1).max(1000),
  }),
  label: { start: () => "Tell the checkout" },
  async execute(input, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    // The service binds this stable call ID to the current request and payload.
    return checkouts.steer(user, input.runId, ctx.callId, input.text);
  },
});

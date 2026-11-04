import { defineTool } from "eve/tools";
import { z } from "zod";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description:
    "Ask Crossmint to stop a checkout. Accepted only means the request was received; read the checkout to see whether it was cancelled before the order was placed.",
  inputSchema: z.object({ runId: z.string().min(1) }),
  label: { start: () => "Cancel the checkout" },
  async execute({ runId }, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    return checkouts.cancel(user, runId);
  },
});

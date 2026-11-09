import { defineTool } from "eve/tools";
import { z } from "zod";
import { forModel } from "../lib/checkouts.js";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description:
    "Read a checkout's current status from Crossmint: what the store is asking, the payment amount, and the result or receipt.",
  inputSchema: z.object({ runId: z.string().min(1) }),
  label: { start: () => "Check the checkout" },
  async execute({ runId }, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    return checkouts.get(user, runId);
  },
  toModelOutput: (view) => ({ type: "json", value: forModel(view) }),
});

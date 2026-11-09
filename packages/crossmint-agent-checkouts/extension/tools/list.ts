import { defineTool } from "eve/tools";
import { z } from "zod";
import { forModel } from "../lib/checkouts.js";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description: "List the user's recent Crossmint checkouts, newest first.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).default(10),
    cursor: z.string().optional(),
  }),
  label: { start: () => "Look up your checkouts" },
  async execute(input, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    return checkouts.list(user, input);
  },
  toModelOutput: (page) => ({
    type: "json",
    value: { ...page, runs: page.runs.map(forModel) },
  }),
});

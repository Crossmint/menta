import { defineTool } from "eve/tools";
import { z } from "zod";
import { crossmintUserId, getLimitPayments } from "../../src/crossmint.js";

export default defineTool({
  description:
    "The user's spending limits that can pay now: each one's id, the name they approved it with, what's left, the one store it's for (null for any store) and when it expires. Read them when a checkout is ready to pay, to pick the one that fits what the purchase is for.",
  inputSchema: z.strictObject({}),
  label: { start: () => "Check spending limits" },
  async execute(_input, ctx) {
    const user = crossmintUserId(ctx.session.auth.current);
    const payments = getLimitPayments();
    if (!user) {
      throw new Error("Sign in to read spending limits.");
    }
    if (!payments) {
      throw new Error(
        "Spending limits can't be read on this server; the user approves the payment above the message box.",
      );
    }
    const limits = await payments.list(user);
    if (!limits) {
      throw new Error("Couldn't read the user's spending limits. Try again.");
    }
    return { limits };
  },
});

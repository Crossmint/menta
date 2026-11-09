import { defineTool } from "eve/tools";
import { z } from "zod";
import { crossmintUserId, getLimitPayments } from "../../src/crossmint.js";

export default defineTool({
  description:
    "Pay a checkout's open payment with one of the user's spending limits (an id from spending_limits): pick the one that fits what this purchase is for. Menta checks it's the user's and covers the payment (currency, amount left, store) before paying, and refuses otherwise; it never pays twice. You can't create, approve or raise a limit; if none fits, call request_spending_limit.",
  inputSchema: z.strictObject({
    runId: z.string().min(1).max(200),
    limitId: z.string().min(1).max(200),
  }),
  label: { start: () => "Pay from a spending limit" },
  async execute({ runId, limitId }, ctx) {
    const user = crossmintUserId(ctx.session.auth.current);
    const payments = getLimitPayments();
    if (!user) {
      throw new Error("Sign in to pay from a spending limit.");
    }
    if (!payments) {
      throw new Error(
        "Spending limits can't pay on this server; the user approves the payment above the message box.",
      );
    }
    const outcome = await payments.pay(user, runId, limitId);
    if ("problem" in outcome) {
      throw new Error(outcome.problem);
    }
    if ("answered" in outcome) {
      throw new Error(
        `This payment was already answered. Don't pay it again: call watch_checkout for this checkout with afterRequestId "${outcome.answered}" to follow it.`,
      );
    }
    // Watch on past the step just paid, which can still show for a moment.
    return { paid: outcome.paid, afterRequestId: outcome.requestId };
  },
});

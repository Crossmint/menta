import { defineTool } from "eve/tools";
import { crossmintUserId, getCheckouts } from "../../src/crossmint.js";
import { webOrigin } from "../../src/env.js";
import {
  LIMIT_REQUEST_DESCRIPTION,
  limitRequestInput,
  limitRequestKey,
  limitRequestResult,
  sealLimitRequest,
  shortOfPayment,
} from "../../src/limit-requests.js";

export default defineTool({
  description: LIMIT_REQUEST_DESCRIPTION,
  inputSchema: limitRequestInput,
  label: { start: ({ name }) => `Ask for a ${name} spending limit` },
  async execute(input, ctx) {
    const user = crossmintUserId(ctx.session.auth.current);
    const key = limitRequestKey();
    if (!user) {
      throw new Error("Sign in to ask for a spending limit.");
    }
    if (!key) {
      throw new Error("Spending limit requests aren't set up on this server.");
    }
    if (input.runId) {
      const view = await getCheckouts().get(user, input.runId);
      if (view.pending?.kind === "payment") {
        const short = shortOfPayment(input, view.pending);
        if (short) {
          throw new Error(short);
        }
      }
    }
    return limitRequestResult(webOrigin(), sealLimitRequest(key, user, input));
  },
});

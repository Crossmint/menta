import { forModel } from "@oca/crossmint-agent-checkouts/checkouts";
import { defineWorkflowTool } from "eve/tools";
import { sleep } from "workflow";
import { z } from "zod";
import { readCheckout } from "../../src/watch.js";

export default defineWorkflowTool({
  description:
    "Follow a checkout in the background until the store needs the user (a question, payment approval or protected input) or the checkout ends. Tell the user the checkout is underway, then wait for this result.",
  inputSchema: z.object({
    runId: z.string().min(1),
    afterRequestId: z
      .string()
      .min(1)
      .optional()
      .describe(
        "The pending.requestId just answered or paid, so it isn't returned again while the store catches up.",
      ),
  }),
  label: { start: () => "Follow the checkout" },
  async task({ runId, afterRequestId }, ctx) {
    "use workflow";
    // The step just answered can still show while Crossmint catches up: not news.
    const done = (read: Awaited<ReturnType<typeof readCheckout>>) =>
      read.settled &&
      !(afterRequestId && read.view.pending?.requestId === afterRequestId);
    let current = await readCheckout(ctx.session, runId);
    for (let polls = 0; !done(current) && polls < 720; polls++) {
      if (ctx.abortSignal.aborted) {
        break;
      }
      await sleep(polls < 20 ? "3s" : "10s");
      current = await readCheckout(ctx.session, runId);
    }
    return current.view;
  },
  // The live view URL is a capability for the owner's UI, not for the model.
  toModelOutput: (view) => ({ type: "json", value: forModel(view) }),
});

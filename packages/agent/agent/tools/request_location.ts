import { defineWorkflowTool } from "eve/tools";
import { sleep } from "workflow";
import { z } from "zod";
import {
  type LocationResponse,
  locationQuestion,
  readLocationAnswer,
} from "../../src/location.js";

/** Reads the chat's answer outside the replayed body (it parses JSON from the client). */
async function readAnswer(response: LocationResponse) {
  "use step";
  return readLocationAnswer(response);
}

export default defineWorkflowTool({
  description:
    "Ask the user's device where they are, for an order that depends on it (pickup or delivery near them, the nearest or local branch of a chain) when they haven't named a place. Returns their neighborhood, city, region, postal code and country, never coordinates, or `unavailable` with a reason. The chat asks the browser itself; the user only sees the browser's own permission prompt. Call it at most once per conversation: if an earlier call already shared a place, use that.",
  inputSchema: z.object({
    reason: z
      .string()
      .min(1)
      .max(200)
      .describe(
        "Why you need it, in a few words the user would recognize, e.g. 'To find the Shake Shack nearest you.'",
      ),
  }),
  label: { start: () => "Get your location" },
  async execute({ reason }, ctx) {
    "use workflow";
    // The browser answers within seconds once its permission prompt is
    // settled; give a prompt left open a couple of minutes, then move on so
    // the model can ask for a neighborhood instead.
    const answer = await Promise.race([
      ctx.ask(locationQuestion(reason)),
      sleep("2m"),
    ]);
    return readAnswer(answer as LocationResponse);
  },
});

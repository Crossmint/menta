import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  addressGuide,
  EXTENSION_TOOLS,
  listDescription,
} from "../lib/address-chat.js";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description: `${listDescription} Saved profiles never authorize payment.`,
  inputSchema: z.object({}),
  label: { start: () => "Check your addresses" },
  async execute(_input, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    return addressGuide(await checkouts.addresses(user), EXTENSION_TOOLS);
  },
});

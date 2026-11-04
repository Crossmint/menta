import { defineTool } from "eve/tools";
import {
  EXTENSION_TOOLS,
  saveDescription,
  saveFromChat,
  saveInput,
} from "../lib/address-chat.js";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description: saveDescription(EXTENSION_TOOLS),
  inputSchema: saveInput(EXTENSION_TOOLS),
  label: { start: ({ label }) => `Save the ${label} address` },
  async execute(input, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    // A missing email is the user's own: the one on their saved addresses.
    return saveFromChat(checkouts, user, input, EXTENSION_TOOLS, async () => {
      const saved = await checkouts.addresses(user);
      const own = [...saved].sort(
        (a, b) => Number(b.isDefault) - Number(a.isDefault),
      );
      return (
        own.find((item) => item.details.contact?.email)?.details.contact
          ?.email ?? null
      );
    });
  },
});

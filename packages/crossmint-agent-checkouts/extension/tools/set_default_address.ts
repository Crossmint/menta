import { defineTool } from "eve/tools";
import {
  EXTENSION_TOOLS,
  setDefaultDescription,
  setDefaultFromChat,
  setDefaultInput,
} from "../lib/address-chat.js";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description: setDefaultDescription,
  inputSchema: setDefaultInput(EXTENSION_TOOLS),
  label: { start: () => "Set the default address" },
  async execute({ id }, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    return setDefaultFromChat(checkouts, user, id, EXTENSION_TOOLS);
  },
});

import { defineTool } from "eve/tools";
import {
  deleteDescription,
  deleteFromChat,
  deleteInput,
  EXTENSION_TOOLS,
} from "../lib/address-chat.js";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description: deleteDescription,
  inputSchema: deleteInput(EXTENSION_TOOLS),
  label: { start: () => "Delete the address" },
  async execute({ id }, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    return deleteFromChat(checkouts, user, id, EXTENSION_TOOLS);
  },
});

import { defineTool } from "eve/tools";
import { z } from "zod";
import extension from "../extension.js";

export default defineTool({
  description:
    "Get the link where the user adds or manages saved cards. Card details are entered only in Crossmint's secure form on that page, never in chat. Saving a card does not approve any payment.",
  inputSchema: z.object({}),
  label: { start: () => "Open card settings" },
  execute() {
    return { url: extension.config.cardsUrl() };
  },
});

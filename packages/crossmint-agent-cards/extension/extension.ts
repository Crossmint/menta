import { defineExtension } from "eve/extension";
import { z } from "zod";

export default defineExtension({
  config: z.object({
    /** Signed-in page where the user saves and manages cards with Crossmint's UI. */
    cardsUrl: z.custom<() => string>((value) => typeof value === "function"),
  }),
});

import type { SessionAuthContext } from "eve/context";
import { defineExtension } from "eve/extension";
import { z } from "zod";
import type { Checkouts } from "./lib/checkouts.js";

export default defineExtension({
  config: z.object({
    /** Called per tool call, so credentials are read at runtime rather than at build. */
    checkouts: z.custom<() => Checkouts>(
      (value) => typeof value === "function",
    ),
    /** Map the verified session principal to the Crossmint user it acts for. */
    userId: z.custom<(auth: SessionAuthContext | null) => string | null>(
      (value) => typeof value === "function",
    ),
  }),
});

import { defineTool } from "eve/tools";
import { z } from "zod";
import { shippingFields } from "../lib/address-draft.js";
import { forModel, notStarted, notStartedForModel } from "../lib/checkouts.js";
import { checkoutsFor } from "../lib/context.js";

export default defineTool({
  description:
    "Start a Crossmint checkout: a browser agent opens startUrl (usually the store's home page) and completes the shopping task, never spending above maxCost. Match the user's intended outcome: buy through checkout for a purchase request, or stop at finding or adding to a cart, or at signing in to the store, only when explicitly requested. A purchase is paid only from a spending limit the user approved; you can't approve one. Set fulfillment, and for a delivery deliverTo. A delivery to the user always starts: their default address is attached when they have one, otherwise the store account's address or the store's own question covers it. A delivery to someone else uses that person's saved address; with none, nothing starts (`needs_address`): ask for it in chat and save it with `checkouts__save_address`. The user's store sign-ins are attached too. `shipsTo` in the result names the saved address; null means none. Starting is not idempotent; if the result is unclear, list checkouts before trying again. Afterwards call `watch` so you hear when the store needs the user or the checkout ends.",
  inputSchema: z.object({
    startUrl: z
      .url()
      .describe(
        "The store's home page, e.g. https://www.amazon.com/. Don't construct product or search URLs; the browser agent searches and navigates from the home page, and deep links are more likely to be blocked.",
      ),
    task: z
      .string()
      .min(1)
      .max(4000)
      .describe(
        "The full outcome the user wants, in one short line. For a purchase (including a bare item request), say 'Buy …': finding and adding to a cart are intermediate steps, with secure payment approval and store order confirmation still required. Only stop at finding or adding to a cart when the user explicitly asked for that limited outcome. When they only want to sign in to the store, say 'Sign in …' with the account's email or phone if given, never a password or code. Include only the size, color, quantity, dates and delivery or pickup wishes the user gave. Don't add choices they didn't make (e.g. 'best-rated' or 'cheapest'): when several items fit, the browser agent asks the user.",
      ),
    maxCost: z.object({
      amount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/)
        .describe(
          "Decimal string, e.g. '180.00'. A generous ceiling, not a price guess: comfortably above the likely total with tax, shipping, fees and tip (about 1.5-2x your estimate, rounded up), or the user's own budget exactly. For a task that buys nothing, like only signing in: '1.00'. Too low fails the checkout. What's charged is the store's real total, never above this, and only from a spending limit the user approved.",
        ),
      currency: z.string().length(3).default("USD"),
    }),
    ...shippingFields("`checkouts__addresses`"),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .optional()
      .describe(
        "ISO 3166-1 alpha-2 country the store should see the checkout browser in, e.g. 'US': the country of the user's shared location for pickups and local orders, or of the delivery address. Leave it out to use the attached address's country.",
      ),
  }),
  label: { start: ({ startUrl }) => `Start checkout at ${startUrl}` },
  async execute(input, ctx) {
    const { checkouts, user } = checkoutsFor(ctx);
    return checkouts.create(user, input);
  },
  toModelOutput: (result) => ({
    type: "json",
    value: notStarted(result)
      ? notStartedForModel(result, {
          start: "checkouts__create",
          save: "checkouts__save_address",
        })
      : forModel(result),
  }),
});

import { z } from "zod";
import { addressLabels } from "./address-labels.js";
import type { BuyerDetails } from "./checkouts.js";

/**
 * One address form's flat fields, as the account page, the chat's address
 * form and the in-host card send them. Validated here once for every surface.
 */
export interface BuyerDraft {
  /** What the user calls this address ("Home", "Mom"); the agent ships to it by this name. */
  label: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  /** Subdivision without the country prefix ("CA"), or a full ISO 3166-2 code ("US-CA"). */
  region: string;
  postalCode: string;
  country: string;
}

export type DraftErrors = Partial<Record<keyof BuyerDraft, string>>;

const text = (max: number) => z.string().trim().max(max, "Too long.");

/** Validates a draft and turns it into a label plus Crossmint's buyer-profile shape. */
export const buyerDraft = z
  .object({
    label: text(40).min(1, "Name this address, like Home."),
    firstName: text(100).min(1, "Enter a first name."),
    lastName: text(100).min(1, "Enter a last name."),
    email: text(254).refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email.",
    ),
    phone: text(40),
    address1: text(200).min(1, "Enter a street address."),
    address2: text(200),
    city: text(120).min(1, "Enter a city."),
    region: text(10).toUpperCase(),
    postalCode: text(40),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Choose a country."),
  })
  .transform((draft, ctx): { label: string; details: BuyerDetails } => {
    const region =
      draft.region === "" || draft.region.includes("-")
        ? draft.region
        : `${draft.country}-${draft.region}`;
    if (
      region !== "" &&
      !(
        /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(region) &&
        region.startsWith(`${draft.country}-`)
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["region"],
        message: regionMessage(draft.country),
      });
      return z.NEVER;
    }
    return {
      label: draft.label,
      details: {
        name: { first: draft.firstName, last: draft.lastName },
        contact: {
          ...(draft.email ? { email: draft.email } : {}),
          ...(draft.phone ? { phone: draft.phone } : {}),
        },
        shipping: {
          addressLines: [draft.address1, draft.address2].filter(Boolean),
          locality: draft.city,
          administrativeAreaCode: region || null,
          postalCode: draft.postalCode || null,
          countryCode: draft.country,
        },
      },
    };
  });

/** The first message for each field, for showing under its input. */
export function draftErrors(error: z.ZodError): DraftErrors {
  const errors: DraftErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof BuyerDraft | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/**
 * "Ada Lovelace" as Crossmint's first and last name. Everything after the
 * first word is the last name, so the full name reads back unchanged.
 */
export function splitName(full: string) {
  const [first = "", ...rest] = full.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

const optional = (max: number) => z.string().trim().max(max).optional();

/**
 * An address in one flat shape, for tools: an assistant saves one the user
 * gave in chat (address-chat.ts).
 */
export const addressFields = {
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .describe("What the user calls this address, e.g. 'Home', 'Work', 'Mom'."),
  name: optional(200).describe("Full name of the person it ships to."),
  line1: z.string().trim().min(1).max(200).describe("Street and number."),
  line2: optional(200).describe("Apartment, suite, floor."),
  city: z.string().trim().min(1).max(120),
  region: optional(10).describe("State or region code, e.g. 'NY'."),
  postalCode: optional(40),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .describe("ISO 3166-1 alpha-2 country code, e.g. 'US'."),
};

export type AddressFields = z.infer<z.ZodObject<typeof addressFields>>;

/** A flat address plus contact details as an address form draft. */
export function toBuyerDraft(
  address: AddressFields & { email?: string; phone?: string },
): BuyerDraft {
  return {
    label: address.label,
    ...splitName(address.name ?? ""),
    email: address.email ?? "",
    phone: address.phone ?? "",
    address1: address.line1,
    address2: address.line2 ?? "",
    city: address.city,
    region: address.region ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country.toUpperCase(),
  };
}

/**
 * Whose address it is, as the model says when proposing one: the user's own
 * place, or someone else's. Someone else's starts without the user's name and
 * is never offered as the default.
 */
export const recipientField = z
  .enum(["me", "someone_else"])
  .default("me")
  .describe(
    "Whose address it is: 'me' for the user's own place (home, work), 'someone_else' for another person's (Mom, a friend).",
  );

export type Recipient = z.infer<typeof recipientField>;

/**
 * Where a checkout goes, for the start tools of the web agent and the MCP
 * server alike. `listTool` names the tool that lists saved labels.
 */
export function shippingFields(listTool: string) {
  return {
    fulfillment: z
      .enum(["delivery", "pickup", "none"])
      .describe(
        "How the order reaches the user. 'pickup': they collect it (\"for pickup\", restaurant takeout). 'none': nothing ships (e-tickets, digital goods, bookings, in-store). 'delivery': physical goods brought to someone; use it when unsure about a physical item.",
      ),
    deliverTo: z
      .enum(["me", "store_account", "someone_else"])
      .default("me")
      .describe(
        'Deliveries only: whom it\'s for. \'me\': the user ("to me", "my house", or no one named). Their default address is attached, or none, and the store\'s account or the store\'s own question covers it. \'store_account\': the user said to use the address on their store account ("log in first, it has my address"); nothing of ours is attached. \'someone_else\': another person ("my mom", "my partner", a gift sent to a friend); needs addressLabel.',
      ),
    addressLabel: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe(
        `A saved address's label from ${listTool}. With 'someone_else': that person's saved label, or for someone not saved yet, what the user calls them ('Mom'); never a pronoun. With 'me': only when the user names one of their own saved places ("to work" → 'Work'); otherwise leave it out.`,
      ),
    cityHint: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe(
        "Only for someone_else not saved yet: the city the user mentioned for them ('Tampa'). It prefills the address form.",
      ),
  };
}

/** Field errors as one line, for surfaces that show a single message. */
export function firstError(errors: DraftErrors) {
  const first = Object.values(errors).find(Boolean);
  return first === "Enter a last name."
    ? "Enter a first and last name."
    : first;
}

/** "Use the state code, like CA." in the country's own words. */
function regionMessage(country: string) {
  const { region, regionExample } = addressLabels(country);
  const name = region.replace(/ \(optional\)$/, "").toLowerCase();
  return regionExample
    ? `Use the ${name} code, like ${regionExample}.`
    : `Use the ${name} code, or leave it empty.`;
}

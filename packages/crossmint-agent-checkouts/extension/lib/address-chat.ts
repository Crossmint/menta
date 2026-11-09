import { z } from "zod";
import {
  addressFields,
  buyerDraft,
  draftErrors,
  firstError,
  recipientField,
  toBuyerDraft,
} from "./address-draft.js";
import {
  addressesForModel,
  type Checkouts,
  type SavedAddress,
} from "./checkouts.js";

/**
 * Delivery addresses settled in the conversation, for any agent: the web
 * chat's tools and the MCP server's. The model reads the saved addresses,
 * asks for what's missing in chat, and saves, deletes or sets the default;
 * every `next` line tells it what to say. `ToolNames` are what each agent
 * calls its tools.
 */
export interface ToolNames {
  readonly list: string;
  readonly save: string;
  readonly setDefault: string;
  readonly start: string;
}

/** This extension's tools, as the web chat's model sees them. */
export const EXTENSION_TOOLS: ToolNames = {
  list: "checkouts__addresses",
  save: "checkouts__save_address",
  setDefault: "checkouts__set_default_address",
  start: "checkouts__create",
};

/** The saved addresses as the model reads them, and what to do before a delivery. */
export function addressGuide(
  addresses: readonly SavedAddress[],
  tools: ToolNames,
) {
  const preferred = addresses.find((address) => address.isDefault);
  return {
    addresses: addressesForModel(addresses),
    default: preferred?.label ?? null,
    next: preferred
      ? `Deliveries go to "${preferred.label}" (${preferred.place}) unless the user names another. Say so in one short line as you start, e.g. "I'll send it to ${preferred.label}, ${preferred.place}, unless you tell me otherwise."`
      : addresses.length > 0
        ? `No default. Before a delivery, ask in one short line which saved address to use, or a new one. If the user picks one for their own deliveries from now on, ${tools.setDefault}.`
        : `Nothing saved. Before a delivery, ask for what's missing in one short message: the recipient's full name, a phone number and the street address. Don't ask again for anything the user already told you. Work out the city, postcode, region and country from the street yourself and confirm them with the user rather than asking for each. Name it with a short label from context ('Home', 'Work', 'Mom'), asking only if you can't tell, then ${tools.save}.`,
  };
}

const addressId = (tools: ToolNames) =>
  z.string().min(1).max(200).describe(`The address's id, from ${tools.list}.`);

/** What the read tool says it does. */
export const listDescription =
  "The user's saved delivery addresses: id, label, default flag, recipient name, contact email and phone, and the full address. Read them before starting a delivery, so you know where it goes, and when the user asks about their addresses.";

export function saveDescription(tools: ToolNames) {
  return `Save a delivery address the user gave you, or change a saved one (pass its id). Save only details the user gave or confirmed: work out the city, postcode, region and country from the street and confirm them with the user, instead of asking for each. makeDefault only when the user wants it as the default for their own deliveries, or it's the first address they save for themselves. To start a checkout with it, pass its label as addressLabel to ${tools.start}.`;
}

export const deleteDescription =
  "Delete one of the user's saved delivery addresses, by id. Only when the user asks to remove it; confirm which one first. Checkouts already started keep their address.";

export const setDefaultDescription =
  "Make one of the user's own saved addresses the default for their deliveries, or pass id null for no default. Only when the user asks or agrees.";

export function saveInput(tools: ToolNames) {
  return z.object({
    id: addressId(tools)
      .optional()
      .describe(
        `To change a saved address: its id from ${tools.list}. Send all its fields again, changed or not: any you leave out is cleared, and a left-out email becomes the user's own.`,
      ),
    ...addressFields,
    label: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .describe(
        "A short name you pick from what you know, one or two words: 'Home', 'Work', 'Mom', 'Beach house'. Name it from context; ask the user only if you really can't tell. Never use the street.",
      ),
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe("Full name of the person it ships to."),
    phone: z
      .string()
      .trim()
      .max(40)
      .optional()
      .describe("Phone number for the delivery, with country code."),
    email: z
      .string()
      .trim()
      .max(254)
      .optional()
      .describe(
        "Email for delivery updates. Leave it out to use the user's own.",
      ),
    recipient: recipientField,
    makeDefault: z
      .boolean()
      .optional()
      .describe(
        "Make it the default for the user's deliveries. Only for their own place.",
      ),
  });
}

export const deleteInput = (tools: ToolNames) =>
  z.object({ id: addressId(tools) });

export const setDefaultInput = (tools: ToolNames) =>
  z.object({
    id: addressId(tools)
      .nullable()
      .describe(`The address's id from ${tools.list}, or null for no default.`),
  });

/** A problem the model can fix and retry, in one line. */
export interface AddressProblem {
  readonly problem: string;
}

/**
 * Saves (or, with `id`, replaces) an address. `ownEmail` fills a missing
 * email: the user's own, for delivery updates.
 */
export async function saveFromChat(
  checkouts: Checkouts,
  userId: string,
  input: z.infer<ReturnType<typeof saveInput>>,
  tools: ToolNames,
  ownEmail: () => Promise<string | null>,
) {
  const { id, recipient, makeDefault, ...fields } = input;
  if (makeDefault && recipient === "someone_else") {
    return {
      problem:
        "Someone else's address can't be the default; the default is the user's own place.",
    } satisfies AddressProblem;
  }
  const email = fields.email || (await ownEmail().catch(() => null)) || "";
  const parsed = buyerDraft.safeParse(
    toBuyerDraft({ ...fields, ...(email ? { email } : {}) }),
  );
  if (!parsed.success) {
    return {
      problem: firstError(draftErrors(parsed.error)) ?? "Check the address.",
    } satisfies AddressProblem;
  }
  const saved = await checkouts.saveAddress(userId, {
    ...parsed.data,
    ...(id ? { id } : {}),
    makeDefault: makeDefault === true,
  });
  const address = saved.addresses.find((item) => item.id === saved.id);
  if (!address) {
    return {
      problem: "The address was saved but couldn't be read back.",
    } satisfies AddressProblem;
  }
  return {
    saved: addressesForModel([address])[0],
    next: `Saved as "${address.label}"${address.isDefault ? ", the default for deliveries" : ""}. Tell the user in one short line. To ship there, call ${tools.start} with addressLabel "${address.label}"${recipient === "someone_else" ? ' and deliverTo "someone_else"' : ""}.`,
  };
}

export async function deleteFromChat(
  checkouts: Checkouts,
  userId: string,
  id: string,
  tools: ToolNames,
) {
  const current = await checkouts.addresses(userId);
  const gone = current.find((address) => address.id === id);
  if (!gone) {
    return {
      problem: "There's no saved address with that id.",
    } satisfies AddressProblem;
  }
  const left = addressGuide(await checkouts.deleteAddress(userId, id), tools);
  return {
    ...left,
    deleted: gone.label,
    next: `Deleted "${gone.label}". Tell the user in one short line.`,
  };
}

export async function setDefaultFromChat(
  checkouts: Checkouts,
  userId: string,
  id: string | null,
  tools: ToolNames,
) {
  let updated: readonly SavedAddress[];
  if (id === null) {
    const current = await checkouts.addresses(userId);
    const preferred = current.find((address) => address.isDefault);
    updated = preferred
      ? await checkouts.setDefaultAddress(userId, preferred.id, false)
      : current;
  } else {
    updated = await checkouts.setDefaultAddress(userId, id, true);
  }
  const preferred = updated.find((address) => address.isDefault);
  return {
    ...addressGuide(updated, tools),
    next: preferred
      ? `Deliveries now go to "${preferred.label}" (${preferred.place}) by default. Tell the user in one short line.`
      : "No default now: before a delivery, you'll ask which address to use. Tell the user in one short line.",
  };
}

/** Whether a chat helper returned a problem to fix instead of a result. */
export function isProblem(value: object): value is AddressProblem {
  return "problem" in value;
}

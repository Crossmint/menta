import {
  type BuyerDraft,
  buyerDraft,
  type DraftErrors,
  draftErrors,
  splitName,
} from "@oca/crossmint-agent-checkouts/address-draft";
import {
  addressLabels,
  COUNTRY_CODES,
  defaultCountry,
} from "@oca/crossmint-agent-checkouts/address-labels";
import type {
  BuyerDetails,
  SavedAddress,
} from "@oca/crossmint-agent-checkouts/checkouts";

export { COUNTRY_NAMES } from "./country-names";
// The form's fields and their validation are shared with the MCP server
// (the in-host card saves addresses too).
export type { BuyerDetails, BuyerDraft, DraftErrors, SavedAddress };
export { addressLabels, buyerDraft, COUNTRY_CODES, draftErrors, splitName };

/** Quick picks for an address's label. */
export const LABEL_SUGGESTIONS = ["Home", "Work"] as const;

/** The full name a draft holds, as one field shows it. */
export function nameOf(draft: Pick<BuyerDraft, "firstName" | "lastName">) {
  return [draft.firstName, draft.lastName].filter(Boolean).join(" ");
}

const crossmintFields: Record<string, keyof BuyerDraft> = {
  label: "label",
  "name.first": "firstName",
  "name.last": "lastName",
  "contact.email": "email",
  "contact.phone": "phone",
  "shipping.addressLines": "address1",
  "shipping.locality": "city",
  "shipping.administrativeAreaCode": "region",
  "shipping.postalCode": "postalCode",
  "shipping.countryCode": "country",
};

/** Places a Crossmint validation message ("shipping.locality: …") under its form field. */
export function crossmintError(message: string): DraftErrors {
  const [, path, detail] = message.match(/^([\w.]+?)(?:\.\d+)?: (.+)$/) ?? [];
  const field = path ? crossmintFields[path] : undefined;
  if (!field || !detail) {
    return {};
  }
  return {
    [field]:
      field === "region"
        ? "Use a valid state or region code, like CA."
        : detail,
  };
}

/**
 * The form for an address, or for a new one. A new address starts with the
 * contact details the user already uses (or their sign-in email), not a name:
 * it may be for someone else.
 */
export function toDraft(
  address: Pick<SavedAddress, "label" | "details"> | null,
  contact: { email?: string | null; phone?: string | null } = {},
): BuyerDraft {
  const details = address?.details ?? null;
  const country = details?.shipping.countryCode ?? defaultCountry();
  const region = details?.shipping.administrativeAreaCode ?? "";
  return {
    label: address?.label ?? "",
    firstName: details?.name?.first ?? "",
    lastName: details?.name?.last ?? "",
    email: details ? (details.contact?.email ?? "") : (contact.email ?? ""),
    phone: details ? (details.contact?.phone ?? "") : (contact.phone ?? ""),
    address1: details?.shipping.addressLines[0] ?? "",
    address2: details?.shipping.addressLines.slice(1).join(", ") ?? "",
    city: details?.shipping.locality ?? "",
    region: region.startsWith(`${country}-`)
      ? region.slice(country.length + 1)
      : region,
    postalCode: details?.shipping.postalCode ?? "",
    country,
  };
}

/** One line for a saved address: "Ada Lovelace · 1 Main St, Miami, FL · United States". */
export function addressLine(
  details: BuyerDetails,
  countryName: (code: string) => string,
) {
  const { name, shipping } = details;
  const region = shipping.administrativeAreaCode?.split("-")[1];
  return [
    [name?.first, name?.last].filter(Boolean).join(" "),
    [shipping.addressLines[0], shipping.locality, region]
      .filter(Boolean)
      .join(", "),
    countryName(shipping.countryCode),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Contact details a new address starts with: the default address's (the
 * user's own place), else the sign-in's.
 */
export function startingContact(
  addresses: readonly SavedAddress[] | null | undefined,
  me: { name?: string | null; email?: string | null } | null,
) {
  const fallback = addresses?.find((address) => address.isDefault)?.details;
  const name = [fallback?.name?.first, fallback?.name?.last]
    .filter(Boolean)
    .join(" ");
  return {
    name: name || me?.name || null,
    email: fallback?.contact?.email ?? me?.email ?? null,
    phone: fallback?.contact?.phone ?? null,
  };
}

import { describe, expect, it } from "vitest";
import {
  addressLine,
  type BuyerDraft,
  buyerDraft,
  crossmintError,
  draftErrors,
  toDraft,
} from "./buyer-details";

describe("Crossmint validation errors", () => {
  it("lands under the matching form field", () => {
    expect(
      crossmintError(
        "shipping.administrativeAreaCode: Use an ISO 3166-2 subdivision code, for example US-FL.",
      ),
    ).toEqual({ region: "Use a valid state or region code, like CA." });
    expect(
      crossmintError(
        "shipping.addressLines.0: Address lines must not be empty.",
      ),
    ).toEqual({ address1: "Address lines must not be empty." });
    expect(crossmintError("Something else went wrong.")).toEqual({});
  });
});

const draft: BuyerDraft = {
  label: " Home ",
  firstName: " Ada ",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "",
  address1: "1 Main St",
  address2: "",
  city: "San Francisco",
  region: "ca",
  postalCode: "94105",
  country: "us",
};

describe("account address form", () => {
  it("turns the form into a label and Crossmint's buyer-profile shape", () => {
    expect(buyerDraft.parse(draft)).toEqual({
      label: "Home",
      details: {
        name: { first: "Ada", last: "Lovelace" },
        contact: { email: "ada@example.com" },
        shipping: {
          addressLines: ["1 Main St"],
          locality: "San Francisco",
          administrativeAreaCode: "US-CA",
          postalCode: "94105",
          countryCode: "US",
        },
      },
    });
  });

  it("needs a label", () => {
    const result = buyerDraft.safeParse({ ...draft, label: "  " });
    expect(result.success ? {} : draftErrors(result.error)).toEqual({
      label: "Name this address, like Home.",
    });
  });

  it("clears empty optional address fields", () => {
    const parsed = buyerDraft.parse({ ...draft, region: "", postalCode: "" });
    expect(parsed.details.shipping).toMatchObject({
      administrativeAreaCode: null,
      postalCode: null,
    });
  });

  it("reports field errors, including a region from another country", () => {
    const result = buyerDraft.safeParse({
      ...draft,
      email: "nope",
      address1: " ",
      region: "GB-LND",
    });
    expect(result.success).toBe(false);
    const errors = result.success ? {} : draftErrors(result.error);
    expect(Object.keys(errors).sort()).toEqual(["address1", "email"]);

    const region = buyerDraft.safeParse({ ...draft, region: "GB-LND" });
    expect(region.success ? {} : draftErrors(region.error)).toHaveProperty(
      "region",
    );
  });

  it("round-trips a saved address and prefills only contact details for a new one", () => {
    const saved = buyerDraft.parse({ ...draft, address2: "Apt 2" });
    expect(toDraft(saved)).toMatchObject({
      label: "Home",
      firstName: "Ada",
      address2: "Apt 2",
      region: "CA",
      country: "US",
    });
    expect(
      toDraft(null, { email: "me@example.com", phone: "+1 555 0100" }),
    ).toMatchObject({
      label: "",
      firstName: "",
      email: "me@example.com",
      phone: "+1 555 0100",
      country: "US",
    });
  });

  it("summarizes an address in one line", () => {
    const { details } = buyerDraft.parse(draft);
    expect(addressLine(details, () => "United States")).toBe(
      "Ada Lovelace · 1 Main St, San Francisco, CA · United States",
    );
  });
});

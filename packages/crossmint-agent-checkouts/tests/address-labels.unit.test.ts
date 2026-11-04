import { afterEach, describe, expect, it, vi } from "vitest";
import { buyerDraft } from "../extension/lib/address-draft.js";
import {
  addressLabels,
  defaultCountry,
} from "../extension/lib/address-labels.js";

describe("address labels", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names the fields the way each country does", () => {
    expect(addressLabels("US")).toEqual({
      region: "State",
      regionExample: "CA",
      postalCode: "ZIP",
    });
    expect(addressLabels("gb").postalCode).toBe("Postcode");
    expect(addressLabels("CA").region).toBe("Province");
    expect(addressLabels("JP")).toEqual({
      region: "Region (optional)",
      regionExample: "",
      postalCode: "Postal code",
    });
  });

  it("starts new addresses in the browser's country", () => {
    vi.stubGlobal("navigator", { language: "en-GB" });
    expect(defaultCountry()).toBe("GB");
    vi.stubGlobal("navigator", { language: "fr" });
    expect(defaultCountry()).toBe("FR");
    vi.stubGlobal("navigator", { language: "" });
    expect(defaultCountry()).toBe("US");
  });

  it("accepts international addresses and explains region codes per country", () => {
    const base = {
      label: "Office",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
      phone: "",
      address1: "10 Analytical Way",
      address2: "",
      city: "London",
      region: "",
      postalCode: "EC1A 1BB",
      country: "GB",
    };
    expect(buyerDraft.safeParse(base).success).toBe(true);
    const ontario = buyerDraft.safeParse({
      ...base,
      city: "Toronto",
      region: "Ontario",
      postalCode: "M5V 2T6",
      country: "CA",
    });
    expect(ontario.success).toBe(false);
    expect(ontario.error?.issues[0]?.message).toBe(
      "Use the province code, like ON.",
    );
    expect(
      buyerDraft.safeParse({ ...base, region: "ON", country: "CA" }).success,
    ).toBe(true);
  });
});

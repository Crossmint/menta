import { describe, expect, it } from "vitest";
import {
  buyerDraft,
  draftErrors,
  firstError,
  splitName,
  toBuyerDraft,
} from "../extension/lib/address-draft.js";

describe("an address given in chat", () => {
  it("validates like the account form", () => {
    const parsed = buyerDraft.safeParse(
      toBuyerDraft({
        label: "Work",
        name: "Ada King Lovelace",
        line1: "1 Main St",
        city: "Springfield",
        region: "il",
        country: "us",
        email: "ada@example.com",
      }),
    );
    expect(parsed.success && parsed.data).toEqual({
      label: "Work",
      details: {
        name: { first: "Ada", last: "King Lovelace" },
        contact: { email: "ada@example.com" },
        shipping: {
          addressLines: ["1 Main St"],
          locality: "Springfield",
          administrativeAreaCode: "US-IL",
          postalCode: null,
          countryCode: "US",
        },
      },
    });
  });

  it("asks for a full name in one line", () => {
    const parsed = buyerDraft.safeParse(
      toBuyerDraft({
        label: "Mom",
        name: "Ada",
        line1: "1 A St",
        city: "Tampa",
        country: "US",
      }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(firstError(draftErrors(parsed.error))).toBe(
        "Enter a first and last name.",
      );
    }
    expect(splitName("  Ada   Lovelace ")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });
});

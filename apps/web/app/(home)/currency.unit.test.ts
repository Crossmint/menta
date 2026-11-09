import { describe, expect, it } from "vitest";
import { localPrice } from "./currency";

/** Intl separates with no-break spaces; compare with plain ones. */
const plain = (text: string) => text.replace(/\s/g, " ");

describe("localPrice", () => {
  it("writes prices the way the visitor's country does", () => {
    expect(
      plain(localPrice("es", 40, { country: "PE", currency: "PEN" })),
    ).toBe("S/ 149.90");
    expect(
      plain(localPrice("es", 140, { country: "CO", currency: "COP" })),
    ).toBe("$ 559.900");
    expect(
      plain(localPrice("es", 10, { country: "AR", currency: "USD" })),
    ).toBe("US$ 9,99");
  });

  it("drops the decimals from prices in whole units", () => {
    expect(
      plain(localPrice("sv", 80, { country: "SE", currency: "SEK" })),
    ).toBe("849 kr");
  });

  it("follows the language without a country", () => {
    expect(localPrice("en", 10)).toBe("$9.99");
  });
});

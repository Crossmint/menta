import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fieldWidths, splitPrice } from "../src/ui/question.js";
import { STORE_ICONS, storeBrand } from "./model.js";

const origin = "https://menta.example";

describe("the card's store, price and step details", () => {
  it("names known stores and points at the homepage's icons", () => {
    const icons = readdirSync(
      fileURLToPath(
        new URL("../../../apps/web/public/stores", import.meta.url),
      ),
    ).sort();
    expect(
      Object.values(STORE_ICONS)
        .map((store) => store.file)
        .sort(),
    ).toEqual(icons);
    expect(storeBrand("www.amazon.co.uk", origin)).toEqual({
      name: "Amazon",
      icon: `${origin}/stores/amazon.svg`,
      letter: "A",
    });
    expect(storeBrand("ubereats.com", origin).name).toBe("Uber Eats");
    expect(storeBrand("store.playstation.com", origin).icon).toBe(
      `${origin}/stores/playstation.svg`,
    );
  });

  it("asks our server for an unknown store's icon, with its letter to fall back on", () => {
    expect(storeBrand("www.halfmoonroasters.com", origin)).toEqual({
      name: "www.halfmoonroasters.com",
      icon: `${origin}/mcp/card/store/halfmoonroasters.com/icon`,
      letter: "H",
    });
  });

  it("sets a trailing price apart from the option's name", () => {
    expect(splitPrice("Energizer MAX AA, 4 pack ($5.97)")).toEqual({
      name: "Energizer MAX AA, 4 pack",
      price: "$5.97",
    });
    expect(splitPrice("Grande (16 oz)")).toEqual({
      name: "Grande (16 oz)",
      price: null,
    });
    expect(splitPrice("Size M (EUR 12,50)").price).toBe("EUR 12,50");
  });

  it("shares rows only in a split address form", () => {
    const text = (key: string, label: string) => ({
      key,
      label,
      required: true,
      kind: "text" as const,
    });
    expect([
      ...fieldWidths([
        text("q", "Your address, city, state or ZIP code"),
      ]).values(),
    ]).toEqual(["col-span-6"]);
    expect([
      ...fieldWidths([
        text("line1", "Street address"),
        text("line2", "Apt, suite"),
        text("city", "City"),
        text("state", "State"),
        text("zip", "ZIP code"),
        text("note", "Delivery note"),
      ]).values(),
    ]).toEqual([
      "col-span-4",
      "col-span-2",
      "col-span-2",
      "col-span-2",
      "col-span-2",
      "col-span-6",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { negotiate, ranked } from "./locales";

describe("ranked and negotiate", () => {
  it("orders supported languages by quality, matching the primary subtag", () => {
    expect(ranked("en-US,en;q=0.9,es-ES;q=0.8,tr;q=0.7,pt-PT;q=0.6")).toEqual([
      "en",
      "es",
      "pt",
    ]);
    expect(ranked("fr;q=0.5, ja")).toEqual(["ja", "fr"]);
    expect(negotiate("tr-TR")).toBe("en");
    expect(negotiate(null)).toBe("en");
  });

  it("reads any Norwegian as Bokmål", () => {
    expect(negotiate("no")).toBe("nb");
    expect(negotiate("nn-NO,en;q=0.5")).toBe("nb");
    expect(ranked("nb-NO,nb;q=0.9,no;q=0.8,nn;q=0.7,en;q=0.5")).toEqual([
      "nb",
      "en",
    ]);
  });
});

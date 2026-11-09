import { describe, expect, it } from "vitest";
import { LOCALE, LOCALE_SOURCE, localeMeta, requestLocale } from "./card.js";

describe("the card's language in tool results", () => {
  it("reads the language a host sent with the request", () => {
    expect(requestLocale({ "openai/locale": "es-ES" })).toBe("es-ES");
    expect(requestLocale({ "openai/locale": "es ES; x" })).toBeNull();
    expect(requestLocale({ "openai/locale": 7 })).toBeNull();
    expect(requestLocale(undefined)).toBeNull();
  });

  it("copies a valid request language into the result", () => {
    expect(localeMeta({ "openai/locale": "pt-BR" })).toEqual({
      [LOCALE]: "pt-BR",
      [LOCALE_SOURCE]: "host",
    });
    expect(localeMeta({ "openai/locale": "<b>pt</b>" })).toEqual({});
    expect(localeMeta({})).toEqual({});
  });

  it("prefers the language the assistant writes in", () => {
    expect(localeMeta({ "openai/locale": "en-US" }, "es")).toEqual({
      [LOCALE]: "es",
      [LOCALE_SOURCE]: "assistant",
    });
  });

  it("drops a garbage language argument and falls back to the request's", () => {
    expect(localeMeta({ "openai/locale": "fr-FR" }, "Spanish, please")).toEqual(
      { [LOCALE]: "fr-FR", [LOCALE_SOURCE]: "host" },
    );
    expect(localeMeta(undefined, `es-${"x".repeat(60)}`)).toEqual({});
    expect(localeMeta(undefined, 42)).toEqual({});
  });
});

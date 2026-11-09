import { describe, expect, it } from "vitest";
import { LOCALES } from "../locales";
import { loadMessages } from ".";
import en from "./en";

/** Every string in a messages tree, by its dotted path. */
function strings(tree: unknown, path = ""): Map<string, string> {
  const found = new Map<string, string>();
  if (typeof tree === "string") {
    found.set(path, tree);
  } else if (tree && typeof tree === "object") {
    for (const [key, value] of Object.entries(tree)) {
      for (const [inner, text] of strings(
        value,
        path ? `${path}.${key}` : key,
      )) {
        found.set(inner, text);
      }
    }
  }
  return found;
}

function placeholders(text: string) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

/** Plural forms a language may add or drop (Intl.PluralRules picks among them). */
const PLURAL_FORM = /\.(zero|one|two|few|many)$/;

const source = strings(en);

describe.each(LOCALES.filter((locale) => locale !== "en"))("%s", (locale) => {
  it("translates every message, with the same placeholders", async () => {
    const translated = strings(await loadMessages(locale));
    for (const [path, text] of source) {
      if (PLURAL_FORM.test(path)) {
        continue;
      }
      expect(translated.has(path), `${path} is missing`).toBe(true);
      expect(placeholders(translated.get(path) ?? ""), path).toEqual(
        placeholders(text),
      );
    }
    for (const [path, text] of translated) {
      if (PLURAL_FORM.test(path)) {
        expect(placeholders(text), path).toEqual(
          placeholders(source.get(path.replace(PLURAL_FORM, ".other")) ?? ""),
        );
        continue;
      }
      expect(source.has(path), `${path} isn't in English`).toBe(true);
    }
  });
});

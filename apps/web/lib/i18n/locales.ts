/**
 * The languages Menta speaks: English plus the top markets outside the US and
 * Canada (Link's home), where working worldwide matters most, and the Nordics.
 * Edge-safe: the proxy imports this file.
 */

export const LOCALES = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "pl",
  "sv",
  "nb",
  "da",
  "fi",
  "hi",
  "ja",
  "ko",
  "zh",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The visitor's choice from a language picker; it wins over the browser's languages. */
export const LOCALE_COOKIE = "menta_locale";

/** The request header the proxy sets so server components know the locale without re-deciding. */
export const LOCALE_HEADER = "x-menta-locale";

/** Each language in its own words, and its BCP 47 tag for `lang`, hreflang and Intl. */
export const LANGUAGES: Readonly<
  Record<Locale, { readonly name: string; readonly tag: string }>
> = {
  en: { name: "English", tag: "en" },
  es: { name: "Español", tag: "es" },
  fr: { name: "Français", tag: "fr" },
  de: { name: "Deutsch", tag: "de" },
  it: { name: "Italiano", tag: "it" },
  pt: { name: "Português (Brasil)", tag: "pt-BR" },
  nl: { name: "Nederlands", tag: "nl" },
  pl: { name: "Polski", tag: "pl" },
  sv: { name: "Svenska", tag: "sv" },
  nb: { name: "Norsk", tag: "nb" },
  da: { name: "Dansk", tag: "da" },
  fi: { name: "Suomi", tag: "fi" },
  hi: { name: "हिन्दी", tag: "hi" },
  ja: { name: "日本語", tag: "ja" },
  ko: { name: "한국어", tag: "ko" },
  zh: { name: "简体中文", tag: "zh-CN" },
};

/** Norwegian browsers may send the macrolanguage (no) or Nynorsk (nn): both read Bokmål. */
const ALIASES: Readonly<Record<string, Locale>> = { no: "nb", nn: "nb" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

/**
 * The supported locales in an Accept-Language header, best first, by quality
 * and then order, matching on the primary subtag ("pt-PT" → pt, "zh-TW" → zh).
 */
export function ranked(acceptLanguage: string | null | undefined): Locale[] {
  if (!acceptLanguage) {
    return [];
  }
  const found = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [range = "", ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return {
        primary: range.toLowerCase().split("-")[0],
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((item) => item.primary && item.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((item) => ALIASES[item.primary] ?? item.primary)
    .filter(isLocale);
  return [...new Set(found)];
}

/** The best supported locale for an Accept-Language header; English when nothing matches. */
export function negotiate(acceptLanguage: string | null | undefined): Locale {
  return ranked(acceptLanguage)[0] ?? DEFAULT_LOCALE;
}

/** The landing page's path for a locale: `/` for English, `/es` and so on for the rest. */
export function landingPath(locale: Locale) {
  return locale === DEFAULT_LOCALE ? "/" : `/${locale}`;
}

/** The help page's path for a locale: `/help` for English, `/es/help` and so on for the rest. */
export function helpPath(locale: Locale) {
  return locale === DEFAULT_LOCALE ? "/help" : `/${locale}/help`;
}

/**
 * The checkout UI's languages: the in-host card (ChatGPT, Claude) speaks the
 * host's language, the web app's dock and secure page the web app's. The same
 * 16 languages as the web app (apps/web/lib/i18n/locales.ts); English is the
 * source (./en.ts). DOM-free, so the logic helpers and the mobile app can use
 * it too.
 *
 * To add a language: write `./<locale>.ts` exporting `const <locale>:
 * UiMessages = { ... }` (every key, nothing else) and put it in `CATALOGS`.
 */

import { da } from "./da.js";
import { de } from "./de.js";
import { en, type UiMessages } from "./en.js";
import { es } from "./es.js";
import { fi } from "./fi.js";
import { fr } from "./fr.js";
import { hi } from "./hi.js";
import { it } from "./it.js";
import { ja } from "./ja.js";
import { ko } from "./ko.js";
import { nb } from "./nb.js";
import { nl } from "./nl.js";
import { pl } from "./pl.js";
import { pt } from "./pt.js";
import { sv } from "./sv.js";
import { zh } from "./zh.js";

export type { UiMessages };

export const UI_LOCALES = [
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

export type UiLocale = (typeof UI_LOCALES)[number];

/** Each language's BCP 47 tag for Intl (the web app's). */
const TAGS: Readonly<Record<UiLocale, string>> = {
  en: "en",
  es: "es",
  fr: "fr",
  de: "de",
  it: "it",
  pt: "pt-BR",
  nl: "nl",
  pl: "pl",
  sv: "sv",
  nb: "nb",
  da: "da",
  fi: "fi",
  hi: "hi",
  ja: "ja",
  ko: "ko",
  zh: "zh-CN",
};

/** Each language's strings. */
const CATALOGS: Readonly<Record<UiLocale, UiMessages>> = {
  en,
  es,
  fr,
  de,
  it,
  pt,
  nl,
  pl,
  sv,
  nb,
  da,
  fi,
  hi,
  ja,
  ko,
  zh,
};

/** Norwegian may come as the macrolanguage (no) or Nynorsk (nn): both read Bokmål. */
const ALIASES: Readonly<Record<string, UiLocale>> = { no: "nb", nn: "nb" };

function isUiLocale(value: string): value is UiLocale {
  return (UI_LOCALES as readonly string[]).includes(value);
}

/**
 * A language tag as a host sent it, or null: a short BCP 47 tag ("es-ES",
 * "zh-Hant-TW") of letters, digits and hyphens. Anything else is dropped.
 */
export function localeTag(value: unknown): string | null {
  return typeof value === "string" &&
    /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(value) &&
    value.length <= 35
    ? value
    : null;
}

/**
 * The nearest supported language for a BCP 47 tag, by its primary subtag
 * ("pt-BR" → pt, "nb-NO" → nb, "zh-Hant-TW" → zh); English for anything else.
 */
export function pickLocale(tag: string | null | undefined): UiLocale {
  const primary =
    typeof tag === "string"
      ? (tag.trim().toLowerCase().split(/[-_]/)[0] ?? "")
      : "";
  const locale = ALIASES[primary] ?? primary;
  return isUiLocale(locale) ? locale : "en";
}

export type Vars = Readonly<Record<string, string | number>>;

/** Fills `{name}` placeholders; an unknown placeholder stays as written. */
export function format(template: string, vars: Vars = {}) {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/** One language's strings, with its Intl tag and the formatter. */
export interface Ui {
  readonly locale: UiLocale;
  /** BCP 47 tag for Intl (money, dates, numbers). */
  readonly tag: string;
  readonly m: UiMessages;
  readonly f: typeof format;
}

const cache = new Map<UiLocale, Ui>();

/** The strings for a language or a BCP 47 tag (nearest supported; English by default). */
export function uiFor(localeOrTag: string | null | undefined): Ui {
  const locale = pickLocale(localeOrTag);
  let ui = cache.get(locale);
  if (!ui) {
    ui = { locale, tag: TAGS[locale], m: CATALOGS[locale], f: format };
    cache.set(locale, ui);
  }
  return ui;
}

/** English: what everything shows when no language is given. */
export const EN: Ui = uiFor("en");

/** A template split around one placeholder, for putting an element there ("Powered by {logo}"). */
export function around(template: string, name: string): [string, string] {
  const at = template.indexOf(`{${name}}`);
  return at < 0
    ? [template, ""]
    : [template.slice(0, at), template.slice(at + name.length + 2)];
}

/** The first letter capitalized, for a phrase that starts a sentence. */
export function capitalize(text: string, tag: string) {
  return text ? `${text[0]?.toLocaleUpperCase(tag)}${text.slice(1)}` : text;
}

/**
 * Each language's full stop, where it isn't ".": Hindi's danda (as its
 * catalog writes), and Japanese and Chinese's full-width stop.
 */
const FULL_STOP: Partial<Record<UiLocale, string>> = {
  hi: "।",
  ja: "。",
  zh: "。",
};

/** Japanese and Chinese put no space between sentences. */
const NO_SPACE: ReadonlySet<UiLocale> = new Set(["ja", "zh"]);

/**
 * Sentences as one line: each ends with the language's full stop unless it
 * already ends with one (or with a quote that closes one), so a store's
 * quoted words never get a second period.
 */
export function sentences(
  ui: Pick<Ui, "locale">,
  parts: readonly (string | null | undefined)[],
): string {
  const stop = FULL_STOP[ui.locale] ?? ".";
  const space = NO_SPACE.has(ui.locale) ? "" : " ";
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .map((part) =>
      /[.!?。！？…।]["'“”‘’」』«»‹›)]*$|["“”」』«»]$/.test(part)
        ? part
        : `${part}${stop}`,
    )
    .join(space);
}

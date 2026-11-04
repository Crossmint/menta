import type { Metadata } from "next";
import {
  helpPath,
  LANGUAGES,
  LOCALES,
  type Locale,
  landingPath,
} from "../../lib/i18n/locales";
import { getI18n } from "../../lib/i18n/server";

/**
 * The homepage's title, description and language alternates. No `openGraph`
 * or `twitter`: a page that sets them replaces the layout's objects whole and
 * loses the social image and large card.
 */
export async function landingMetadata(locale: Locale): Promise<Metadata> {
  const { m } = await getI18n(locale);
  return {
    title: { absolute: m.landing.meta.title },
    description: m.landing.meta.description,
    alternates: {
      canonical: landingPath(locale),
      languages: {
        ...Object.fromEntries(
          LOCALES.map((each) => [LANGUAGES[each].tag, landingPath(each)]),
        ),
        "x-default": "/",
      },
    },
  };
}

/** The help page's title, description and language alternates, like the homepage's. */
export async function helpMetadata(locale: Locale): Promise<Metadata> {
  const { m } = await getI18n(locale);
  return {
    title: m.help.meta.title,
    description: m.help.meta.description,
    alternates: {
      canonical: helpPath(locale),
      languages: {
        ...Object.fromEntries(
          LOCALES.map((each) => [LANGUAGES[each].tag, helpPath(each)]),
        ),
        "x-default": "/help",
      },
    },
  };
}

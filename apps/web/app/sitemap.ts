import type { MetadataRoute } from "next";
import {
  helpPath,
  LANGUAGES,
  LOCALES,
  type Locale,
  landingPath,
} from "../lib/i18n/locales";
import { LEGAL, siteOrigin } from "../lib/site";

/** The public entry points: the homepage and help in every language, sign-in, and the terms and privacy policy. Everything else needs a signed-in user. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const page = (
    path: (locale: Locale) => string,
    english: number,
    other: number,
  ) => {
    const languages = Object.fromEntries(
      LOCALES.map((locale) => [
        LANGUAGES[locale].tag,
        `${origin}${path(locale)}`,
      ]),
    );
    return LOCALES.map((locale) => ({
      url: `${origin}${path(locale)}`,
      priority: locale === "en" ? english : other,
      alternates: { languages },
    }));
  };
  return [
    ...page(landingPath, 1, 0.9),
    ...page(helpPath, 0.7, 0.6),
    { url: `${origin}/login`, priority: 0.5 },
    { url: `${origin}${LEGAL.terms}`, priority: 0.3 },
    { url: `${origin}${LEGAL.privacy}`, priority: 0.3 },
  ];
}

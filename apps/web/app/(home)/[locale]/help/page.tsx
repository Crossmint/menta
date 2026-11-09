import { notFound } from "next/navigation";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
} from "../../../../lib/i18n/locales";
import { Help } from "../../help";
import { helpMetadata } from "../../meta";

export const dynamicParams = false;

/** Every language but English, which lives at `/help`. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map(
    (locale) => ({ locale }),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return isLocale(locale) ? helpMetadata(locale) : {};
}

export default async function LocalizedHelp({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) {
    notFound();
  }
  return <Help locale={locale} />;
}

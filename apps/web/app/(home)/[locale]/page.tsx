import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "../../../lib/i18n/locales";
import { Landing } from "../landing";
import { landingMetadata } from "../meta";

export const dynamicParams = false;

/** Every language but English, which lives at `/`. */
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
  return isLocale(locale) ? landingMetadata(locale) : {};
}

export default async function LocalizedHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) {
    notFound();
  }
  const { country } = await searchParams;
  return (
    <Landing
      locale={locale}
      country={typeof country === "string" ? country : null}
    />
  );
}

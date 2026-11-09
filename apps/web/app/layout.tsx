import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BRAND_NAME, colors } from "../lib/brand";
import { I18nProvider } from "../lib/i18n/client";
import { getI18n } from "../lib/i18n/server";
import { DESCRIPTION, siteOrigin } from "../lib/site";
import { CookieBanner } from "./_components/cookie-banner";
import "./style.css";

// The homepage's title and description are the site's defaults, so `/`
// needs no metadata of its own: a page that sets `openGraph` or `twitter`
// replaces these objects whole and loses the social image and large card.
const DEFAULT_TITLE = `${BRAND_NAME} by Crossmint: let your agent buy anything, anywhere`;

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { template: `%s · ${BRAND_NAME}`, default: DEFAULT_TITLE },
  description: DESCRIPTION,
  applicationName: BRAND_NAME,
  keywords: [
    "agent commerce",
    "AI checkout",
    "ChatGPT plugin",
    "Claude connector",
    "Crossmint",
    "MCP",
  ],
  authors: [{ name: "Crossmint", url: "https://www.crossmint.com" }],
  creator: "Crossmint",
  publisher: "Crossmint",
  // Addresses and phone numbers show up in the UI; don't turn them into links.
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: colors.white,
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default async function Layout({ children }: { children: ReactNode }) {
  const { locale, tag, m } = await getI18n();
  return (
    <html lang={tag} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <I18nProvider locale={locale} messages={m}>
          {children}
          <CookieBanner />
        </I18nProvider>
      </body>
    </html>
  );
}

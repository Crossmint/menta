import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND_NAME } from "../../lib/brand";
import { getI18n } from "../../lib/i18n/server";
import { PRIVATE } from "../../lib/site";

/**
 * Link previews for the secure page. Assistants (Grok Bot, chat apps) and
 * messengers unfurl its URL from their servers, so the preview is generic:
 * never the item, price, store or who it's for. The page itself is signed-in.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { m, f, tag } = await getI18n();
  const title = f(m.checkout.preview.shareTitle, { brand: BRAND_NAME });
  const description = m.checkout.preview.description;
  return {
    // The page names itself per step (payment, question, live, done).
    title: m.checkout.preview.title,
    description,
    robots: PRIVATE,
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      title,
      description,
      locale: tag === "en" ? "en_US" : tag.replace("-", "_"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

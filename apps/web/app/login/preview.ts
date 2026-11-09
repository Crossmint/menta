import type { Metadata } from "next";
import { BRAND_NAME } from "../../lib/brand";
import type { Messages } from "../../lib/i18n/messages";
import { DESCRIPTION } from "../../lib/site";
import { SOCIAL_PAGES, type SocialPage } from "../social/pages";

const BASE = "https://menta.invalid";

/** The signed-in page sign-in leads back to, among those with a link image. */
function pageFor(next: string | string[] | undefined): SocialPage | null {
  // `/\[` parses as a host and throws, so check before parsing.
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    !URL.canParse(next, BASE)
  ) {
    return null;
  }
  const path = new URL(next, BASE).pathname;
  const under = (base: string) => path === base || path.startsWith(`${base}/`);
  if (under("/spending-limit")) {
    return "spending-limit";
  }
  if (path.startsWith("/checkouts/")) {
    return "secure-page";
  }
  if (under("/wallet")) {
    return "wallet";
  }
  if (under("/settings") || under("/addresses")) {
    return "settings";
  }
  return null;
}

/**
 * The link preview of a page Menta's MCP server links to. Those pages are
 * signed-in, so a crawler (iMessage, Slack, an assistant) lands here, at
 * `/login?next=<page>`, and gets that page's title and image instead of the
 * homepage's. Generic, like the images: never the item, amount or who it's
 * for. Null for any other `next`, which keeps the site's own preview.
 */
export function previewFor(
  next: string | string[] | undefined,
  m: Messages,
  tag: string,
): Metadata | null {
  const page = pageFor(next);
  if (!page) {
    return null;
  }
  const [title, description] = {
    "spending-limit": [m.checkout.limit.title, m.checkout.limit.lede],
    "secure-page": [
      m.checkout.preview.shareTitle,
      m.checkout.preview.description,
    ],
    wallet: [m.app.home.addCard, m.checkout.limit.cardNote],
    settings: [m.app.settingsPage.title, DESCRIPTION],
  }[page];
  const shared = `${title} · ${BRAND_NAME}`;
  const images = [
    {
      url: `/social/${page}`,
      width: 1200,
      height: 630,
      type: "image/png",
      alt: SOCIAL_PAGES[page].alt,
    },
  ];
  return {
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      title: shared,
      description,
      locale: tag === "en" ? "en_US" : tag.replace("-", "_"),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: shared,
      description,
      images,
    },
  };
}

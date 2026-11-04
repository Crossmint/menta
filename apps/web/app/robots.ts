import type { MetadataRoute } from "next";
import { siteOrigin } from "../lib/site";

/** Only the public entry points are crawlable; everything signed-in stays out. */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/help", "/login", "/terms", "/privacy"],
      disallow: [
        "/api/",
        "/chat",
        "/c/",
        "/install",
        "/connections",
        "/wallet",
        "/spending-limits",
        "/addresses",
        "/transactions",
        "/home",
        "/activity",
        "/checkouts/",
        "/oauth/",
        "/account",
        "/settings",
        "/mcp",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

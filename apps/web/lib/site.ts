/**
 * The official Menta deployment. Only the published plugin manifests
 * (lib/plugin.ts) use it, so the plugin connects to the hosted MCP server;
 * the app itself reads its origin from the environment (see siteOrigin).
 */
export const PRODUCTION_ORIGIN = "https://menta.crossmint.com";
/**
 * Stytch's authorization server for the official deployment's MCP channel
 * (its custom domain; OCA_MCP_AUTHORIZATION_SERVER_URL in production).
 */
export const PRODUCTION_AUTHORIZATION_SERVER =
  "https://login.menta.crossmint.com";

/**
 * The public origin for absolute URLs in metadata, robots and the sitemap:
 * the configured app origin, else Vercel's production domain, else local
 * development. Never the official deployment, so a fork keeps its own
 * identity. Read at build time for static metadata.
 */
export function siteOrigin() {
  const configured = process.env.OCA_WEB_ORIGIN?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  for (const candidate of [configured, vercel && `https://${vercel}`]) {
    if (candidate) {
      try {
        return new URL(candidate).origin;
      } catch {
        // Not a URL; try the next one.
      }
    }
  }
  return "http://localhost:3000";
}

/** One honest line, shared by metadata, the social image and the manifest. Short enough that link cards show it whole. */
export const DESCRIPTION =
  "A plugin for your favorite agent that goes from research to placing orders, quickly and reliably.";

/** Pages that must stay out of search results. */
export const PRIVATE = { index: false, follow: false } as const;

/** The public source repository: the homepage's "Fork on GitHub". Not public yet, so the plugin manifests leave it out. */
export const REPO_URL = "https://github.com/Crossmint/menta";

/** Menta's own terms and privacy policy, by path (the plugin manifests list them on the official deployment). */
export const LEGAL = {
  terms: "/terms",
  privacy: "/privacy",
} as const;

/** How people reach support: an email, or a mention on X. */
export const SUPPORT = {
  email: "agents@crossmint.com",
  x: "https://x.com/crossmint_ai",
  handle: "@crossmint_ai",
} as const;

/** Crossmint docs the homepage points builders at. */
export const CROSSMINT_DOCS = {
  home: "https://docs.crossmint.com",
  agents: "https://docs.crossmint.com/agents/overview",
  checkouts: "https://docs.crossmint.com/agents/agent-checkouts-quickstart",
  cards:
    "https://docs.crossmint.com/agents/payment-methods/cards/create-agent-card",
} as const;

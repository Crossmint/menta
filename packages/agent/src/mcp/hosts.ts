import { createHash } from "node:crypto";
import type { Client } from "stytch";
import { z } from "zod";

/**
 * The MCP Apps host behind a request, when we can tell. It decides the card's
 * sandbox origin (`ui.domain`, whose format is host-specific) and whether the
 * app-only tools (secure step, plugin settings) are offered: only to hosts
 * that keep app-only tools away from their model.
 *
 * - `claude`, `chatgpt`: told apart by the OAuth client the access token was
 *   issued to. A Dynamic Client Registration client by its registered
 *   redirect URLs (verified by Stytch). A client ID metadata document (CIMD)
 *   client, whose ID is an https URL, by that URL's host and the document's
 *   redirect URLs, which must agree.
 * - `local`: a loopback dev session (MCP Apps reference host, fixtures).
 * - null: anything else (Codex, Claude Code, Grok, unknown). No app-only tools.
 */
export type AppHost = "claude" | "chatgpt" | "local";

const hostSuffixes: readonly [AppHost, readonly string[]][] = [
  ["claude", ["claude.ai", "claude.com"]],
  ["chatgpt", ["chatgpt.com", "openai.com"]],
];

function within(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** The host an https URL's hostname belongs to; null for anything else. */
function hostOfUrl(value: string): AppHost | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }
    for (const [host, domains] of hostSuffixes) {
      if (domains.some((domain) => within(url.hostname, domain))) {
        return host;
      }
    }
  } catch {
    // Not a URL.
  }
  return null;
}

/** Classifies a client by its registered redirect URLs; null when unclear. */
export function hostFromRedirectUrls(urls: readonly string[]): AppHost | null {
  const found = new Set<AppHost>();
  for (const value of urls) {
    const host = hostOfUrl(value);
    if (host) {
      found.add(host);
    }
  }
  return found.size === 1 ? ([...found][0] ?? null) : null;
}

/**
 * Whether a client signs in through Cursor's hosted agents (Grok Bot runs
 * there): one of its redirect URLs is on www.cursor.com under /agents/ (Grok
 * Bot also registers a localhost callback). Cursor's editor uses its own
 * cursor:// callback, so a client with one is never counted.
 */
export function isCursorAgentRedirects(urls: readonly string[]): boolean {
  const parsed = urls.map((value) => {
    try {
      return new URL(value);
    } catch {
      return null;
    }
  });
  return (
    parsed.some(
      (url) =>
        url?.protocol === "https:" &&
        url.hostname === "www.cursor.com" &&
        url.pathname.startsWith("/agents/"),
    ) && !parsed.some((url) => url?.protocol === "cursor:")
  );
}

/**
 * Whether an OAuth client ID is a client ID metadata document URL (CIMD,
 * draft-ietf-oauth-client-id-metadata-document): https with a path. ChatGPT
 * uses `https://chatgpt.com/oauth/client.json`; Claude Code
 * `https://claude.ai/oauth/claude-code-client-metadata`.
 */
export function isClientIdUrl(clientId: string) {
  try {
    const url = new URL(clientId);
    return url.protocol === "https:" && url.pathname.length > 1;
  } catch {
    return false;
  }
}

export interface ClientFacts {
  /** The client ID the access token was issued to. */
  readonly clientId: string;
  /** Its metadata document URL, when Stytch registered it through CIMD under another ID. */
  readonly metadataUrl?: string | null;
  /** Redirect URLs the client is allowed: Stytch's record, else the metadata document's. */
  readonly redirectUrls: readonly string[];
}

/**
 * The host for an OAuth client. DCR clients: their redirect URLs. CIMD
 * clients: the metadata URL's host must be ChatGPT's or Claude's and agree
 * with the redirect URLs, so a document on another domain that lists
 * chatgpt.com as a redirect doesn't count, and Claude Code (claude.ai
 * document, loopback redirects, no card) stays unknown.
 */
export function hostOfClient({
  clientId,
  metadataUrl = null,
  redirectUrls,
}: ClientFacts): AppHost | null {
  const byRedirect = hostFromRedirectUrls(redirectUrls);
  const document = metadataUrl || (isClientIdUrl(clientId) ? clientId : null);
  if (!document) {
    return byRedirect;
  }
  return byRedirect !== null && hostOfUrl(document) === byRedirect
    ? byRedirect
    : null;
}

const MAX_METADATA_BYTES = 64 * 1024;
const metadataDocument = z.object({
  client_id: z.string(),
  redirect_uris: z.array(z.string()).max(50),
});

/**
 * The redirect URIs a client ID metadata document lists, or null. Only
 * ChatGPT's and Claude's own documents are fetched (nothing else could
 * classify as a host, and it keeps token claims from steering our fetches);
 * no redirects, a size cap and a short timeout. The document must name itself
 * as `client_id`, as the CIMD draft requires.
 */
export async function fetchClientMetadata(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000,
): Promise<string[] | null> {
  if (!isClientIdUrl(url) || hostOfUrl(url) === null) {
    return null;
  }
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    if (text.length > MAX_METADATA_BYTES) {
      return null;
    }
    const parsed = metadataDocument.safeParse(JSON.parse(text));
    return parsed.success && parsed.data.client_id === url
      ? parsed.data.redirect_uris
      : null;
  } catch {
    return null;
  }
}

/**
 * Claude's dedicated sandbox origin for a connector: the first 32 hex
 * characters of SHA-256 over the exact connector URL. Claude refuses to render
 * the card when this doesn't match the URL the user added, so it is only sent
 * to Claude, for our canonical `{origin}/mcp`.
 */
export function claudeUiDomain(connectorUrl: string) {
  const hash = createHash("sha256")
    .update(connectorUrl)
    .digest("hex")
    .slice(0, 32);
  return `${hash}.claudemcpcontent.com`;
}

export interface HostResolverOptions {
  readonly ttlMs?: number;
  /** Fetches CIMD documents Stytch's record doesn't cover (tests pass a fake). */
  readonly fetch?: typeof fetch;
}

/**
 * Resolves (and caches) the host for a Connected Apps client ID. Stytch's
 * record comes first: it holds the redirect URLs Stytch enforces, for DCR
 * clients and (as `client_id_metadata_url`) for CIMD ones. A CIMD client
 * Stytch can't return, or returns without redirect URLs, is classified from
 * its own metadata document.
 */
export function createHostResolver(
  client: Pick<Client, "connectedApp">,
  { ttlMs = 60 * 60_000, fetch: fetchImpl = fetch }: HostResolverOptions = {},
) {
  const cache = new Map<string, { host: AppHost | null; at: number }>();
  return async function hostOf(clientId: string): Promise<AppHost | null> {
    if (!clientId) {
      return null;
    }
    const hit = cache.get(clientId);
    if (hit && Date.now() - hit.at < ttlMs) {
      return hit.host;
    }
    const cimd = isClientIdUrl(clientId);
    let record: {
      redirect_urls?: string[];
      client_id_metadata_url?: string;
    } | null = null;
    try {
      ({ connected_app: record } = await client.connectedApp.clients.get({
        client_id: clientId,
      }));
    } catch {
      if (!cimd) {
        // Unknown for now; try again on a later request.
        return null;
      }
    }
    const metadataUrl = cimd
      ? clientId
      : record?.client_id_metadata_url?.trim() || null;
    let redirectUrls = record?.redirect_urls ?? [];
    // Another assistant's document (Cursor, VS Code…) can't name a host: no fetch.
    if (metadataUrl && redirectUrls.length === 0 && hostOfUrl(metadataUrl)) {
      const listed = await fetchClientMetadata(metadataUrl, fetchImpl);
      if (!listed) {
        return null;
      }
      redirectUrls = listed;
    }
    const host = hostOfClient({ clientId, metadataUrl, redirectUrls });
    if (cache.size > 1000) {
      cache.clear();
    }
    cache.set(clientId, { host, at: Date.now() });
    return host;
  };
}

/**
 * Whether a Connected Apps client signs in through Cursor's hosted agents
 * (Grok Bot), from the redirect URLs Stytch enforces for it; cached per
 * client. A lookup that fails is "no" for now and asked again next time.
 */
export function createCursorAgentResolver(
  client: Pick<Client, "connectedApp">,
  { ttlMs = 60 * 60_000 }: { ttlMs?: number } = {},
) {
  const cache = new Map<string, { agent: boolean; at: number }>();
  return async function isCursorAgent(clientId: string): Promise<boolean> {
    if (!clientId || isClientIdUrl(clientId)) {
      return false;
    }
    const hit = cache.get(clientId);
    if (hit && Date.now() - hit.at < ttlMs) {
      return hit.agent;
    }
    let urls: readonly string[];
    try {
      const { connected_app: record } = await client.connectedApp.clients.get({
        client_id: clientId,
      });
      urls =
        (record as { redirect_urls?: string[] } | null)?.redirect_urls ?? [];
    } catch {
      return false;
    }
    const agent = isCursorAgentRedirects(urls);
    if (cache.size > 1000) {
      cache.clear();
    }
    cache.set(clientId, { agent, at: Date.now() });
    return agent;
  };
}

/**
 * The name a Connected Apps client registered with Stytch ("Cursor",
 * "Codex"), cached per client; null when it has none or the lookup fails.
 */
export function createClientNameResolver(
  client: Pick<Client, "connectedApp">,
  { ttlMs = 60 * 60_000 }: { ttlMs?: number } = {},
) {
  const cache = new Map<string, { name: string | null; at: number }>();
  return async function nameOf(clientId: string): Promise<string | null> {
    if (!clientId || isClientIdUrl(clientId)) {
      return null;
    }
    const hit = cache.get(clientId);
    if (hit && Date.now() - hit.at < ttlMs) {
      return hit.name;
    }
    let name: string | null;
    try {
      const { connected_app: record } = await client.connectedApp.clients.get({
        client_id: clientId,
      });
      name = record?.client_name?.trim() || null;
    } catch {
      return null;
    }
    if (cache.size > 1000) {
      cache.clear();
    }
    cache.set(clientId, { name, at: Date.now() });
    return name;
  };
}

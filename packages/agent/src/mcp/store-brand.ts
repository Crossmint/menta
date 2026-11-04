import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { publicOnlyLookup } from "./webhooks.js";

/**
 * A store's name and app icon, read from its own site, for the checkout card:
 * "puravidamiami.com" becomes "Pura Vida Miami" with its iPhone icon. Our
 * server reads the site (public HTTPS only, a few redirects, small bodies,
 * short deadlines) and serves the result from our origin, which the card's
 * CSP already allows. Stores can't put anything else in front of the user:
 * a name is plain text, and an icon is served as an image no page can script.
 */

export interface StoreBrand {
  /** The store's own name for itself, or null when its site doesn't say. */
  readonly name: string | null;
  readonly icon: { readonly type: string; readonly bytes: Buffer } | null;
}

export interface Fetched {
  readonly status: number;
  readonly type: string;
  readonly body: Buffer;
  /** Where it ended up after redirects. */
  readonly url: URL;
  /** Cut off at the size limit. */
  readonly partial?: boolean;
}

/** Fetches one public HTTPS URL; injected in tests. */
export type StoreFetch = (url: URL, maxBytes: number) => Promise<Fetched>;

const PAGE_BYTES = 768 * 1024;
const ICON_BYTES = 512 * 1024;
const TIMEOUT_MS = 4_000;
const REDIRECTS = 3;

/** The site a store lives at ("www.Amazon.com" → "amazon.com"), or null. */
export function siteOf(value: string): string | null {
  const raw = value.trim().toLowerCase();
  let host: string;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  return host.length <= 253 &&
    /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) &&
    !isIP(host) &&
    !/\.(local|localhost|internal|lan|home|corp|test|invalid)$/.test(host)
    ? host
    : null;
}

/** GET over node:https with the public-only resolver; follows a few same-scheme redirects. */
export const publicGet: StoreFetch = async (start, maxBytes) => {
  let url = start;
  for (let hop = 0; hop <= REDIRECTS; hop++) {
    const response = await once(url, maxBytes);
    const location = response.location;
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, url);
      if (next.protocol !== "https:" || (next.port && next.port !== "443")) {
        throw new Error("redirect off HTTPS");
      }
      url = next;
      continue;
    }
    return { ...response, url };
  }
  throw new Error("too many redirects");
};

function once(
  url: URL,
  maxBytes: number,
): Promise<Omit<Fetched, "url"> & { location: string | null }> {
  let settled = false;
  return new Promise((resolve, reject) => {
    const host = url.hostname;
    if (url.protocol !== "https:" || isIP(host) || !siteOf(host)) {
      reject(new Error("not a public https host"));
      return;
    }
    const outgoing = httpsRequest(
      {
        host,
        servername: host,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent: false,
        lookup: publicOnlyLookup,
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; MentaStoreIcons/1.0; +https://menta.crossmint.com)",
          accept: "text/html,application/xhtml+xml,image/*,*/*;q=0.5",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let partial = false;
        response.on("data", (chunk: Buffer) => {
          if (partial) {
            return;
          }
          size += chunk.length;
          if (size > maxBytes) {
            partial = true;
            response.destroy();
            return;
          }
          chunks.push(chunk);
        });
        const done = () => {
          clearTimeout(deadline);
          if (settled) {
            return;
          }
          settled = true;
          const location = response.headers.location;
          resolve({
            partial,
            status: response.statusCode ?? 0,
            type:
              String(response.headers["content-type"] ?? "")
                .split(";")[0]
                ?.trim()
                .toLowerCase() ?? "",
            body: Buffer.concat(chunks),
            location: typeof location === "string" ? location : null,
          });
        };
        response.on("end", done);
        response.on("close", done);
        response.on("error", (error) => {
          clearTimeout(deadline);
          reject(error);
        });
      },
    );
    const deadline = setTimeout(() => {
      outgoing.destroy(new Error("timeout"));
    }, TIMEOUT_MS);
    outgoing.on("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    outgoing.end();
  });
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

function decode(value: string) {
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, code: string) => {
      const lower = code.toLowerCase();
      if (lower in entities) {
        return entities[lower] ?? whole;
      }
      if (lower.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      }
      if (lower.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
      }
      return whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** The attributes of each tag of one name in a page's head. */
function tags(html: string, name: "meta" | "link") {
  const head = html.slice(0, PAGE_BYTES).split(/<\/head>/i)[0] ?? "";
  return [...head.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map(
    (match) => {
      const attributes: Record<string, string> = {};
      for (const pair of (match[1] ?? "").matchAll(
        /([a-z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi,
      )) {
        const key = pair[1]?.toLowerCase();
        if (key) {
          attributes[key] = decode(pair[3] ?? pair[4] ?? pair[5] ?? "");
        }
      }
      return attributes;
    },
  );
}

/** A store name fit for a card: short plain text, no URL. */
function cleanName(value: string | null | undefined): string | null {
  const text = decode(value ?? "")
    .replace(/\p{Cc}|[<>]/gu, "")
    .trim();
  if (!text || text.length > 40 || /https?:|\.[a-z]{2,}\//i.test(text)) {
    return null;
  }
  // "PURA VIDA MIAMI" → "Pura Vida Miami"; "IKEA" and "sweetgreen" stay as they are.
  return /\p{Ll}/u.test(text) || text.replace(/[^\p{L}]/gu, "").length <= 4
    ? text
    : text
        .toLowerCase()
        .replace(
          /(^|[\s'-])(\p{L})/gu,
          (_, gap: string, letter: string) => gap + letter.toUpperCase(),
        );
}

/** "Pura Vida | Healthy Cafe" → "Pura Vida". */
function titleName(html: string) {
  const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1];
  const first = decode(title ?? "").split(/\s[|–—·:-]\s/)[0];
  return cleanName(first);
}

interface Candidate {
  readonly url: URL;
  /** Bigger is better; SVG counts as large. */
  readonly size: number;
}

function sizeOf(
  sizes: string | undefined,
  type: string | undefined,
  href: string,
) {
  if (/svg/.test(type ?? "") || /\.svg(\?|$)/i.test(href)) {
    return 512;
  }
  if (sizes === "any") {
    return 512;
  }
  const sides = (sizes ?? "")
    .split(/\s+/)
    .map((entry) => Number.parseInt(entry.split("x")[0] ?? "", 10))
    .filter((value) => Number.isFinite(value));
  return sides.length ? Math.max(...sides) : 0;
}

function resolveUrl(href: string | undefined, base: URL): URL | null {
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href, base);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function sniffType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.subarray(0, 3).toString() === "GIF") {
    return "image/gif";
  }
  if (bytes.readUInt32BE(0) === 0x00000100) {
    return "image/x-icon";
  }
  const start = bytes.subarray(0, 512).toString("utf8").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(start)) {
    return "image/svg+xml";
  }
  // Whatever the site says it is: only bytes that are an image get served.
  return null;
}

/**
 * Reads a store's name and best square icon from its site: the web-app
 * manifest, the iPhone icon, the page's icons, then `/favicon.ico`. Never
 * throws: a site that doesn't answer gives `{ name: null, icon: null }`.
 */
export async function lookupStoreBrand(
  site: string,
  fetch: StoreFetch = publicGet,
): Promise<StoreBrand> {
  const home = new URL(`https://${site}/`);
  let page: Fetched | null = null;
  try {
    page = await fetch(home, PAGE_BYTES);
  } catch {
    try {
      page = await fetch(new URL(`https://www.${site}/`), PAGE_BYTES);
    } catch {
      page = null;
    }
  }
  const base = page?.url ?? home;
  const html =
    page && page.status < 400 && /html/.test(page.type)
      ? page.body.toString("utf8")
      : "";
  const metas = tags(html, "meta");
  const links = tags(html, "link");
  const meta = (key: string) =>
    metas.find(
      (attributes) =>
        attributes.property?.toLowerCase() === key ||
        attributes.name?.toLowerCase() === key,
    )?.content;

  const candidates: Candidate[] = [];
  let manifestName: string | null = null;
  const manifestUrl = resolveUrl(
    links.find((attributes) =>
      (attributes.rel ?? "").toLowerCase().split(/\s+/).includes("manifest"),
    )?.href,
    base,
  );
  if (manifestUrl) {
    try {
      const manifest = await fetch(manifestUrl, 64 * 1024);
      const data = JSON.parse(manifest.body.toString("utf8")) as {
        name?: unknown;
        short_name?: unknown;
        icons?: unknown;
      };
      manifestName =
        cleanName(
          typeof data.short_name === "string" ? data.short_name : null,
        ) ?? cleanName(typeof data.name === "string" ? data.name : null);
      for (const icon of Array.isArray(data.icons) ? data.icons : []) {
        const entry = icon as {
          src?: unknown;
          sizes?: unknown;
          type?: unknown;
          purpose?: unknown;
        };
        const src = typeof entry.src === "string" ? entry.src : undefined;
        const url = resolveUrl(src, manifest.url);
        // A maskable-only icon is cropped for launchers, not shown whole.
        if (
          url &&
          String(entry.purpose ?? "any")
            .split(/\s+/)
            .includes("any")
        ) {
          candidates.push({
            url,
            size: sizeOf(
              typeof entry.sizes === "string" ? entry.sizes : undefined,
              typeof entry.type === "string" ? entry.type : undefined,
              src ?? "",
            ),
          });
        }
      }
    } catch {
      // No manifest: the page's own icons follow.
    }
  }
  for (const attributes of links) {
    const rel = (attributes.rel ?? "").toLowerCase().split(/\s+/);
    const url = resolveUrl(attributes.href, base);
    if (!url) {
      continue;
    }
    if (
      rel.includes("apple-touch-icon") ||
      rel.includes("apple-touch-icon-precomposed")
    ) {
      candidates.push({
        url,
        size: Math.max(
          sizeOf(attributes.sizes, attributes.type, attributes.href ?? ""),
          180,
        ),
      });
    } else if (rel.includes("icon")) {
      candidates.push({
        url,
        size:
          sizeOf(attributes.sizes, attributes.type, attributes.href ?? "") ||
          32,
      });
    }
  }
  candidates.push({ url: new URL("/apple-touch-icon.png", base), size: 179 });
  candidates.push({ url: new URL("/favicon.ico", base), size: 16 });

  const tried = new Set<string>();
  let icon: StoreBrand["icon"] = null;
  for (const candidate of [...candidates].sort((a, b) => b.size - a.size)) {
    if (tried.has(candidate.url.href) || tried.size >= 5) {
      continue;
    }
    tried.add(candidate.url.href);
    try {
      const got = await fetch(candidate.url, ICON_BYTES);
      const type =
        got.status < 300 && got.body.length > 0 && !got.partial
          ? sniffType(got.body)
          : null;
      if (type) {
        icon = { type, bytes: got.body };
        break;
      }
    } catch {
      // The next candidate.
    }
  }

  return {
    name:
      cleanName(meta("og:site_name")) ??
      manifestName ??
      cleanName(meta("application-name")) ??
      cleanName(meta("apple-mobile-web-app-title")) ??
      titleName(html),
    icon,
  };
}

const nothing: StoreBrand = { name: null, icon: null };

/**
 * Lookups by site, kept for a day per instance (the CDN caches the responses
 * too). A lookup gets `budgetMs` in all; a slow or silent site is nothing for
 * now and is asked again after `retryMs`. The routes are public, so at most
 * `concurrent` sites are read at once; past that a site is nothing for now,
 * not kept, until a lookup finishes.
 */
export function createStoreBrands({
  fetch = publicGet,
  ttlMs = 24 * 60 * 60_000,
  retryMs = 10 * 60_000,
  budgetMs = 7_000,
  max = 500,
  concurrent = 8,
}: {
  fetch?: StoreFetch;
  ttlMs?: number;
  retryMs?: number;
  budgetMs?: number;
  max?: number;
  concurrent?: number;
} = {}) {
  const cache = new Map<
    string,
    { at: number; ttl: number; brand: Promise<StoreBrand> }
  >();
  let reading = 0;
  return (site: string): Promise<StoreBrand> => {
    const now = Date.now();
    const kept = cache.get(site);
    if (kept && now - kept.at < kept.ttl) {
      return kept.brand;
    }
    if (reading >= concurrent) {
      return Promise.resolve(nothing);
    }
    if (cache.size >= max) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }
    const entry = { at: now, ttl: ttlMs, brand: Promise.resolve(nothing) };
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A lookup past its budget still counts until its own reads end.
    reading++;
    const lookup = lookupStoreBrand(site, fetch).finally(() => {
      reading--;
    });
    entry.brand = Promise.race([
      lookup,
      new Promise<StoreBrand>((resolve) => {
        timer = setTimeout(() => resolve(nothing), budgetMs);
      }),
    ]).then((brand) => {
      clearTimeout(timer);
      if (!brand.name && !brand.icon) {
        entry.ttl = retryMs;
      }
      return brand;
    });
    cache.set(site, entry);
    return entry.brand;
  };
}

let shared: ReturnType<typeof createStoreBrands> | null = null;
/** The app's store lookups (one cache per instance). */
export function getStoreBrands() {
  shared ??= createStoreBrands();
  return shared;
}

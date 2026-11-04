import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { localeTag } from "../ui/i18n/index.js";
import {
  checkoutCardFonts,
  checkoutCardSecureScript,
  checkoutCardSecureVersion,
  checkoutCardTemplate,
  checkoutCardVersion,
} from "./card.generated.js";
import { type AppHost, claudeUiDomain } from "./hosts.js";

/**
 * The MCP Apps view (SEP-1865) hosts render for our checkout tools. Hosts
 * cache a view by its URI, so the URI changes with the card's content.
 */
export const CHECKOUT_CARD_URI = `ui://oca/checkout-${checkoutCardVersion}`;
export const CHECKOUT_CARD_MIME_TYPE = RESOURCE_MIME_TYPE;
/** Tool-result `_meta` key: when the server read the checkout (ms). Newer cards for a run win. */
export const OBSERVED_AT = "oca/observedAt";
/**
 * Tool-result `_meta` key: what the card shows, `step` (the store waits on
 * the user) or `start` (the checkout's status). The card pins itself to it.
 */
export const CARD_STEP = "oca/step";
/** Tool-result `_meta` flag: the card may run the secure step itself (app-only tools exist). */
export const SECURE_STEP = "oca/secureStep";
/**
 * Tool-result `_meta` key: the checkout's progress (its newest steps) for the
 * card. Never model content.
 */
export const PROGRESS = "oca/progress";
/**
 * Tool-result `_meta` key: the language the card writes its own text in. In
 * show_checkout_step's result it is the language the assistant said it writes
 * to the user in (its `language` argument), else the one the host sent with
 * the request (ChatGPT's `_meta["openai/locale"]`); other card results carry
 * only the host's. It only picks UI text: never who the user is, what's paid,
 * or any security decision.
 */
export const LOCALE = "oca/locale";
/** Tool-result `_meta` key: where `oca/locale` came from, `assistant` or `host`. */
export const LOCALE_SOURCE = "oca/localeSource";

/** The language a host sent with a tool call (request `_meta`), as a short BCP 47 tag, or null. */
export function requestLocale(meta: unknown): string | null {
  return meta && typeof meta === "object"
    ? localeTag((meta as Record<string, unknown>)["openai/locale"])
    : null;
}

/**
 * A card result's `_meta` entries for its language: the assistant's
 * `language` argument when it is a valid tag, else the request's; empty
 * without either. Anything that isn't a short BCP 47 tag is dropped.
 */
export function localeMeta(
  requestMeta: unknown,
  language?: unknown,
): Record<string, string> {
  const spoken = localeTag(language);
  if (spoken) {
    return { [LOCALE]: spoken, [LOCALE_SOURCE]: "assistant" };
  }
  const host = requestLocale(requestMeta);
  return host ? { [LOCALE]: host, [LOCALE_SOURCE]: "host" } : {};
}

/** App-only tool-result `_meta` key carrying the card's Crossmint credentials. */
export const CARD_CREDENTIALS = "oca/credentials";
/**
 * card_checkout's `_meta` flag, when the card asks about the payment it
 * showed (`paidFor`): whether a spending limit paid it, read from the run's
 * messages on Crossmint.
 */
export const CARD_PAID = "oca/paid";
/**
 * Why a card can't follow its checkout, as it reports it to card_diagnostics
 * (the same list as card/model.ts `DIAGNOSTIC_REASONS`).
 */
export const CARD_DIAGNOSTIC_REASONS = [
  "no-server-tools",
  "initialize-failed",
  "tools-unadvertised",
  "stalled-frozen",
  "stalled-paused",
  "stalled-hidden",
  "stalled-unknown",
  "frame-kept-height",
] as const;
/** Display modes the card supports; hosts pick from these (ChatGPT has no pip). */
export const CARD_DISPLAY_MODES = ["inline", "fullscreen"] as const;
/** Where the card loads Crossmint's components from, on our origin. */
export const CHECKOUT_CARD_SECURE_PATH = "/mcp/card/secure.js";
/** Where the card loads its fonts (Geist) from, on our origin: `${path}/<file>`. */
export const CHECKOUT_CARD_FONTS_PATH = "/mcp/card/fonts";
export {
  checkoutCardFonts,
  checkoutCardSecureScript,
  checkoutCardSecureVersion,
};

/** What the card shows, for the host's model (`openai/widgetDescription`) and resource listings. */
export const CHECKOUT_CARD_DESCRIPTION =
  "Shows the step a checkout is at when the user is needed: a store question to answer; a payment none of the user's spending limits covers, with the link to approve one; private details to enter; or the receipt once an order is placed. The user acts there. Keep replies to one short sentence and don't repeat what the card shows.";

/**
 * Origins the secure step needs: Crossmint's components (protected-input
 * iframes and API) and Basis Theory's (API and iframe).
 */
export function secureStepDomains(crossmintOrigin: string) {
  return {
    connectDomains: [crossmintOrigin, "https://api.basistheory.com"],
    frameDomains: [crossmintOrigin, "https://*.basistheory.com"],
  };
}

function attribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * The card document, bound to our origin: its only outbound links go to
 * `{origin}/checkouts/…`, and a payment's to `{origin}/spending-limit/…`.
 */
export function checkoutCardHtml(origin: string) {
  return checkoutCardTemplate.replace("__OCA_ORIGIN__", attribute(origin));
}

export interface CardResourceOptions {
  /** The host behind this request, when known; sets the sandbox origin. */
  readonly host?: AppHost | null;
  /** Crossmint's origin when the secure step can run in the card. */
  readonly crossmintOrigin?: string | null;
}

/**
 * Resource metadata. The card loads its fonts (Geist) from our origin, so
 * that is always a resource domain; otherwise, without the secure step, it
 * talks only to the host. With it, the card loads Crossmint's components
 * from our origin and frames Crossmint; a host that blocks any of that gets
 * the secure-page link instead (the card detects it at runtime).
 *
 * `ui.domain` is host-specific, and Claude refuses to render a card whose
 * value doesn't match its own format, so it is set only for Claude (a stable
 * origin Crossmint's client key can allow). ChatGPT derives its stable origin
 * from `openai/widgetDomain`.
 */
export function checkoutCardResourceMeta(
  origin: string,
  { host = null, crossmintOrigin = null }: CardResourceOptions = {},
) {
  const secure = crossmintOrigin ? secureStepDomains(crossmintOrigin) : null;
  // Our own origin: the card asks it for a store's name (/mcp/card/store/…).
  const connectDomains = [origin, ...(secure?.connectDomains ?? [])];
  const resourceDomains = [origin];
  const frameDomains = secure?.frameDomains ?? [];
  return {
    ui: {
      csp: { connectDomains, resourceDomains, frameDomains },
      ...(host === "claude" ? { domain: claudeUiDomain(`${origin}/mcp`) } : {}),
      prefersBorder: true,
    },
    "openai/widgetCSP": {
      connect_domains: connectDomains,
      resource_domains: resourceDomains,
      frame_domains: frameDomains,
      redirect_domains: [origin],
    },
    "openai/widgetDomain": origin,
    "openai/widgetPrefersBorder": true,
    "openai/widgetDescription": CHECKOUT_CARD_DESCRIPTION,
    // Lets ChatGPT choose a mode before loading the card. It has no pip.
    // Inline first: each step belongs in the conversation, not the side
    // panel (which ChatGPT picked once fullscreen was listed). Expand still
    // asks for fullscreen.
    "openai/ui": {
      availableDisplayModes: [...CARD_DISPLAY_MODES],
      preferredDisplayMode: "inline",
    },
  };
}

/** ChatGPT's short status lines while a tool runs and once it's done. */
export function toolStatusMeta(invoking: string, invoked: string) {
  return {
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  };
}

/** Tool metadata linking a checkout tool's result to the card, which may call it too. */
export function checkoutCardToolMeta(invoking: string, invoked: string) {
  return {
    ui: { resourceUri: CHECKOUT_CARD_URI },
    "openai/outputTemplate": CHECKOUT_CARD_URI,
    "openai/widgetAccessible": true,
    ...toolStatusMeta(invoking, invoked),
  };
}

/** Tool metadata for tools only the card may call: hosts hide them from the model. */
export const appOnlyToolMeta = {
  ui: { visibility: ["app"] },
  "openai/visibility": "private",
  "openai/widgetAccessible": true,
} as const;

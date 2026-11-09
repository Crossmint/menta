import { createCrossmintSdk } from "@crossmint/rest-js";
import {
  type Checkouts,
  createCheckouts,
} from "@oca/crossmint-agent-checkouts/checkouts";
import type { SessionAuthContext } from "eve/context";
import { createNeonAddressDefaults } from "./address-defaults.js";
import { createLimitPayments, type LimitPayments } from "./limit-payments.js";

export {
  type LimitChoice,
  type LimitPayments,
  paymentMessageId,
} from "./limit-payments.js";
export {
  type LimitRequest,
  limitRequest,
  limitRequestKey,
  openLimitRequest,
  sealLimitRequest,
} from "./limit-requests.js";

import { requireEnv, webOrigin } from "./env.js";
import { cardCredentialsFromEnv } from "./mcp/secure.js";

export {
  type AgentUse,
  type AgentUseRecord,
  getAgentUse,
} from "./agent-use.js";
export { type CardNames, getCardNames } from "./card-names.js";
export {
  type CardSetup,
  type CardSetups,
  getCardSetups,
} from "./card-rails.js";
export {
  type PreparedCards,
  prepareCardsForOrderIntents,
  removeCard,
  type SavedCard,
  setDefaultCard,
} from "./cards.js";
export {
  attributedCheckouts,
  type CheckoutAgents,
  getCheckoutAgents,
} from "./checkout-agents.js";
export {
  cancelOrderIntent,
  listOrderIntents,
  type OrderIntentView,
} from "./order-intents.js";

/** Agent Checkouts is production-only today; cards and staging UC can follow `CROSSMINT_ENV`. */
export function crossmintEnvironment(): "production" | "staging" {
  return process.env.CROSSMINT_ENV === "staging" ? "staging" : "production";
}

/** A Crossmint API key for this environment. */
export function crossmintKey(kind: "SERVER" | "CLIENT") {
  return requireEnv(
    `CROSSMINT_${crossmintEnvironment().toUpperCase()}_${kind}_API_KEY`,
  );
}

/** The Crossmint user a verified session acts for: the same subject the browser JWT carries. */
export function crossmintUserId(auth: SessionAuthContext | null | undefined) {
  if (auth?.authenticator !== "stytch" || !auth.subject) {
    return null;
  }
  return auth.subject;
}

export function checkoutUrl(runId: string) {
  return `${webOrigin()}/checkouts/${encodeURIComponent(runId)}`;
}

let addressDefaults: ReturnType<typeof createNeonAddressDefaults> | undefined;
/** Created on first use, so DATABASE_URL is read only when addresses are. */
function defaults() {
  addressDefaults ??= createNeonAddressDefaults(requireEnv("DATABASE_URL"));
  return addressDefaults;
}

let checkouts: Checkouts | undefined;
/**
 * The app's checkouts: every surface reads them here (the web chat, the MCP
 * server, the dock and the secure page). Reads never pay: a payment is
 * answered only by the user's approval or by their assistant picking one of
 * their spending limits (`getLimitPayments`).
 */
export function getCheckouts() {
  checkouts ??= createCheckouts({
    api: createCrossmintSdk({
      environment: crossmintEnvironment(),
      apiKey: crossmintKey("SERVER"),
    }).agentCheckouts,
    actionUrl: checkoutUrl,
    addressDefaults: {
      get: (userId) => defaults().get(userId),
      set: (userId, id) => defaults().set(userId, id),
    },
  });
  return checkouts;
}

let limitPayments: LimitPayments | null | undefined;
/**
 * The user's spending limits for their assistant, and paying a checkout with
 * the one it picks. Null where the server can't get a Crossmint session for
 * the user (no Trusted Auth Token profile): Crossmint's order-intent API takes
 * only a client key and a user session.
 */
export function getLimitPayments() {
  if (limitPayments === undefined) {
    const origin = webOrigin();
    const mint = cardCredentialsFromEnv(origin, () => crossmintKey("CLIENT"));
    limitPayments = mint
      ? createLimitPayments({ checkouts: getCheckouts(), mint, origin })
      : null;
  }
  return limitPayments;
}

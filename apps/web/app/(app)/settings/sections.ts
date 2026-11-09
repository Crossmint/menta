/**
 * Older Settings anchors and sections, and where each lives now. Settings is
 * a list of its sections, each on its own page (`/settings/<section>`), but
 * assistants and older pages still link to `/settings#grok-bot`,
 * `/settings/payments#cards`, `#addresses` and `#add-address`.
 */
export const MOVED: Readonly<Record<string, string>> = {
  cards: "/wallet#cards",
  payments: "/settings/delivery-addresses",
  addresses: "/settings/delivery-addresses",
  "add-address": "/settings/delivery-addresses#add-address",
  assistants: "/settings/agents",
  connections: "/settings/agents",
  account: "/settings",
  "sign-ins": "/settings/store-sign-ins",
  notifications: "/settings/notifications",
  "grok-bot": "/settings/notifications#grok-bot",
};

/** Where a moved anchor or section lives now; only MOVED's own keys count. */
export function movedTo(key: string) {
  return Object.hasOwn(MOVED, key) ? MOVED[key] : undefined;
}

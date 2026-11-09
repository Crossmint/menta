import { headers } from "next/headers";
import { marketFor } from "../../(home)/markets";

/** A store from the visitor's market: the welcome's floating icons. */
export interface LocalStore {
  readonly name: string;
  readonly logo: string;
}

/** One of the homepage's asks at a store where the visitor is: the ideas banner's. */
export interface Idea {
  readonly key: "cart" | "dinner" | "table" | "tickets" | "dogFood" | "usual";
  readonly store: string;
  readonly logo: string;
}

/** Streaming subscriptions: not things the agent buys, so Home leaves them out. */
const SUBSCRIPTIONS = new Set(["spotify", "netflix", "youtube"]);

/** The visitor's market (by country, as on the homepage): its stores and asks for Home. */
export async function homeMarket() {
  const market = marketFor((await headers()).get("x-vercel-ip-country"));
  const stores: LocalStore[] = market.featured
    .filter(({ id }) => !SUBSCRIPTIONS.has(id))
    .map(({ name, logo }) => ({ name, logo }));
  const ideas: Idea[] = (
    [
      ["cart", market.roles.grocery],
      ["dinner", market.roles.delivery],
      ["table", market.roles.tables],
      ["tickets", market.roles.tickets],
      ["dogFood", market.roles.marketplace],
      ["usual", market.roles.restaurant],
    ] as const
  ).map(([key, store]) => ({ key, store: store.name, logo: store.logo }));
  return { stores, ideas };
}

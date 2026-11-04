import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getI18n } from "../../../lib/i18n/server";
import { origin } from "../../../lib/server/user";
import { marketFor } from "../../(home)/markets";
import { Activity } from "./activity";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.nav.transactions };
}

/**
 * Every purchase. Before the first one the empty table shows faded rows at
 * the visitor's own stores (the homepage hero's, by country) and what to do.
 */
export default async function ActivityPage() {
  // The setup prompt's server address depends on runtime configuration, not the build.
  await connection();
  const market = marketFor((await headers()).get("x-vercel-ip-country"));
  const stores = market.featured.slice(0, 3).map(({ logo }) => logo);
  return <Activity serverUrl={`${origin()}/mcp`} examples={stores} />;
}

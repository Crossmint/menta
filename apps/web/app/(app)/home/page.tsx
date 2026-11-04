import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getI18n } from "../../../lib/i18n/server";
import { origin } from "../../../lib/server/user";
import { marketFor } from "../../(home)/markets";
import { limitCurrencies } from "../wallet/currencies";
import { Home } from "./home";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.home.title };
}

/** Where the app opens: phones' menu, or from `md` up the overview. */
export default async function HomePage() {
  // The setup prompt's server address depends on runtime configuration, not the build.
  await connection();
  const stores = marketFor(
    (await headers()).get("x-vercel-ip-country"),
  ).featured.map(({ name, logo }) => ({ name, logo }));
  return (
    <Home
      serverUrl={`${origin()}/mcp`}
      stores={stores}
      {...(await limitCurrencies())}
    />
  );
}

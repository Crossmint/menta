import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getI18n } from "../../../../lib/i18n/server";
import { origin } from "../../../../lib/server/user";
import { marketFor } from "../../../(home)/markets";
import { limitCurrencies } from "../../wallet/currencies";
import { Overview } from "../home";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.home.title };
}

/** Phones' Home row: the overview on its own page, back to the menu. */
export default async function OverviewPage() {
  await connection();
  const stores = marketFor(
    (await headers()).get("x-vercel-ip-country"),
  ).featured.map(({ name, logo }) => ({ name, logo }));
  return (
    <Overview
      serverUrl={`${origin()}/mcp`}
      stores={stores}
      {...(await limitCurrencies())}
    />
  );
}

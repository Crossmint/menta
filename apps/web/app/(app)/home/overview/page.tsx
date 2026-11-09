import type { Metadata } from "next";
import { connection } from "next/server";
import { getI18n } from "../../../../lib/i18n/server";
import { origin } from "../../../../lib/server/user";
import { limitCurrencies } from "../../wallet/currencies";
import { Overview } from "../home";
import { homeMarket } from "../market";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.home.title };
}

/** Phones' Home row: the overview on its own page, back to the menu. */
export default async function OverviewPage() {
  await connection();
  return (
    <Overview
      serverUrl={`${origin()}/mcp`}
      {...(await homeMarket())}
      {...(await limitCurrencies())}
    />
  );
}

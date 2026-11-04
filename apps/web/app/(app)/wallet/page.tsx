import type { Metadata } from "next";
import { getI18n } from "../../../lib/i18n/server";
import { limitCurrencies } from "./currencies";
import { Wallet } from "./wallet";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.nav.wallet };
}

/** Wallet. */
export default async function WalletPage() {
  return <Wallet {...(await limitCurrencies())} />;
}

import type { Metadata } from "next";
import { getI18n } from "../../../lib/i18n/server";
import { limitCurrencies } from "../wallet/currencies";
import { SpendingLimits } from "../wallet/wallet";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.wallet.approvals };
}

/** Spending limits. */
export default async function SpendingLimitsPage() {
  return <SpendingLimits {...(await limitCurrencies())} />;
}

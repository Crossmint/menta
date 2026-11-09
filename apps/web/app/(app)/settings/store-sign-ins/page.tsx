import type { Metadata } from "next";
import { getI18n } from "../../../../lib/i18n/server";
import { SubPage } from "../../page-shell";
import { StoreSignIns } from "../account";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.settings.account.storeSignIns };
}

/** The store sign-ins checkouts keep, and signing out of them. */
export default async function Page() {
  const { m } = await getI18n();
  return (
    <SubPage title={m.settings.account.storeSignIns}>
      <StoreSignIns />
    </SubPage>
  );
}

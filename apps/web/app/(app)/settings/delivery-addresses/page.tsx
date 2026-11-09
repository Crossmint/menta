import type { Metadata } from "next";
import { getI18n } from "../../../../lib/i18n/server";
import { SubPage } from "../../page-shell";
import { AddressesPage } from "./addresses";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.settingsPage.deliveryAddresses };
}

/** Where checkouts deliver: the user's saved addresses and the default. */
export default async function Page() {
  const { m } = await getI18n();
  return (
    <SubPage title={m.app.settingsPage.deliveryAddresses}>
      <AddressesPage />
    </SubPage>
  );
}

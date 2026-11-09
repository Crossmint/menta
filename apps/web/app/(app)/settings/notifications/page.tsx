import type { Metadata } from "next";
import { getI18n } from "../../../../lib/i18n/server";
import { SubPage } from "../../page-shell";
import { Notifications } from "../notifications";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.settingsPage.sections.notifications.title };
}

/** Where checkout updates go: this browser and Grok Bot. */
export default async function Page() {
  const { m } = await getI18n();
  return (
    <SubPage title={m.app.settingsPage.sections.notifications.title}>
      <Notifications />
    </SubPage>
  );
}

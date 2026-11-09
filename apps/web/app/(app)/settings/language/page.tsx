import type { Metadata } from "next";
import { getI18n } from "../../../../lib/i18n/server";
import { SubPage } from "../../page-shell";
import { Languages } from "./languages";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.settingsPage.language };
}

/** The app's language. */
export default async function Page() {
  const { m } = await getI18n();
  return (
    <SubPage title={m.app.settingsPage.language}>
      <Languages />
    </SubPage>
  );
}

import type { Metadata } from "next";
import { connection } from "next/server";
import { getI18n } from "../../../../lib/i18n/server";
import { origin } from "../../../../lib/server/user";
import { SubPage } from "../../page-shell";
import { Connections } from "./agents";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.settingsPage.agents };
}

/** The agents Menta is connected to, and how to connect one. */
export default async function Page() {
  // The setup prompt's server address depends on runtime configuration, not the build.
  await connection();
  const { m } = await getI18n();
  return (
    <SubPage title={m.app.settingsPage.agents}>
      <Connections serverUrl={`${origin()}/mcp`} />
    </SubPage>
  );
}

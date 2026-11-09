import { headers } from "next/headers";
import type { ChatExample } from "../../_components/chat";
import { NewChat } from "../../_components/new-chat";
import { marketFor } from "../../(home)/markets";

/**
 * A new chat. Its examples name stores where the visitor is (the homepage's
 * market, by country), with the homepage's own wording for each ask.
 */
export default async function NewConversation() {
  const market = marketFor((await headers()).get("x-vercel-ip-country"));
  const examples: ChatExample[] = (
    [
      ["usual", market.roles.restaurant],
      ["cart", market.roles.grocery],
      ["table", market.roles.tables],
      ["tickets", market.roles.tickets],
    ] as const
  ).map(([key, store]) => ({ key, store: store.name, logo: store.logo }));
  return <NewChat examples={examples} />;
}

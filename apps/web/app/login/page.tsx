import { headers } from "next/headers";
import { type Assistant, describeClient } from "../../lib/server/assistant";
import { stytch } from "../../lib/server/user";
import { marketFor } from "../(home)/markets";
import { Login } from "./login";

/**
 * The assistant asking to connect, when sign-in comes before the consent page,
 * as consent shows it. Null when there's no such request or we can't tell.
 */
async function connecting(
  next: string | string[] | undefined,
): Promise<Assistant | null> {
  if (typeof next !== "string" || !next.startsWith("/oauth/authorize?")) {
    return null;
  }
  const clientId = new URLSearchParams(next.slice(next.indexOf("?"))).get(
    "client_id",
  );
  if (!clientId || clientId.length > 512) {
    return null;
  }
  return describeClient(stytch(), clientId);
}

/** Sign-in, with the homepage hero's stores for the visitor's country. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const country = (await headers()).get("x-vercel-ip-country");
  const stores = marketFor(country).featured.map(({ id, logo }) => ({
    id,
    logo,
  }));
  const assistant = await connecting((await searchParams).next);
  return (
    <Login searchParams={searchParams} stores={stores} assistant={assistant} />
  );
}

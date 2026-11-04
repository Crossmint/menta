import { getSessionOwners } from "@oca/agent/web";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AccountProvider, type InitialAccount } from "../../lib/client/account";
import { currentUserFromCookies } from "../../lib/server/user";
import { Sidebar } from "../_components/sidebar";

export const dynamic = "force-dynamic";

async function loadAccount(): Promise<InitialAccount | null> {
  const user = await currentUserFromCookies();
  if (!user) {
    return null;
  }
  let conversations: InitialAccount["conversations"] = [];
  try {
    conversations = await getSessionOwners().list(user.principal);
  } catch {
    // The list refreshes from the client; an empty sidebar is still correct.
  }
  return {
    me: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
    conversations,
  };
}

/**
 * The page renders at once; the account and conversation list stream in from
 * this same request and fill the sidebar's Suspense boundary, so nothing
 * waits on them and nothing pops in from a second fetch.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Where the visitor is, from Vercel (none locally): a new phone number starts with its calling code.
  const country = (await headers()).get("x-vercel-ip-country");
  return (
    <AccountProvider initial={loadAccount()} country={country}>
      <div className="flex min-h-dvh bg-white">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </AccountProvider>
  );
}

"use client";

import { useAccount } from "../../lib/client/account";
import { Chat, type ChatExample } from "./chat";

/**
 * A new chat replaces its own URL with /c/{id} after the first message, without
 * telling the router, so "New chat" remounts it explicitly.
 */
export function NewChat({ examples }: { examples?: readonly ChatExample[] }) {
  const { newChatKey } = useAccount();
  return <Chat key={newChatKey} examples={examples} />;
}

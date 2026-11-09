import type { Metadata } from "next";
import { PRIVATE } from "../../../../lib/site";
import { Chat } from "../../../_components/chat";

export const metadata: Metadata = { title: "Chat", robots: PRIVATE };

export default async function Conversation({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <Chat key={sessionId} sessionId={sessionId} />;
}

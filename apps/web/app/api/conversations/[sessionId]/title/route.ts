import { getSessionOwners } from "@oca/agent/web";
import { generateText } from "ai";
import { z } from "zod";
import { currentUser, unauthorized } from "../../../../../lib/server/user";

const input = z.object({
  transcript: z.string().min(1).max(6000),
  current: z.string().max(120).nullable().optional(),
});

/** Name a conversation the way chat apps do: a few words about what it's for. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const { sessionId } = await params;
  const owners = getSessionOwners();
  const owner = await owners.get(sessionId);
  if (owner?.subject !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { text } = await generateText({
    model: "openai/gpt-6-luna",
    maxOutputTokens: 60,
    providerOptions: { openai: { reasoningEffort: "none" } },
    system:
      "Write a title for this shopping-assistant conversation: 2 to 5 words, sentence case, no quotes or trailing punctuation. Name what the user wants now (the item, store or task), not the assistant; later messages matter most when the user moves on to something else. Name the purchase, not a step in it: cancelling, approving, answering the store or checking status keep the title about the item. If the current title still fits, reply with it unchanged. Reply with the title only.",
    prompt: `${parsed.data.current ? `Current title: ${parsed.data.current}\n\n` : ""}${parsed.data.transcript}`,
  });
  const title = text
    .trim()
    .replace(/^["'“”]+|["'“”.]+$/g, "")
    .slice(0, 60);
  if (title) {
    await owners.rename(sessionId, user.principal, title);
  }
  return Response.json({ title });
}

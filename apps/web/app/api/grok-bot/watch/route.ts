import { getCheckouts } from "@oca/agent/crossmint";
import { getGrokBotUpdates, grokBotRearmFromEnv } from "@oca/agent/mcp";
import { after } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
/** One link of a re-armed follower: it reads until shortly before this, then hands over. */
export const maxDuration = 300;
const FOLLOW_MS = 280_000;

const body = z.object({ token: z.string().min(1).max(2000) });

/**
 * Continues a Grok Bot updates follower in a fresh invocation (only with
 * OCA_GROK_BOT_WATCH=rearm). Called by our own server with a token it signed
 * (user, checkout, chain, start, one-minute expiry), never by a browser: the
 * user in it came from a verified session or MCP token when the watch began.
 */
export async function POST(request: Request) {
  const started = Date.now();
  const updates = getGrokBotUpdates();
  if (!updates || !grokBotRearmFromEnv()) {
    return new Response(null, { status: 404 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }
  const following = updates.resume(
    parsed.data.token,
    getCheckouts(),
    started + FOLLOW_MS,
  );
  if (!following) {
    return new Response(null, { status: 403 });
  }
  after(() => following);
  return new Response(null, { status: 202 });
}

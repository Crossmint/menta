import {
  allowDictation,
  dictationGrant,
} from "../../../lib/server/transcription";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../lib/server/user";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * Starts a dictation: a short-lived secret the browser uses to stream its
 * microphone to the transcription model. Audio and transcripts never pass
 * through (or get logged by) this server.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "Forbidden" },
      { status: 403, headers: noStore },
    );
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  if (!allowDictation(user.id)) {
    return Response.json(
      { error: "Too many voice inputs. Try again in a few minutes." },
      { status: 429, headers: { ...noStore, "Retry-After": "60" } },
    );
  }
  try {
    return Response.json(await dictationGrant(), { headers: noStore });
  } catch {
    return Response.json(
      { error: "Voice input isn't available right now." },
      { status: 502, headers: noStore },
    );
  }
}

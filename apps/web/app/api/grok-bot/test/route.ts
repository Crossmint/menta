import { getGrokBotUpdates, routineStatus } from "@oca/agent/mcp";
import { testResult } from "../../../../lib/server/grok-bot";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../../lib/server/user";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** "Send a test": POSTs a test body to the user's routine (it starts a run). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const updates = getGrokBotUpdates();
  if (!updates) {
    return Response.json(
      { error: "Grok Bot updates aren't available right now." },
      { status: 503, headers: noStore },
    );
  }
  const test = testResult(await updates.sendTest(user.id));
  updates.forget(user.id);
  // The status comes along so the page shows this delivery as the last one.
  const status = await updates
    .routineOf(user.id)
    .then((routine) => ({ available: true, ...routineStatus(routine) }))
    .catch(() => null);
  return Response.json(
    { ...test, status },
    { status: test.ok ? 200 : 502, headers: noStore },
  );
}

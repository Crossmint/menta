import { getSessionOwners } from "@oca/agent/web";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../../lib/server/user";

/**
 * Delete a conversation from the user's list. Only our owner row goes: Eve
 * keeps the session's data but refuses it to everyone from now on, and any
 * Crossmint checkout it started keeps going.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const forgotten = await getSessionOwners().forget(
    (await params).sessionId,
    user.principal,
  );
  if (!forgotten) {
    return Response.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

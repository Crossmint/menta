import { cancelOrderIntent, crossmintKey } from "@oca/agent/crossmint";
import {
  currentUser,
  origin,
  sameOrigin,
  unauthorized,
} from "../../../../../lib/server/user";

export const dynamic = "force-dynamic";

/**
 * Cancels one of the signed-in user's approvals. Crossmint resolves the user
 * from their JWT, so another user's approval is simply not found.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const { id } = await params;
  if (!/^[\w-]{1,100}$/.test(id)) {
    return Response.json({ error: "Unknown approval." }, { status: 404 });
  }
  const cancelled = await cancelOrderIntent({
    apiKey: crossmintKey("CLIENT"),
    jwt: user.jwt,
    origin: origin(),
    orderIntentId: id,
  });
  return cancelled
    ? new Response(null, { status: 204 })
    : Response.json(
        { error: "Couldn't cancel this approval." },
        { status: 502 },
      );
}

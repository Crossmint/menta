import { limitRequestKey, openLimitRequest } from "@oca/agent/crossmint";
import { currentUser, unauthorized } from "../../../../lib/server/user";

export const dynamic = "force-dynamic";

/**
 * The spending limit an assistant asked for, opened from its link's sealed
 * token for the signed-in user it was made for. Anyone else, or an expired
 * or altered token, gets a 404.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const key = limitRequestKey();
  const opened = key
    ? openLimitRequest(key, user.id, (await params).token)
    : null;
  if (!opened) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json(opened, { headers: { "Cache-Control": "no-store" } });
}

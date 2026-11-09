import { getSessionOwners } from "@oca/agent/web";
import { currentUser, unauthorized } from "../../../lib/server/user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const conversations = await getSessionOwners().list(user.principal);
  return Response.json(
    { conversations },
    { headers: { "Cache-Control": "no-store" } },
  );
}

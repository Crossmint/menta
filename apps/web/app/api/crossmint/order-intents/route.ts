import { crossmintKey, listOrderIntents } from "@oca/agent/crossmint";
import { currentUser, origin, unauthorized } from "../../../../lib/server/user";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's approvals (Crossmint order intents) for Wallet: store,
 * amounts, status and expiry only. `orderIntents` is null when Crossmint
 * couldn't list them.
 */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const orderIntents = await listOrderIntents({
    apiKey: crossmintKey("CLIENT"),
    jwt: user.jwt,
    origin: origin(),
  });
  return Response.json(
    { orderIntents },
    { headers: { "Cache-Control": "no-store" } },
  );
}

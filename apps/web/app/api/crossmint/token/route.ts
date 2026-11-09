import { crossmintEnvironment, crossmintKey } from "@oca/agent/crossmint";
import { currentUser, unauthorized } from "../../../../lib/server/user";

export const dynamic = "force-dynamic";

/** Client key plus the user's short-lived JWT for Crossmint's components. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  return Response.json(
    {
      apiKey: crossmintKey("CLIENT"),
      environment: crossmintEnvironment(),
      jwt: user.jwt,
      // Crossmint needs the buyer's email to enroll a card for agent payments.
      email: user.email,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

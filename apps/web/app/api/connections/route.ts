import { currentUser, stytch, unauthorized } from "../../../lib/server/user";

export const dynamic = "force-dynamic";

/** Assistants the user has allowed through Stytch Connected Apps. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  try {
    const { connected_apps } = await stytch().users.connectedApps({
      user_id: user.id,
    });
    return Response.json(
      {
        connections: connected_apps.map((app) => ({
          id: app.connected_app_id,
          name: app.name,
          logoUrl: app.logo_url?.startsWith("https://") ? app.logo_url : null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Couldn't load connected assistants." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

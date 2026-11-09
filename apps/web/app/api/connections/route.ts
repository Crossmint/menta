import { getAgentUse } from "@oca/agent/crossmint";
import { currentUser, stytch, unauthorized } from "../../../lib/server/user";

export const dynamic = "force-dynamic";

/**
 * Assistants the user has allowed through Stytch Connected Apps, with when
 * each last used Menta and what it calls itself (`agent_use`), most recently
 * used first. A failed read of uses still lists the assistants.
 */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  try {
    const [{ connected_apps }, uses] = await Promise.all([
      stytch().users.connectedApps({ user_id: user.id }),
      (getAgentUse()?.of(user.id) ?? Promise.resolve(null)).catch(() => null),
    ]);
    const connections = connected_apps.map((app) => {
      const use = uses?.get(app.connected_app_id);
      return {
        id: app.connected_app_id,
        name: app.name,
        logoUrl: app.logo_url?.startsWith("https://") ? app.logo_url : null,
        lastUsedAt: use?.lastUsedAt ?? null,
        client: use?.name
          ? [use.name, use.version].filter(Boolean).join(" ")
          : null,
      };
    });
    connections.sort((a, b) =>
      (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""),
    );
    return Response.json(
      { connections },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Couldn't load connected assistants." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

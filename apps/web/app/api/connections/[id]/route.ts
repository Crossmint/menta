import {
  currentUser,
  sameOrigin,
  stytch,
  unauthorized,
} from "../../../../lib/server/user";

export const dynamic = "force-dynamic";

/**
 * Disconnect an assistant: Stytch revokes its grant and refresh tokens. An
 * access token it already holds stays valid until it expires, because the MCP
 * server verifies tokens locally (OCA_MCP_MAX_TOKEN_LIFETIME_SECONDS caps it).
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
  try {
    await stytch().users.revoke({
      user_id: user.id,
      connected_app_id: (await params).id,
    });
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Couldn't disconnect. Try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

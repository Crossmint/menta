import { MCP_PATH, mcpScopes } from "@oca/agent/mcp";
import { z } from "zod";
import { clearWebSessionCookie } from "../../../../lib/auth/cookies";
import {
  ConsentError,
  createConsent,
  readAuthorizationRequest,
  SessionGone,
  withDefaults,
} from "../../../../lib/server/oauth";
import {
  currentUser,
  origin,
  sameOrigin,
  sessionToken,
  stytchConnectedApps,
  unauthorized,
} from "../../../../lib/server/user";

export const dynamic = "force-dynamic";

const body = z.object({
  params: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  decision: z.enum(["allow", "deny"]).optional(),
});

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Stytch Connected Apps consent for the signed-in user. Without a decision it
 * validates the request (and finishes it when consent was already given);
 * with one it records Allow or Cancel. Returns where to send the browser.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return json({ error: "Forbidden" }, 403);
  }
  const user = await currentUser(request);
  const token = sessionToken(request);
  if (!user || !token) {
    return unauthorized();
  }
  const parsedBody = body.safeParse(await request.json().catch(() => null));
  const parsed = parsedBody.success
    ? readAuthorizationRequest(parsedBody.data.params)
    : null;
  if (!parsedBody.success || !parsed?.success) {
    return json({ error: new ConsentError().message }, 400);
  }
  const consent = createConsent(stytchConnectedApps());
  try {
    const { decision } = parsedBody.data;
    const request = withDefaults(parsed.data, {
      scopes: mcpScopes(),
      resource: `${origin()}${MCP_PATH}`,
    });
    const result = decision
      ? await consent.decide(token, request, decision === "allow")
      : await consent.start(token, request);
    return json(
      result.kind === "consent" ? { ...result, email: user.email } : result,
    );
  } catch (error) {
    // Stytch ended the session but the cookie lingers: clear it (as signing out
    // does) so sign-in doesn't bounce straight back, and the page's 401 goes there.
    if (error instanceof SessionGone) {
      return clearWebSessionCookie(
        Response.json(
          { error: error.message },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        ),
        origin(),
      );
    }
    if (error instanceof ConsentError) {
      return json({ error: error.message }, 400);
    }
    return json({ error: "Stytch is unavailable. Try again." }, 502);
  }
}

import { getGoogleLoginHandlers } from "../../../../../lib/auth/runtime";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const handlers = getGoogleLoginHandlers();
  if (handlers) {
    return handlers.callback(request);
  }
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: "/login?error=google_sign_in_failed",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  // Without trusted origin configuration, clear both verifier variants without
  // deriving a redirect target from caller headers or disturbing a session.
  for (const secure of [false, true]) {
    response.headers.append(
      "Set-Cookie",
      `${secure ? "__Secure-" : ""}oca_google_pkce=; Path=/api/auth/google; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
    );
  }
  return response;
}

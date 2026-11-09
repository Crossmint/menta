import { getGoogleLoginHandlers } from "../../../../../lib/auth/runtime";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const handlers = getGoogleLoginHandlers();
  if (handlers) {
    return handlers.start(request);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login?error=google_sign_in_failed",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

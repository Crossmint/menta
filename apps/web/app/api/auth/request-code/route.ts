import { getWebLoginHandlers } from "../../../../lib/auth/runtime";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const handlers = getWebLoginHandlers();
  if (!handlers) {
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return handlers.requestCode(request);
}

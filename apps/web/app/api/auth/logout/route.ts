import { getWebPush } from "@oca/agent/push";
import { getWebLoginHandlers } from "../../../../lib/auth/runtime";
import {
  notificationCookie,
  notificationDevice,
} from "../../../../lib/server/notification-cookie";
import { currentUser, sameOrigin } from "../../../../lib/server/user";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const handlers = getWebLoginHandlers();
  if (!handlers) {
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const device = notificationDevice(request);
  if (device) {
    const user = await currentUser(request);
    if (user) {
      try {
        await getWebPush()?.store.remove(user.id, device);
      } catch {
        // Preserve the sign-out path even when the push service is unavailable.
      }
    }
  }
  return notificationCookie(await handlers.logout(request), request, null);
}

import { createHash } from "node:crypto";
import {
  getWebPush,
  pushEndpoint,
  pushSubscriptionSchema,
} from "@oca/agent/push";
import { z } from "zod";
import {
  notificationCookie,
  notificationDevice,
} from "../../../lib/server/notification-cookie";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../lib/server/user";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("subscribe"),
    subscription: pushSubscriptionSchema,
    replaces: z.uuid().optional(),
  }),
  z.object({ action: z.literal("test"), id: z.uuid() }),
  z.object({
    action: z.literal("refresh"),
    previousEndpoint: z.string().max(4096).refine(pushEndpoint),
    subscription: pushSubscriptionSchema,
  }),
]);

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const push = getWebPush();
  const id = z
    .uuid()
    .safeParse(
      notificationDevice(request) ??
        new URL(request.url).searchParams.get("id"),
    );
  try {
    const enrollment =
      push && id.success ? await push.store.enrollment(user.id, id.data) : null;
    return Response.json(
      {
        id: enrollment?.id ?? null,
        endpointHash: enrollment?.endpointHash ?? null,
        available: Boolean(push),
        publicKey: push ? process.env.OCA_PUSH_PUBLIC_KEY : null,
        subscribed: Boolean(enrollment),
      },
      { headers },
    );
  } catch {
    return failed();
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const input = bodySchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json(
      { error: "Invalid notification request." },
      { status: 400, headers },
    );
  }
  const push = getWebPush();
  if (!push) {
    return Response.json(
      { error: "Notifications aren't available right now." },
      { status: 503, headers },
    );
  }
  try {
    if (input.data.action === "subscribe") {
      const id = await push.store.save(
        user.id,
        input.data.subscription,
        input.data.replaces,
      );
      return notificationCookie(
        Response.json({ id }, { headers }),
        request,
        id,
      );
    }
    if (input.data.action === "refresh") {
      const device = notificationDevice(request);
      const enrollment = device
        ? await push.store.enrollment(user.id, device)
        : null;
      if (
        !enrollment ||
        enrollment.endpointHash !==
          createHash("sha256").update(input.data.previousEndpoint).digest("hex")
      ) {
        return Response.json(
          { error: "Enable notifications again." },
          { status: 409, headers },
        );
      }
      const id = await push.store.save(
        user.id,
        input.data.subscription,
        enrollment.id,
      );
      return notificationCookie(
        Response.json({ id }, { headers }),
        request,
        id,
      );
    }
    await push.test(user.id, input.data.id);
    return Response.json({ ok: true }, { headers });
  } catch {
    return failed();
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const input = z
    .object({ id: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json(
      { error: "Invalid notification request." },
      { status: 400, headers },
    );
  }
  try {
    await getWebPush()?.store.remove(user.id, input.data.id);
    const response = Response.json({ ok: true }, { headers });
    return notificationDevice(request) === input.data.id
      ? notificationCookie(response, request, null)
      : response;
  } catch {
    return failed();
  }
}

function failed() {
  return Response.json(
    { error: "Couldn't update notifications. Try again." },
    { status: 502, headers },
  );
}

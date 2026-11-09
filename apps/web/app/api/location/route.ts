import { z } from "zod";
import { reverseGeocode } from "../../../lib/server/geocode";
import { allowLookup } from "../../../lib/server/location";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../lib/server/user";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

const coordinates = z.strictObject({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

/**
 * The chat's location step: the browser's coordinates in, a coarse place out
 * (neighborhood, city, region, postal code, country). The coordinates go no
 * further than the geocoder and are never logged or returned.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "Forbidden" },
      { status: 403, headers: noStore },
    );
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  if (!allowLookup(user.id)) {
    return Response.json(
      { error: "Too many location lookups. Try again in a few minutes." },
      { status: 429, headers: { ...noStore, "Retry-After": "60" } },
    );
  }
  const body = coordinates.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Send latitude and longitude." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const place = await reverseGeocode(body.data.latitude, body.data.longitude);
    if (!place) {
      return Response.json(
        { error: "No town found there." },
        { status: 404, headers: noStore },
      );
    }
    return Response.json({ place }, { headers: noStore });
  } catch (error) {
    console.warn(
      `Location lookup failed: ${error instanceof Error ? error.name : "unknown error"}`,
    );
    return Response.json(
      { error: "Location lookup isn't available right now." },
      { status: 502, headers: noStore },
    );
  }
}

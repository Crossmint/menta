import { placeSchema } from "@oca/agent/location";
import { geolocationReason, type Located } from "@oca/client/location";

/** The DOM-free half (packages/client). */
export {
  geolocationReason,
  LOCATION_TOOL,
  type Located,
  type LocationStep,
  OSM_ATTRIBUTION,
  readLocationStep,
  rememberedPlace,
} from "@oca/client/location";

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 10 * 60_000,
    }),
  );
}

/**
 * Where the user is: the browser's own permission prompt (none when already
 * granted), then our server turns the coordinates into a place. Coordinates
 * never leave this page except to that route. Never throws.
 */
export async function locate(): Promise<Located> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { status: "unavailable", reason: "unsupported" };
  }
  let coords: GeolocationCoordinates;
  try {
    coords = (await position()).coords;
  } catch (error) {
    return {
      status: "unavailable",
      reason: geolocationReason((error as GeolocationPositionError).code),
    };
  }
  try {
    const response = await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
    });
    const place = placeSchema.safeParse(
      response.ok ? (await response.json())?.place : null,
    );
    return place.success
      ? { status: "shared", place: place.data }
      : { status: "unavailable", reason: "failed" };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}

import { type Place, placeSchema } from "@oca/agent/location";
import { z } from "zod";

/**
 * Coordinates to a coarse place (neighborhood, city, region, postal code,
 * country) with OpenStreetMap's Nominatim. One function, so another provider
 * (e.g. Mapbox) can replace it. Follows Nominatim's usage policy: a
 * descriptive User-Agent with a contact URL, at most one request per second
 * per server instance, cached results, and a short timeout. Coordinates are
 * never logged.
 */

const endpoint = "https://nominatim.openstreetmap.org/reverse";
const timeoutMs = 8_000;
const spacingMs = 1_000;
const cacheMs = 6 * 60 * 60_000;
const cacheLimit = 5_000;

const address = z
  .object({
    suburb: z.string().optional(),
    neighbourhood: z.string().optional(),
    quarter: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    municipality: z.string().optional(),
    hamlet: z.string().optional(),
    county: z.string().optional(),
    state: z.string().optional(),
    "ISO3166-2-lvl4": z.string().optional(),
    postcode: z.string().optional(),
    country_code: z.string().optional(),
  })
  .partial();

const reverseResponse = z.object({ address: address.optional() });

/** Nominatim's address fields as our place, or null without a town or country. */
export function toPlace(body: unknown): Place | null {
  const parsed = reverseResponse.safeParse(body);
  const fields = parsed.success ? parsed.data.address : undefined;
  if (!fields) {
    return null;
  }
  const first = (...values: (string | undefined)[]) =>
    values.map((value) => value?.trim()).find(Boolean);
  const place = placeSchema.safeParse({
    neighborhood: first(fields.suburb, fields.neighbourhood, fields.quarter),
    city: first(
      fields.city,
      fields.town,
      fields.village,
      fields.municipality,
      fields.hamlet,
      fields.county,
    ),
    region: first(fields["ISO3166-2-lvl4"], fields.state),
    postalCode: first(fields.postcode),
    country: first(fields.country_code),
  });
  if (!place.success) {
    return null;
  }
  // A neighborhood that only repeats the city adds nothing.
  const { neighborhood, ...rest } = place.data;
  return neighborhood && neighborhood !== rest.city
    ? { neighborhood, ...rest }
    : rest;
}

const cache = new Map<string, { place: Place | null; at: number }>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;

/** Forgets cached places and the request spacing (tests). */
export function resetGeocoder() {
  cache.clear();
  queue = Promise.resolve();
  lastRequest = 0;
}

/** Runs one request at a time, at least a second apart. */
function throttled<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = lastRequest + spacingMs - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequest = Date.now();
    return work();
  });
  queue = next.catch(() => {});
  return next;
}

/** Names this deployment as the contact; without a configured origin, no contact. */
function userAgent() {
  const contact = process.env.OCA_WEB_ORIGIN?.trim();
  return contact ? `Menta/0.1 (+${contact})` : "Menta/0.1";
}

/**
 * The place at these coordinates, or null when Nominatim has none. Throws
 * when Nominatim can't be reached or answers with an error.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<Place | null> {
  // About 100 m: enough for a neighborhood, and nearby requests share a result.
  const lat = latitude.toFixed(3);
  const lon = longitude.toFixed(3);
  const key = `${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < cacheMs) {
    return hit.place;
  }
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat,
    lon,
    zoom: "16",
    addressdetails: "1",
  }).toString();
  const response = await throttled(() =>
    fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(timeoutMs),
    }),
  );
  if (!response.ok) {
    console.warn(
      `Reverse geocoding failed: Nominatim returned ${response.status}`,
    );
    throw new Error(`Nominatim returned ${response.status}`);
  }
  const place = toPlace(await response.json());
  if (cache.size >= cacheLimit) {
    cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, { place, at: Date.now() });
  return place;
}

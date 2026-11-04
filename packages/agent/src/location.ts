import { z } from "zod";

/**
 * Where the user is, as coarse as a store search needs: neighborhood, city,
 * region, postal code and country. Never coordinates: they stay between the
 * browser and our geocoding route.
 */
export const placeSchema = z.strictObject({
  neighborhood: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().min(1).max(120),
  /** ISO 3166-2 code ("US-FL") when known, else the state or region's name. */
  region: z.string().trim().min(1).max(120).optional(),
  postalCode: z.string().trim().min(1).max(20).optional(),
  /** ISO 3166-1 alpha-2, upper case. */
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((code) => code.toUpperCase()),
});
export type Place = z.output<typeof placeSchema>;

export const unavailableReasons = [
  "denied",
  "unsupported",
  "timeout",
  "failed",
] as const;
export type UnavailableReason = (typeof unavailableReasons)[number];

/** What `request_location` returns to the model. */
export type LocationResult =
  | {
      readonly status: "shared";
      readonly place: Place;
      /** From the host's coarse hint (city level), not the device. */
      readonly approximate?: true;
    }
  | { readonly status: "unavailable"; readonly reason: UnavailableReason }
  /** The user sent a message instead; the model reads it next. */
  | { readonly interrupted: true };

/**
 * The question's option IDs. The web chat answers with one of them plus the
 * place (JSON) or the reason as text. A typed message matches neither, so it
 * steers the turn and withdraws the question instead of answering it.
 */
export const LOCATION_SHARED = "location-shared";
export const LOCATION_UNAVAILABLE = "location-unavailable";

/** The tool's question. Channels without our client never see it answered automatically. */
export function locationQuestion(reason: string) {
  return {
    prompt: `Share your location? ${reason}`.trim(),
    display: "confirmation" as const,
    allowFreeform: false,
    options: [
      { id: LOCATION_SHARED, label: "Share my location", style: "primary" },
      { id: LOCATION_UNAVAILABLE, label: "Not now" },
    ] as { id: string; label: string; style?: "primary" }[],
  };
}

/** The answer the web chat sends for a result (`respond([{ requestId, ...answer }])`). */
export function locationAnswer(
  result:
    | { status: "shared"; place: Place }
    | { status: "unavailable"; reason: UnavailableReason },
): { optionId: string; text: string } {
  return result.status === "shared"
    ? { optionId: LOCATION_SHARED, text: JSON.stringify(result.place) }
    : { optionId: LOCATION_UNAVAILABLE, text: result.reason };
}

/** `ctx.ask`'s outcome, or undefined when the wait timed out. */
export type LocationResponse =
  | { status: "answered"; optionId?: string; text?: string }
  | { status: "cancelled" }
  | { status: "unavailable" }
  | undefined;

/** Reads the chat's answer. Anything malformed counts as a failure, never as a place. */
export function readLocationAnswer(response: LocationResponse): LocationResult {
  if (response === undefined) {
    return { status: "unavailable", reason: "timeout" };
  }
  if (response.status === "cancelled") {
    return { interrupted: true };
  }
  if (response.status === "unavailable") {
    return { status: "unavailable", reason: "unsupported" };
  }
  if (response.optionId === LOCATION_SHARED) {
    try {
      const place = placeSchema.safeParse(JSON.parse(response.text ?? ""));
      if (place.success) {
        return { status: "shared", place: place.data };
      }
    } catch {
      // Not JSON: fall through.
    }
    return { status: "unavailable", reason: "failed" };
  }
  const reason = unavailableReasons.find((item) => item === response.text);
  return { status: "unavailable", reason: reason ?? "denied" };
}

/** "Brickell, Miami": what the chat shows. */
export function placeLabel(place: Pick<Place, "neighborhood" | "city">) {
  return [place.neighborhood, place.city].filter(Boolean).join(", ");
}

const hostHint = z.object({
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).max(120).optional(),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((code) => code.toUpperCase()),
});

/**
 * The coarse location a host attaches to a tool call (ChatGPT's
 * `_meta["openai/userLocation"]`: city, region, country, timezone and
 * sometimes coordinates). Only city, region and country are kept.
 */
export function hostPlace(meta: unknown): Place | null {
  const hint =
    meta && typeof meta === "object"
      ? (meta as Record<string, unknown>)["openai/userLocation"]
      : undefined;
  const parsed = hostHint.safeParse(hint);
  if (!parsed.success) {
    return null;
  }
  const { city, region, country } = parsed.data;
  return { city, ...(region ? { region } : {}), country };
}

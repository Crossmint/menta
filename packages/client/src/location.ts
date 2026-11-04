import {
  type LocationResult,
  type Place,
  placeLabel,
  placeSchema,
  type UnavailableReason,
} from "@oca/agent/location";
import type { EveMessage, EveMessagePart } from "eve/react";

/** How a client answers the agent's location question, and the place shape it sends. */
export { locationAnswer, placeSchema } from "@oca/agent/location";

type ToolPart = Extract<EveMessagePart, { type: "dynamic-tool" }>;

/** The agent's tool that asks this page where the user is. */
export const LOCATION_TOOL = "request_location";

/** Shown wherever a place from OpenStreetMap appears. */
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

export type Located =
  | { status: "shared"; place: Place }
  | { status: "unavailable"; reason: UnavailableReason };

export interface LocationStep {
  id: string;
  status: "running" | "shared" | "unavailable";
  /** "Brickell, Miami", once shared. */
  label: string | null;
}

/**
 * What a `request_location` part shows: running while it waits (the reply is
 * live or its question is still open), then the place or that it couldn't.
 */
export function readLocationStep(
  part: ToolPart,
  waiting: boolean,
): LocationStep {
  const output =
    part.state === "output-available" && !part.partial
      ? (part.output as LocationResult | undefined)
      : undefined;
  if (output && "status" in output && output.status === "shared") {
    return {
      id: part.toolCallId,
      status: "shared",
      label: placeLabel(output.place),
    };
  }
  const finished =
    part.state === "output-available" ||
    part.state === "output-error" ||
    part.state === "output-denied";
  return {
    id: part.toolCallId,
    status: !finished && waiting ? "running" : "unavailable",
    label: null,
  };
}

/** The last place the user shared in this conversation, to answer a repeat ask without asking again. */
export function rememberedPlace(messages: readonly EveMessage[]): Place | null {
  for (const message of [...messages].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (
        part.type !== "dynamic-tool" ||
        part.toolName !== LOCATION_TOOL ||
        part.state !== "output-available"
      ) {
        continue;
      }
      const output = part.output as { status?: unknown; place?: unknown };
      if (output?.status === "shared") {
        const place = placeSchema.safeParse(output.place);
        if (place.success) {
          return place.data;
        }
      }
    }
  }
  return null;
}

/** A browser geolocation error as the reason the agent hears. */
export function geolocationReason(code: number): UnavailableReason {
  // GeolocationPositionError: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT.
  return code === 1 ? "denied" : code === 3 ? "timeout" : "failed";
}

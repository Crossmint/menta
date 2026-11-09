import type { EveMessage } from "eve/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  geolocationReason,
  LOCATION_TOOL,
  locate,
  readLocationStep,
  rememberedPlace,
} from "./location";

const brickell = {
  neighborhood: "Brickell",
  city: "Miami",
  region: "US-FL",
  postalCode: "33131",
  country: "US",
};

type ToolPart = Parameters<typeof readLocationStep>[0];

function part(fields: Record<string, unknown>): ToolPart {
  return {
    type: "dynamic-tool",
    toolName: LOCATION_TOOL,
    toolCallId: "call-1",
    input: { reason: "Nearby" },
    ...fields,
  } as unknown as ToolPart;
}

function assistant(...parts: ToolPart[]): EveMessage {
  return { id: "m", role: "assistant", parts } as unknown as EveMessage;
}

describe("the location step in the conversation", () => {
  it("runs while the question waits, then shows the place", () => {
    expect(readLocationStep(part({ state: "input-available" }), true)).toEqual({
      id: "call-1",
      status: "running",
      label: null,
    });
    expect(
      readLocationStep(
        part({
          state: "output-available",
          output: { status: "shared", place: brickell },
        }),
        false,
      ),
    ).toEqual({ id: "call-1", status: "shared", label: "Brickell, Miami" });
  });

  it.each([
    ["unavailable", { status: "unavailable", reason: "denied" }],
    ["interrupted by a typed message", { interrupted: true }],
  ])("says it couldn't when %s", (_label, output) => {
    expect(
      readLocationStep(part({ state: "output-available", output }), false)
        .status,
    ).toBe("unavailable");
  });

  it("doesn't spin for a call a stopped reply left unfinished", () => {
    expect(
      readLocationStep(part({ state: "input-available" }), false).status,
    ).toBe("unavailable");
  });
});

describe("a place shared earlier in the conversation", () => {
  it("answers a repeat ask with the latest shared place", () => {
    const older = { ...brickell, neighborhood: "Wynwood" };
    const messages = [
      assistant(
        part({
          state: "output-available",
          output: { status: "shared", place: older },
        }),
      ),
      assistant(
        part({
          state: "output-available",
          output: { status: "shared", place: brickell },
        }),
        part({ state: "input-available", toolCallId: "call-2" }),
      ),
    ];
    expect(rememberedPlace(messages)).toEqual(brickell);
  });

  it("has none when nothing was shared", () => {
    expect(
      rememberedPlace([
        assistant(
          part({
            state: "output-available",
            output: { status: "unavailable", reason: "denied" },
          }),
        ),
      ]),
    ).toBeNull();
  });
});

describe("locate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubGeolocation(
    outcome:
      | { coords: { latitude: number; longitude: number } }
      | { code: number },
  ) {
    const getCurrentPosition = vi.fn(
      (
        success: (position: unknown) => void,
        failure: (error: unknown) => void,
        _options?: PositionOptions,
      ) => ("coords" in outcome ? success(outcome) : failure(outcome)),
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    return getCurrentPosition;
  }

  it("asks the browser once, coarsely, and sends the coordinates only to our route", async () => {
    const getCurrentPosition = stubGeolocation({
      coords: { latitude: 25.7617, longitude: -80.1918 },
    });
    const fetch = vi.fn(async () => Response.json({ place: brickell }));
    vi.stubGlobal("fetch", fetch);
    expect(await locate()).toEqual({ status: "shared", place: brickell });
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 600_000,
    });
    expect(fetch).toHaveBeenCalledWith("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 25.7617, longitude: -80.1918 }),
    });
  });

  it.each([
    [1, "denied"],
    [2, "failed"],
    [3, "timeout"],
  ] as const)("reports browser error %i as %s", async (code, reason) => {
    stubGeolocation({ code });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await locate()).toEqual({ status: "unavailable", reason });
    expect(fetch).not.toHaveBeenCalled();
    expect(geolocationReason(code)).toBe(reason);
  });

  it("is unsupported without geolocation", async () => {
    vi.stubGlobal("navigator", {});
    expect(await locate()).toEqual({
      status: "unavailable",
      reason: "unsupported",
    });
  });

  it("fails when our route can't name a place", async () => {
    stubGeolocation({ coords: { latitude: 0, longitude: 0 } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "none" }, { status: 404 })),
    );
    expect(await locate()).toEqual({ status: "unavailable", reason: "failed" });
  });
});

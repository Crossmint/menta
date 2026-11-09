import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hostPlace,
  LOCATION_SHARED,
  LOCATION_UNAVAILABLE,
  locationAnswer,
  locationQuestion,
  placeLabel,
  readLocationAnswer,
} from "./location.js";

const brickell = {
  neighborhood: "Brickell",
  city: "Miami",
  region: "US-FL",
  postalCode: "33131",
  country: "US",
};

describe("the location question and its answers", () => {
  it("asks with options a typed message won't match, so typing steers instead", () => {
    const question = locationQuestion("To find the Shake Shack nearest you.");
    expect(question.allowFreeform).toBe(false);
    expect(question.options.map((option) => option.id)).toEqual([
      LOCATION_SHARED,
      LOCATION_UNAVAILABLE,
    ]);
    expect(question.prompt).toContain("Shake Shack");
  });

  it("round-trips a shared place, normalizing the country", () => {
    const answer = locationAnswer({
      status: "shared",
      place: { ...brickell, country: "US" },
    });
    expect(answer.optionId).toBe(LOCATION_SHARED);
    expect(
      readLocationAnswer({
        status: "answered",
        optionId: answer.optionId,
        text: JSON.stringify({ ...brickell, country: "us" }),
      }),
    ).toEqual({ status: "shared", place: brickell });
  });

  it.each(["denied", "unsupported", "timeout", "failed"] as const)(
    "passes on why it's unavailable (%s)",
    (reason) => {
      expect(
        readLocationAnswer({
          status: "answered",
          ...locationAnswer({ status: "unavailable", reason }),
        }),
      ).toEqual({ status: "unavailable", reason });
    },
  );

  it.each([
    ["not JSON", "Brickell"],
    ["coordinates instead of a place", '{"latitude":25.76,"longitude":-80.19}'],
    ["extra fields", JSON.stringify({ ...brickell, latitude: 25.76 })],
    ["no city", JSON.stringify({ country: "US" })],
  ])("never trusts a malformed place (%s)", (_label, text) => {
    expect(
      readLocationAnswer({
        status: "answered",
        optionId: LOCATION_SHARED,
        text,
      }),
    ).toEqual({ status: "unavailable", reason: "failed" });
  });

  it("treats a withdrawn question as interrupted, no channel as unsupported, and no answer as a timeout", () => {
    expect(readLocationAnswer({ status: "cancelled" })).toEqual({
      interrupted: true,
    });
    expect(readLocationAnswer({ status: "unavailable" })).toEqual({
      status: "unavailable",
      reason: "unsupported",
    });
    expect(readLocationAnswer(undefined)).toEqual({
      status: "unavailable",
      reason: "timeout",
    });
  });

  it("labels a place by neighborhood and city", () => {
    expect(placeLabel(brickell)).toBe("Brickell, Miami");
    expect(placeLabel({ city: "London" })).toBe("London");
  });
});

describe("a host's coarse location", () => {
  it("keeps only city, region and country from ChatGPT's hint", () => {
    expect(
      hostPlace({
        "openai/userLocation": {
          city: "Miami",
          region: "Florida",
          country: "us",
          timezone: "America/New_York",
          latitude: 25.76,
          longitude: -80.19,
        },
      }),
    ).toEqual({ city: "Miami", region: "Florida", country: "US" });
  });

  it.each([
    undefined,
    {},
    { "openai/userLocation": { country: "US" } },
    { "openai/userLocation": { city: "Miami", country: "United States" } },
  ])("has nothing without a usable hint (%o)", (meta) => {
    expect(hostPlace(meta)).toBeNull();
  });
});

describe("request_location (Eve workflow tool)", () => {
  afterEach(() => {
    vi.doUnmock("workflow");
    vi.resetModules();
  });

  /** The tool with `sleep` replaced: `elapsed` decides whether the 2-minute wait wins. */
  async function tool(elapsed = false) {
    vi.doMock("workflow", () => ({
      sleep: () => (elapsed ? Promise.resolve() : new Promise(() => {})),
    }));
    const module = await import("../agent/tools/request_location.js");
    return module.default as unknown as {
      execute: (
        input: { reason: string },
        ctx: { ask: (request: unknown) => PromiseLike<unknown> },
      ) => Promise<unknown>;
    };
  }

  it("asks the chat and returns the place it shares", async () => {
    const ask = vi.fn(async () => ({
      status: "answered",
      optionId: LOCATION_SHARED,
      text: JSON.stringify(brickell),
    }));
    const result = await (await tool()).execute(
      { reason: "To find the nearest Starbucks." },
      { ask },
    );
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("nearest Starbucks"),
        allowFreeform: false,
      }),
    );
    expect(result).toEqual({ status: "shared", place: brickell });
  });

  it("returns why it's unavailable", async () => {
    const ask = vi.fn(async () => ({
      status: "answered",
      optionId: LOCATION_UNAVAILABLE,
      text: "denied",
    }));
    expect(await (await tool()).execute({ reason: "Nearby" }, { ask })).toEqual(
      { status: "unavailable", reason: "denied" },
    );
  });

  it("is interrupted when the user types a message instead", async () => {
    const ask = vi.fn(async () => ({ status: "cancelled" }));
    expect(await (await tool()).execute({ reason: "Nearby" }, { ask })).toEqual(
      { interrupted: true },
    );
  });

  it("gives up after its wait, so the model can ask for a neighborhood", async () => {
    const ask = vi.fn(() => new Promise(() => {}));
    expect(
      await (await tool(true)).execute({ reason: "Nearby" }, { ask }),
    ).toEqual({ status: "unavailable", reason: "timeout" });
  });
});

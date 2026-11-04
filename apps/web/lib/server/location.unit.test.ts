import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => vi.fn());
const reverseGeocode = vi.hoisted(() => vi.fn());

vi.mock("./user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./user")>()),
  currentUser,
}));
vi.mock("./geocode", () => ({ reverseGeocode }));

const { POST } = await import("../../app/api/location/route");
const { resetLookupLimits } = await import("./location");

const origin = "https://commerce.invalid";
const brickell = {
  neighborhood: "Brickell",
  city: "Miami",
  region: "US-FL",
  postalCode: "33131",
  country: "US",
};
const here = { latitude: 25.761699, longitude: -80.191796 };

function lookup(
  body: unknown = here,
  headers: Record<string, string> = { origin },
) {
  return POST(
    new Request(`${origin}/api/location`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("OCA_WEB_ORIGIN", origin);
  resetLookupLimits();
  currentUser.mockResolvedValue({ id: "user-test-1" });
  reverseGeocode.mockResolvedValue(brickell);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/location", () => {
  it("turns coordinates into a place and returns only the place", async () => {
    const response = await lookup();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ place: brickell });
    expect(JSON.stringify(body)).not.toMatch(/25\.76|80\.19/);
    expect(reverseGeocode).toHaveBeenCalledWith(here.latitude, here.longitude);
  });

  it("requires a signed-in user", async () => {
    currentUser.mockResolvedValue(null);
    expect((await lookup()).status).toBe(401);
    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it.each([
    ["no origin", {}],
    ["another origin", { origin: "https://evil.invalid" }],
  ])("refuses requests with %s", async (_label, headers) => {
    expect((await lookup(here, headers)).status).toBe(403);
    expect(currentUser).not.toHaveBeenCalled();
    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it.each([
    ["missing fields", { latitude: 25.76 }],
    ["out of range", { latitude: 125, longitude: 0 }],
    ["strings", { latitude: "25.76", longitude: "-80.19" }],
    ["extra fields", { ...here, accuracy: 20 }],
  ])("refuses %s", async (_label, body) => {
    expect((await lookup(body)).status).toBe(400);
    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it("limits how many lookups a user makes", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await lookup()).status).toBe(200);
    }
    const limited = await lookup();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    currentUser.mockResolvedValue({ id: "user-test-2" });
    expect((await lookup()).status).toBe(200);
  });

  it("says so when there's no town there", async () => {
    reverseGeocode.mockResolvedValue(null);
    expect((await lookup()).status).toBe(404);
  });

  it("never logs the coordinates when the geocoder fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    reverseGeocode.mockRejectedValue(
      new Error(`fetch failed for ${here.latitude},${here.longitude}`),
    );
    const response = await lookup();
    expect(response.status).toBe(502);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify([
      warn.mock.calls,
      error.mock.calls,
      log.mock.calls,
    ]);
    expect(logged).not.toMatch(/25\.76|80\.19/);
    expect(JSON.stringify(await response.json())).not.toMatch(/25\.76|80\.19/);
  });
});

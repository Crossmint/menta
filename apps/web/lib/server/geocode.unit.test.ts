import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetGeocoder, reverseGeocode, toPlace } from "./geocode";

/** Nominatim `reverse?format=jsonv2&zoom=16&addressdetails=1` responses. */
const miami = {
  place_id: 305426240,
  licence:
    "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
  osm_type: "way",
  lat: "25.7616990",
  lon: "-80.1917964",
  category: "highway",
  type: "primary",
  addresstype: "road",
  name: "Brickell Avenue",
  display_name:
    "Brickell Avenue, Brickell, Miami, Miami-Dade County, Florida, 33131, United States",
  address: {
    road: "Brickell Avenue",
    neighbourhood: "Brickell",
    city: "Miami",
    county: "Miami-Dade County",
    state: "Florida",
    "ISO3166-2-lvl4": "US-FL",
    postcode: "33131",
    country: "United States",
    country_code: "us",
  },
};

const london = {
  place_id: 112233,
  licence:
    "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
  osm_type: "way",
  lat: "51.5033635",
  lon: "-0.1276248",
  addresstype: "road",
  name: "Downing Street",
  display_name:
    "10, Downing Street, Westminster, Millbank, London, Greater London, England, SW1A 2AA, United Kingdom",
  address: {
    house_number: "10",
    road: "Downing Street",
    quarter: "Westminster",
    suburb: "Millbank",
    city: "London",
    state_district: "Greater London",
    state: "England",
    "ISO3166-2-lvl4": "GB-ENG",
    postcode: "SW1A 2AA",
    country: "United Kingdom",
    country_code: "gb",
  },
};

/** Countryside: no city, town or village, only a county. */
const rural = {
  place_id: 445566,
  licence:
    "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
  osm_type: "way",
  lat: "43.8791",
  lon: "-110.5560",
  addresstype: "road",
  name: "Pacific Creek Road",
  display_name:
    "Pacific Creek Road, Teton County, Wyoming, 83013, United States",
  address: {
    road: "Pacific Creek Road",
    county: "Teton County",
    state: "Wyoming",
    "ISO3166-2-lvl4": "US-WY",
    postcode: "83013",
    country: "United States",
    country_code: "us",
  },
};

describe("Nominatim's address as a place", () => {
  it("maps a US city with its neighborhood and ISO region", () => {
    expect(toPlace(miami)).toEqual({
      neighborhood: "Brickell",
      city: "Miami",
      region: "US-FL",
      postalCode: "33131",
      country: "US",
    });
  });

  it("maps a London address, preferring the suburb as the neighborhood", () => {
    expect(toPlace(london)).toEqual({
      neighborhood: "Millbank",
      city: "London",
      region: "GB-ENG",
      postalCode: "SW1A 2AA",
      country: "GB",
    });
  });

  it("falls back to the county where there is no city", () => {
    expect(toPlace(rural)).toEqual({
      city: "Teton County",
      region: "US-WY",
      postalCode: "83013",
      country: "US",
    });
  });

  it("uses the state name when there is no ISO code, and town or village for a city", () => {
    expect(
      toPlace({
        address: {
          village: "Hallstatt",
          state: "Upper Austria",
          country_code: "at",
        },
      }),
    ).toEqual({ city: "Hallstatt", region: "Upper Austria", country: "AT" });
  });

  it.each([
    ["the open sea", { error: "Unable to geocode" }],
    ["a country with no town", { address: { country_code: "us" } }],
    ["no country", { address: { city: "Miami" } }],
    ["nonsense", "nope"],
  ])("has no place for %s", (_label, body) => {
    expect(toPlace(body)).toBeNull();
  });

  it("never returns coordinates or the street", () => {
    const text = JSON.stringify([toPlace(miami), toPlace(london)]);
    expect(text).not.toMatch(/25\.76|-80\.19|51\.50|Brickell Avenue|Downing/);
  });
});

describe("reverseGeocode", () => {
  const fetch = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("OCA_WEB_ORIGIN", "https://commerce.invalid");
    resetGeocoder();
    fetch.mockImplementation(async () => Response.json(miami));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetch.mockReset();
  });

  it("asks Nominatim with a contact User-Agent, rounded coordinates and a timeout", async () => {
    expect(await reverseGeocode(25.761699, -80.191796)).toMatchObject({
      city: "Miami",
    });
    const [url, init] = fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe(
      "https://nominatim.openstreetmap.org/reverse",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: "jsonv2",
      lat: "25.762",
      lon: "-80.192",
      zoom: "16",
      addressdetails: "1",
    });
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(
      "Menta/0.1 (+https://commerce.invalid)",
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("caches nearby lookups by rounded coordinates", async () => {
    await reverseGeocode(25.7617, -80.1918);
    await reverseGeocode(25.76171, -80.19182);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(7 * 60 * 60_000);
    await reverseGeocode(25.7617, -80.1918);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("sends at most one request a second", async () => {
    const times: number[] = [];
    fetch.mockImplementation(async () => {
      times.push(Date.now());
      return Response.json(london);
    });
    const lookups = Promise.all([
      reverseGeocode(51.5, -0.12),
      reverseGeocode(48.85, 2.35),
      reverseGeocode(40.71, -74.0),
    ]);
    await vi.runAllTimersAsync();
    await lookups;
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(1000);
  });

  it("throws on an error status, logging only the status", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetch.mockImplementation(async () => new Response("", { status: 429 }));
    await expect(reverseGeocode(25.7617, -80.1918)).rejects.toThrow("429");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("429"));
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/25\.76|80\.19/);
    warn.mockRestore();
  });
});

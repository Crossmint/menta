import { describe, expect, it, vi } from "vitest";
import {
  devSessionsAllowed,
  formStateKeyFromEnv,
  liveViewOriginFromEnv,
  mcpAuthorizationServerUrl,
  mcpScopes,
} from "./env.js";

it("serves the MCP auth challenge without DATABASE_URL", async () => {
  vi.stubEnv("DATABASE_URL", undefined);
  vi.stubEnv("OCA_WEB_ORIGIN", "https://commerce.invalid");
  vi.stubEnv("OCA_MCP_AUTHORIZATION_SERVER_URL", undefined);
  vi.stubEnv("OCA_MCP_CARD_TOKEN_PROFILE_ID", undefined);
  try {
    vi.resetModules();
    const { getMcpEndpoint } = await import("./env.js");
    const response = await getMcpEndpoint().fetch(
      new Request("https://commerce.invalid/mcp"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      "resource_metadata",
    );
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

describe("MCP-004 native forms sign their state with a key derived from the Stytch secret", () => {
  it("is 32 bytes, stable, not the secret itself, and absent without one", () => {
    const key = formStateKeyFromEnv({ STYTCH_SECRET: "secret-test-value" });
    expect(key).toHaveLength(32);
    expect(formStateKeyFromEnv({ STYTCH_SECRET: "secret-test-value" })).toEqual(
      key,
    );
    expect(Buffer.from(key ?? []).toString()).not.toContain("secret-test");
    expect(formStateKeyFromEnv({ STYTCH_SECRET: "another" })).not.toEqual(key);
    expect(formStateKeyFromEnv({})).toBeNull();
    expect(formStateKeyFromEnv({ STYTCH_SECRET: " " })).toBeNull();
  });
});

describe("MCP-002 the dev session path cannot turn on outside local dev", () => {
  const local = {
    NODE_ENV: "development",
    OCA_WEB_ORIGIN: "http://localhost:3000",
  };
  it("is on only for next dev on a loopback origin", () => {
    expect(devSessionsAllowed(local)).toBe(true);
    expect(
      devSessionsAllowed({ ...local, OCA_WEB_ORIGIN: "http://127.0.0.1:3002" }),
    ).toBe(true);
  });
  it.each([
    { NODE_ENV: "production" },
    { NODE_ENV: "test" },
    { NODE_ENV: undefined },
    { VERCEL: "1" },
    { OCA_WEB_ORIGIN: "https://oca.example" },
    { OCA_WEB_ORIGIN: "http://localhost.example.com:3000" },
    { OCA_WEB_ORIGIN: "not a url" },
    { OCA_WEB_ORIGIN: undefined },
  ])("is off with %o", (change) => {
    expect(devSessionsAllowed({ ...local, ...change })).toBe(false);
  });
});

describe("MCP-003 the advertised authorization server is the configured Stytch domain", () => {
  it("normalizes a trailing slash", () => {
    expect(
      mcpAuthorizationServerUrl({
        OCA_MCP_AUTHORIZATION_SERVER_URL: " https://x.customers.stytch.dev/ ",
      }),
    ).toBe("https://x.customers.stytch.dev");
  });
  it.each([
    undefined,
    "",
    "http://x.customers.stytch.dev",
    "https://x.customers.stytch.dev?a=1",
    "not a url",
  ])("is null for %o", (value) => {
    expect(
      mcpAuthorizationServerUrl({ OCA_MCP_AUTHORIZATION_SERVER_URL: value }),
    ).toBeNull();
  });
});

describe("MCP-003 the scopes every MCP token must carry", () => {
  it("defaults to commerce:invoke and splits a configured list", () => {
    expect(mcpScopes({})).toEqual(["commerce:invoke"]);
    expect(mcpScopes({ OCA_MCP_SCOPES: " a  b " })).toEqual(["a", "b"]);
  });
});

describe("MCP-004 the card frames live views only from one https origin", () => {
  it("defaults to Crossmint's production live views", () => {
    expect(liveViewOriginFromEnv({})).toBe("https://uc.crossmint.com");
    expect(liveViewOriginFromEnv({ CROSSMINT_ENV: "staging" })).toBeNull();
  });
  it("takes a configured origin", () => {
    expect(
      liveViewOriginFromEnv({
        CROSSMINT_LIVE_VIEW_ORIGIN: " https://live.example.com/ ",
      }),
    ).toBe("https://live.example.com");
    expect(
      liveViewOriginFromEnv({
        CROSSMINT_LIVE_VIEW_ORIGIN: "http://localhost:3401",
      }),
    ).toBe("http://localhost:3401");
  });
  it.each([
    "http://live.example.com",
    "https://live.example.com/path",
    "not a url",
  ])("turns Watch into a link for %o", (value) => {
    expect(
      liveViewOriginFromEnv({ CROSSMINT_LIVE_VIEW_ORIGIN: value }),
    ).toBeNull();
  });
});

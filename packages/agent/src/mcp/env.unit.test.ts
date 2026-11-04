import { describe, expect, it, vi } from "vitest";
import {
  devSessionsAllowed,
  formStateKeyFromEnv,
  mcpAuthorizationServerUrl,
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

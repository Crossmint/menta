import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cardTokenClaims, secureStepFromEnv } from "./env.js";
import { createCardCredentials } from "./secure.js";

const origin = "https://commerce.invalid";
const userId = "user-test-card";
const SESSION_JWT = "aaa.SESSION_JWT_CANARY.ccc";
const SESSION_TOKEN = "SESSION_TOKEN_CANARY";

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let privateKey: string;
beforeAll(async () => {
  keys = await generateKeyPair("RS256", { extractable: true });
  privateKey = await exportPKCS8(keys.privateKey);
});
afterEach(() => vi.restoreAllMocks());

/** A Stytch stand-in recording what the minter sends. */
function fakeStytch(
  options: {
    emails?: { email: string; verified: boolean }[];
    attestedUser?: string;
    attest?: "throw";
    getUser?: "throw";
  } = {},
) {
  const calls = {
    attest: [] as {
      profile_id: string;
      token: string;
      session_duration_minutes?: number;
    }[],
    revoke: [] as unknown[],
  };
  const attested = options.attestedUser ?? userId;
  const stytch = {
    users: {
      get: async ({ user_id }: { user_id: string }) => {
        if (options.getUser === "throw") {
          throw new Error("PROVIDER_ERROR_CANARY");
        }
        return {
          user_id,
          emails: options.emails ?? [
            { email: "old@example.invalid", verified: false },
            { email: "me@example.invalid", verified: true },
          ],
        };
      },
    },
    sessions: {
      attest: async (input: (typeof calls.attest)[number]) => {
        calls.attest.push(input);
        if (options.attest === "throw") {
          throw new Error("PROVIDER_ERROR_CANARY");
        }
        return {
          user_id: attested,
          user: { user_id: attested },
          session_token: SESSION_TOKEN,
          session_jwt: SESSION_JWT,
        };
      },
      revoke: async (input: unknown) => {
        calls.revoke.push(input);
        return {};
      },
    },
  };
  // biome-ignore lint/suspicious/noExplicitAny: a partial Stytch client
  return { stytch: stytch as any, calls };
}

function minter(stytch: ReturnType<typeof fakeStytch>["stytch"]) {
  return createCardCredentials({
    stytch,
    profileId: "trusted-auth-token-profile-test",
    privateKey,
    ...cardTokenClaims(origin),
    apiKey: "ck_production_test",
    now: () => Date.parse("2026-10-06T12:00:00Z"),
  });
}

describe("card credentials (Stytch Trusted Auth Tokens)", () => {
  it("signs a short assertion for the user's verified email and keeps a matching session", async () => {
    const { stytch, calls } = fakeStytch();
    const credentials = await minter(stytch)(userId);
    expect(credentials).toEqual({
      apiKey: "ck_production_test",
      jwt: SESSION_JWT,
      email: "me@example.invalid",
      expiresAt: Date.parse("2026-10-06T12:05:00Z"),
    });
    expect(calls.attest).toHaveLength(1);
    const [attest] = calls.attest;
    expect(attest).toMatchObject({
      profile_id: "trusted-auth-token-profile-test",
      session_duration_minutes: 5,
    });
    const { payload, protectedHeader } = await jwtVerify(
      attest?.token ?? "",
      keys.publicKey,
      {
        issuer: origin,
        audience: `${origin}/mcp/card`,
        currentDate: new Date("2026-10-06T12:00:00Z"),
      },
    );
    expect(protectedHeader.alg).toBe("RS256");
    expect(protectedHeader.kid).toEqual(expect.any(String));
    expect(payload).toMatchObject({
      sub: userId,
      email: "me@example.invalid",
      jti: expect.any(String),
    });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(60);
    expect(calls.revoke).toEqual([]);
  });

  it("uses a fresh token ID every time", async () => {
    const { stytch, calls } = fakeStytch();
    const mint = minter(stytch);
    await mint(userId);
    await mint(userId);
    const ids = await Promise.all(
      calls.attest.map(
        async (call) =>
          (
            await jwtVerify(call.token, keys.publicKey, {
              currentDate: new Date("2026-10-06T12:00:00Z"),
            })
          ).payload.jti,
      ),
    );
    expect(new Set(ids).size).toBe(2);
  });

  it("fails closed and revokes the session when Stytch resolves someone else", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { stytch, calls } = fakeStytch({ attestedUser: "user-someone-else" });
    expect(await minter(stytch)(userId)).toBeNull();
    expect(calls.revoke).toEqual([{ session_token: SESSION_TOKEN }]);
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/CANARY|eyJ/);
  });

  it("refuses a missing user", async () => {
    const { stytch, calls } = fakeStytch();
    expect(await minter(stytch)("")).toBeNull();
    expect(calls.attest).toEqual([]);
  });

  it("refuses a user without an email, before asking Stytch for a session", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { stytch, calls } = fakeStytch({ emails: [] });
    expect(await minter(stytch)(userId)).toBeNull();
    expect(calls.attest).toEqual([]);
  });

  it.each(["getUser", "attest"] as const)(
    "fails closed without leaking when %s throws",
    async (step) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { stytch } = fakeStytch({ [step]: "throw" });
      expect(await minter(stytch)(userId)).toBeNull();
      expect(JSON.stringify(error.mock.calls)).not.toContain("CANARY");
    },
  );

  it("fails closed with a broken signing key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { stytch, calls } = fakeStytch();
    const mint = createCardCredentials({
      stytch,
      profileId: "trusted-auth-token-profile-test",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----",
      ...cardTokenClaims(origin),
      apiKey: "ck_production_test",
    });
    expect(await mint(userId)).toBeNull();
    expect(calls.attest).toEqual([]);
  });
});

describe("secure step configuration", () => {
  const base = {
    STYTCH_PROJECT_ID: "project-test-x",
    STYTCH_SECRET: "secret-test-x",
  };

  it("is off unless both the profile and the key are set", () => {
    expect(secureStepFromEnv(origin, base)).toBeNull();
    expect(
      secureStepFromEnv(origin, {
        ...base,
        OCA_MCP_CARD_TOKEN_PROFILE_ID: "trusted-auth-token-profile-x",
      }),
    ).toBeNull();
    expect(
      secureStepFromEnv(origin, {
        ...base,
        OCA_MCP_CARD_TOKEN_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
      }),
    ).toBeNull();
  });

  it("refuses malformed values without echoing them", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      secureStepFromEnv(origin, {
        ...base,
        OCA_MCP_CARD_TOKEN_PROFILE_ID: "PROFILE_CANARY",
        OCA_MCP_CARD_TOKEN_PRIVATE_KEY: "KEY_CANARY",
      }),
    ).toBeNull();
    expect(JSON.stringify(error.mock.calls)).not.toContain("CANARY");
  });

  it("is on with a profile, a PKCS#8 key and a Crossmint client key", () => {
    vi.stubEnv("CROSSMINT_ENV", "production");
    vi.stubEnv("CROSSMINT_PRODUCTION_CLIENT_API_KEY", "ck_production_test");
    vi.stubEnv("STYTCH_PROJECT_ID", base.STYTCH_PROJECT_ID);
    vi.stubEnv("STYTCH_SECRET", base.STYTCH_SECRET);
    try {
      const secure = secureStepFromEnv(origin, {
        ...base,
        OCA_MCP_CARD_TOKEN_PROFILE_ID: "trusted-auth-token-profile-x",
        OCA_MCP_CARD_TOKEN_PRIVATE_KEY: privateKey.replaceAll("\n", "\\n"),
      });
      expect(secure?.crossmintOrigin).toBe("https://www.crossmint.com");
      expect(secure?.mint).toEqual(expect.any(Function));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

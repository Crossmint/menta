import type { JWTPayload } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStytchFixture } from "./fixtures/stytch.js";
import {
  AuthVerificationError,
  createStytchAuthenticators,
  requireSamePrincipal,
} from "./index.js";

describe("AUTH-001/002 installed Stytch SDK and signed loopback fixtures", () => {
  let fixture: Awaited<ReturnType<typeof createStytchFixture>>;
  let auth: ReturnType<typeof createStytchAuthenticators>;
  beforeAll(async () => {
    fixture = await createStytchFixture();
    auth = createStytchAuthenticators({
      client: fixture.client,
      ...fixture.config,
    });
  });
  afterAll(async () => fixture?.close());

  it("AUTH-001 resolves the same credential-free principal", async () => {
    const web = await auth.authenticateWebSession(fixture.sessionToken);
    const mcp = await auth.authenticateMcpToken(await fixture.sign());
    // The same user; the MCP principal also names the signed OAuth client.
    expect(mcp).toEqual({
      ...web,
      attributes: { clientId: "connected-app-test-fixture" },
    });
    expect(() => requireSamePrincipal(mcp, web)).not.toThrow();
    expect(web).toEqual({
      authenticator: "stytch",
      principalType: "user",
      principalId: fixture.userId,
      issuer: `stytch.com/${fixture.config.projectId}`,
      subject: fixture.userId,
      attributes: {},
    });
    expect(fixture.sessionRequests).toEqual([
      { session_token: fixture.sessionToken },
    ]);
    expect(fixture.jwksRequests).toBeGreaterThan(0);
  });

  it("AUTH-001 ignores caller ownership claims and cannot access another user", async () => {
    const current = await auth.authenticateMcpToken(
      await fixture.sign({ userId: fixture.otherUserId, owner: "other" }),
    );
    expect(current.principalId).toBe(fixture.userId);
    const other = await auth.authenticateMcpToken(
      await fixture.sign({ sub: fixture.otherUserId }),
    );
    expect(() => requireSamePrincipal(current, other)).toThrow(
      "Resource access denied",
    );
  });

  const invalidClaims: [string, JWTPayload][] = [
    ["wrong issuer", { iss: "https://other.invalid" }],
    [
      "wrong project",
      { aud: ["other-project", "https://commerce.invalid/mcp"] },
    ],
    ["missing resource", { aud: "project-test-auth-fixture" }],
    [
      "wrong resource",
      { aud: ["project-test-auth-fixture", "https://other.invalid/mcp"] },
    ],
    ["missing audience", { aud: undefined }],
    ["missing subject", { sub: undefined }],
    ["empty subject", { sub: "" }],
    ["whitespace subject", { sub: " " }],
    ["padded subject", { sub: " user-test-auth-fixture " }],
    [
      "whitespace resource",
      { aud: ["project-test-auth-fixture", " https://commerce.invalid/mcp"] },
    ],
    ["missing client ID", { client_id: undefined }],
    ["empty client ID", { client_id: "" }],
    ["whitespace client ID", { client_id: " " }],
    ["padded client ID", { client_id: " connected-app-test-fixture " }],
    ["non-string client ID", { client_id: 7 }],
    ["missing scope", { scope: undefined }],
    ["wrong scope", { scope: "openid email" }],
    ["partial scope match", { scope: "commerce:invoke-all" }],
    ["session JWT substitution", { scope: undefined, client_id: undefined }],
    ["ID token substitution", { scope: undefined }],
    ["missing issued-at", { iat: undefined }],
    ["missing not-before", { nbf: undefined }],
    ["missing expiry", { exp: undefined }],
    ["invalid issued-at", { iat: 1.5 }],
    ["invalid not-before", { nbf: 1.5 }],
    ["invalid expiry", { exp: 9999999999.5 }],
    ["excessive lifetime", { iat: 1, nbf: 1, exp: 9999999999 }],
  ];
  it.each(invalidClaims)("AUTH-002 rejects %s", async (_label, overrides) => {
    await expect(
      auth.authenticateMcpToken(await fixture.sign(overrides)),
    ).rejects.toThrow(AuthVerificationError);
  });

  it("AUTH-002 rejects future/expired/reversed timestamps with zero tolerance", async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const overrides of [
      { iat: now + 100, nbf: now, exp: now + 1000 },
      { iat: now, nbf: now + 100, exp: now + 1000 },
      { iat: now - 1000, nbf: now - 1000, exp: now },
      { iat: now, nbf: now + 1001, exp: now + 1000 },
    ]) {
      await expect(
        auth.authenticateMcpToken(await fixture.sign(overrides)),
      ).rejects.toThrow("Authentication failed");
    }
  });

  it("AUTH-002 enforces exact issuer beyond SDK issuer alternatives", async () => {
    const token = await fixture.sign({ iss: fixture.origin });
    await expect(
      fixture.client.idp.introspectTokenLocal(token),
    ).resolves.toMatchObject({ issuer: fixture.origin });
    await expect(auth.authenticateMcpToken(token)).rejects.toThrow(
      "Authentication failed",
    );
  });

  it("accepts a valid not-before preceding issuance without changing identity", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(
      auth.authenticateMcpToken(
        await fixture.sign({ iat: now, nbf: now - 1, exp: now + 60 }),
      ),
    ).resolves.toMatchObject({ principalId: fixture.userId });
  });

  it("AUTH-002 rejects tampering, wrong signature, unknown key and algorithm", async () => {
    const token = await fixture.sign();
    const [header, _payload, signature] = token.split(".");
    const altered = Buffer.from(
      JSON.stringify({ sub: fixture.otherUserId }),
    ).toString("base64url");
    for (const invalid of [
      `${header}.${altered}.${signature}`,
      await fixture.sign({}, { key: "other" }),
      await fixture.sign({}, { kid: "unknown-key" }),
      await fixture.sign({}, { algorithm: "HS256" }),
      "not-a-jwt",
      "",
    ]) {
      await expect(auth.authenticateMcpToken(invalid)).rejects.toThrow(
        "Authentication failed",
      );
    }
  });

  it("AUTH-002 enforces the configured revocation-through-expiry bound", async () => {
    const now = Math.floor(Date.now() / 1000);
    const bounded = createStytchAuthenticators({
      client: fixture.client,
      ...fixture.config,
      maxAccessTokenLifetimeSeconds: 60,
    });
    await expect(
      bounded.authenticateMcpToken(
        await fixture.sign({ iat: now, nbf: now, exp: now + 60 }),
      ),
    ).resolves.toMatchObject({ principalId: fixture.userId });
    await expect(
      bounded.authenticateMcpToken(
        await fixture.sign({ iat: now, nbf: now, exp: now + 61 }),
      ),
    ).rejects.toThrow("Authentication failed");
    await expect(
      bounded.authenticateMcpToken(
        await fixture.sign({ iat: now - 60, nbf: now - 60, exp: now }),
      ),
    ).rejects.toThrow("Authentication failed");
  });

  it("AUTH-002 remote errors/malformed bodies fail closed without canaries", async () => {
    for (const mode of [
      "missing-user",
      "mismatched-user",
      "provider-error",
      "invalid-json",
    ] as const) {
      fixture.setWebSessionResponse(mode);
      try {
        await auth.authenticateWebSession(fixture.sessionToken);
        expect.fail("Malformed provider response must fail closed");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthVerificationError);
        expect((error as Error).message).toBe("Authentication failed");
        expect((error as Error).cause).toBeUndefined();
        expect(JSON.stringify(error)).not.toContain("CANARY");
        expect((error as Error).stack).not.toContain("CANARY");
      }
    }
    fixture.setWebSessionResponse("valid");
    await expect(auth.authenticateWebSession("JWT_CANARY")).rejects.toThrow(
      "Authentication failed",
    );
    await expect(auth.authenticateWebSession("")).rejects.toThrow(
      "Authentication failed",
    );
  });

  it("AUTH-002 network failures fail closed without exposing SDK errors", async () => {
    const unavailable = await createStytchFixture();
    const verifier = createStytchAuthenticators({
      client: unavailable.client,
      ...unavailable.config,
    });
    const token = await unavailable.sign();
    await unavailable.close();
    await expect(
      verifier.authenticateWebSession(unavailable.sessionToken),
    ).rejects.toThrow("Authentication failed");
    await expect(verifier.authenticateMcpToken(token)).rejects.toThrow(
      "Authentication failed",
    );
  });

  it("AUTH-002 checks remote session revocation every call; MCP remains valid until expiry", async () => {
    const token = await fixture.sign();
    await auth.authenticateWebSession(fixture.sessionToken);
    fixture.revokeWebSession();
    await expect(
      auth.authenticateWebSession(fixture.sessionToken),
    ).rejects.toThrow("Authentication failed");
    await expect(auth.authenticateMcpToken(token)).resolves.toMatchObject({
      principalId: fixture.userId,
    });
  });
});

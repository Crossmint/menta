import { describe, expect, it } from "vitest";
import { createStytchFixture } from "./fixtures/stytch.js";
import {
  AuthVerificationError,
  createStytchAuthenticators,
  createStytchWebAuthenticator,
} from "./index.js";

describe("AUTH-WEB-ENTRY public session-only configuration", () => {
  it("verifies a web session without an idp client or MCP configuration", async () => {
    const fixture = await createStytchFixture();
    try {
      const web = createStytchWebAuthenticator({
        projectId: fixture.config.projectId,
        client: { sessions: fixture.client.sessions },
      });
      const combined = createStytchAuthenticators({
        ...fixture.config,
        client: fixture.client,
      });
      const principal = await web.authenticateWebSession(fixture.sessionToken);
      expect(principal).toEqual(
        await combined.authenticateWebSession(fixture.sessionToken),
      );
      expect(principal).toEqual({
        authenticator: "stytch",
        principalType: "user",
        principalId: fixture.userId,
        issuer: `stytch.com/${fixture.config.projectId}`,
        subject: fixture.userId,
        attributes: {},
      });
      expect(fixture.sessionRequests).toEqual([
        { session_token: fixture.sessionToken },
        { session_token: fixture.sessionToken },
      ]);
      expect(fixture.jwksRequests).toBe(0);
      expect(JSON.stringify(principal)).not.toContain(fixture.sessionToken);
    } finally {
      await fixture.close();
    }
  });

  it("observes revocation on the next call without caching identity", async () => {
    const fixture = await createStytchFixture();
    try {
      const web = createStytchWebAuthenticator({
        projectId: fixture.config.projectId,
        client: { sessions: fixture.client.sessions },
      });
      await web.authenticateWebSession(fixture.sessionToken);
      fixture.revokeWebSession();
      await expect(
        web.authenticateWebSession(fixture.sessionToken),
      ).rejects.toThrow(AuthVerificationError);
      expect(fixture.sessionRequests).toHaveLength(2);
    } finally {
      await fixture.close();
    }
  });

  it("rejects malformed identities and provider errors without raw details", async () => {
    const fixture = await createStytchFixture();
    try {
      const web = createStytchWebAuthenticator({
        projectId: fixture.config.projectId,
        client: { sessions: fixture.client.sessions },
      });
      for (const mode of [
        "missing-user",
        "mismatched-user",
        "provider-error",
        "invalid-json",
      ] as const) {
        fixture.setWebSessionResponse(mode);
        try {
          await web.authenticateWebSession(fixture.sessionToken);
          expect.fail("Invalid provider result must fail closed");
        } catch (error) {
          expect(error).toBeInstanceOf(AuthVerificationError);
          expect((error as Error).message).toBe("Authentication failed");
          expect((error as Error).cause).toBeUndefined();
          expect((error as Error).stack).not.toContain("CANARY");
        }
      }
      await expect(web.authenticateWebSession("")).rejects.toThrow(
        "Authentication failed",
      );
      for (const projectId of ["", " project-test-invalid "]) {
        expect(() =>
          createStytchWebAuthenticator({
            projectId,
            client: { sessions: fixture.client.sessions },
          }),
        ).toThrow("Invalid auth configuration");
      }
    } finally {
      await fixture.close();
    }
  });
});

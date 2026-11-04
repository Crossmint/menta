import type { SessionAuthContext } from "eve/context";
import { describe, expect, it } from "vitest";
import { createStytchFixture } from "./fixtures/stytch.js";
import {
  AuthOwnershipError,
  createStytchAuthenticators,
  requireSamePrincipal,
} from "./index.js";

const owner: SessionAuthContext = {
  authenticator: "stytch",
  principalType: "user",
  principalId: "user-test-owner",
  issuer: "stytch.com/project-test-owner",
  subject: "user-test-owner",
  attributes: {},
};

describe("AUTH-002 server-derived owner comparison", () => {
  it("matches verified namespace and subject, regardless of attributes", () => {
    expect(() =>
      requireSamePrincipal({ ...owner, attributes: { via: "test" } }, owner),
    ).not.toThrow();
  });

  it.each([
    ["missing current", null],
    ["undefined current", undefined],
    ["another user", { ...owner, principalId: "other", subject: "other" }],
    ["another project", { ...owner, issuer: "stytch.com/other" }],
    ["another verifier", { ...owner, authenticator: "local-dev" }],
    ["another class", { ...owner, principalType: "service" }],
    ["inconsistent subject", { ...owner, subject: "other" }],
    ["missing subject", { ...owner, subject: undefined }],
    ["missing issuer", { ...owner, issuer: undefined }],
  ])("rejects %s", (_label, current) => {
    expect(() => requireSamePrincipal(current, owner)).toThrow(
      AuthOwnershipError,
    );
  });

  it("rejects missing or inconsistent server owner", () => {
    expect(() => requireSamePrincipal(owner, null)).toThrow(AuthOwnershipError);
    expect(() => requireSamePrincipal(owner, undefined)).toThrow(
      AuthOwnershipError,
    );
    expect(() =>
      requireSamePrincipal(owner, { ...owner, principalId: "", subject: "" }),
    ).toThrow(AuthOwnershipError);
    expect(() =>
      requireSamePrincipal(owner, { ...owner, subject: "other" }),
    ).toThrow("Resource access denied");
  });
});

describe("AUTH-002 explicit trusted configuration", () => {
  it("rejects missing resource/scope and an invalid lifetime", async () => {
    const fixture = await createStytchFixture();
    try {
      for (const override of [
        { mcpResourceUrl: "" },
        { mcpResourceUrl: "http://commerce.invalid/mcp" },
        { mcpResourceUrl: "ftp://localhost/mcp" },
        { mcpResourceUrl: " https://commerce.invalid/mcp " },
        { requiredMcpScopes: [] },
        { requiredMcpScopes: ["commerce:invoke other"] },
        { maxAccessTokenLifetimeSeconds: 0 },
        { maxAccessTokenLifetimeSeconds: 1.5 },
        { projectId: "" },
        { projectId: " project-test-auth-fixture " },
        { tokenIssuer: "" },
        { tokenIssuer: " stytch.com/project-test-auth-fixture " },
      ]) {
        expect(() =>
          createStytchAuthenticators({
            client: fixture.client,
            ...fixture.config,
            ...override,
          }),
        ).toThrow("Invalid auth configuration");
      }
    } finally {
      await fixture.close();
    }
  });
});

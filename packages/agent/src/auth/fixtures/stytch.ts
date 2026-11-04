import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from "jose";
import { Client } from "stytch";

// Contract fixture only: no provider account, credentials, or non-loopback network.
export async function createStytchFixture() {
  const projectId = "project-test-auth-fixture";
  const userId = "user-test-auth-fixture";
  const otherUserId = "user-test-other-fixture";
  const sessionToken = "inert-session-fixture";
  const config = {
    projectId,
    tokenIssuer: `stytch.com/${projectId}`,
    mcpResourceUrl: "https://commerce.invalid/mcp",
    requiredMcpScopes: ["commerce:invoke"],
    maxAccessTokenLifetimeSeconds: 3600,
  };
  const trusted = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(trusted.publicKey)),
    kid: "fixture-key",
    alg: "RS256",
    use: "sig",
  };
  const sessionRequests: {
    session_token?: string;
    session_duration_minutes?: number;
  }[] = [];
  let revoked = false;
  let webResponse:
    | "valid"
    | "missing-user"
    | "mismatched-user"
    | "provider-error"
    | "invalid-json" = "valid";
  let jwksRequests = 0;
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (
      request.method === "GET" &&
      request.url === `/v1/sessions/jwks/${projectId}`
    ) {
      jwksRequests += 1;
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (
      request.method !== "POST" ||
      request.url !== "/v1/sessions/authenticate"
    ) {
      response.writeHead(404).end("{}");
      return;
    }
    let body = "";
    for await (const chunk of request) {
      body += chunk.toString();
    }
    const input = JSON.parse(body);
    sessionRequests.push(input);
    if (
      revoked ||
      input.session_token !== sessionToken ||
      webResponse === "provider-error"
    ) {
      response.writeHead(401).end(
        JSON.stringify({
          status_code: 401,
          request_id: "fixture-request",
          error_type: "session_invalid",
          error_message: "PROVIDER_SECRET_CANARY",
        }),
      );
      return;
    }
    if (webResponse === "invalid-json") {
      response.end("PROVIDER_SECRET_CANARY");
      return;
    }
    response.end(
      JSON.stringify({
        status_code: 200,
        request_id: "fixture-request",
        session: {
          session_id: "session-test-fixture",
          ...(webResponse === "missing-user" ? {} : { user_id: userId }),
          authentication_factors: [],
          roles: [],
          custom_claims: { secret: "PROVIDER_SECRET_CANARY" },
        },
        user: {
          user_id: webResponse === "mismatched-user" ? otherUserId : userId,
        },
        session_token: "RETURNED_SESSION_SECRET_CANARY",
        session_jwt: "RETURNED_JWT_SECRET_CANARY",
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Public ClientConfig.env accepts a string; custom_base_url requires HTTPS.
  const client = new Client({
    project_id: projectId,
    secret: "inert-fixture-secret",
    env: origin,
    timeout: 2000,
  });
  return {
    client,
    origin,
    config,
    userId,
    otherUserId,
    sessionToken,
    sessionRequests,
    get jwksRequests() {
      return jwksRequests;
    },
    revokeWebSession() {
      revoked = true;
    },
    setWebSessionResponse(mode: typeof webResponse) {
      webResponse = mode;
    },
    async sign(
      overrides: JWTPayload = {},
      options: {
        algorithm?: "RS256" | "HS256";
        kid?: string;
        key?: "trusted" | "other";
      } = {},
    ) {
      const now = Math.floor(Date.now() / 1000);
      const algorithm = options.algorithm ?? "RS256";
      return new SignJWT({
        iss: config.tokenIssuer,
        sub: userId,
        aud: [projectId, config.mcpResourceUrl],
        client_id: "connected-app-test-fixture",
        scope: "commerce:invoke",
        iat: now,
        nbf: now,
        exp: now + 3600,
        jti: "fixture-token-id",
        ...overrides,
      })
        .setProtectedHeader({
          alg: algorithm,
          typ: "JWT",
          kid: options.kid ?? "fixture-key",
        })
        .sign(
          algorithm === "HS256"
            ? new Uint8Array(32).fill(7)
            : (options.key === "other" ? other : trusted).privateKey,
        );
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

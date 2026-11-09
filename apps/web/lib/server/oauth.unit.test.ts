import type { Client } from "stytch";
import { describe, expect, it } from "vitest";
import {
  type AuthorizationRequest,
  ConsentError,
  createConsent,
  readAuthorizationRequest,
  SessionGone,
  withDefaults,
} from "./oauth";

const query = {
  client_id: "connected-app-test-chatgpt",
  redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
  response_type: "code",
  scope: "openid commerce:invoke",
  state: "state-123",
  code_challenge: "c".repeat(43),
  code_challenge_method: "S256",
  resource: "https://commerce.invalid/mcp",
};

function fakeStytch(
  options: {
    consentRequired?: boolean;
    redirect?: string;
    fail?: boolean;
    /** What both Stytch calls throw instead, e.g. a StytchError's shape. */
    error?: unknown;
    /** What the client registered: its name and redirects, or a failed lookup. */
    registered?: { name: string; redirects: string[] } | null;
  } = {},
) {
  const calls: { method: string; data: Record<string, unknown> }[] = [];
  const registered =
    options.registered === undefined
      ? { name: "ChatGPT", redirects: [query.redirect_uri] }
      : options.registered;
  const client = {
    connectedApp: {
      clients: {
        async get(data: Record<string, unknown>) {
          calls.push({ method: "clients.get", data });
          if (!registered) {
            throw new Error("client_not_found");
          }
          return {
            connected_app: {
              client_id: data.client_id,
              client_name: registered.name,
              redirect_urls: registered.redirects,
            },
          };
        },
      },
    },
    idp: {
      oauth: {
        async authorizeStart(data: Record<string, unknown>) {
          calls.push({ method: "authorizeStart", data });
          if (options.error) {
            throw options.error;
          }
          if (options.fail) {
            throw new Error("PROVIDER_BODY_CANARY");
          }
          return {
            consent_required: options.consentRequired ?? true,
            client: {
              client_id: data.client_id,
              client_name: "ChatGPT",
              client_description: "OpenAI's assistant",
              client_type: "third_party_public",
            },
            scope_results: [
              {
                scope: "commerce:invoke",
                description: "Start checkouts",
                is_grantable: true,
              },
            ],
          };
        },
        async authorize(data: Record<string, unknown>) {
          calls.push({ method: "authorize", data });
          if (options.error) {
            throw options.error;
          }
          return {
            redirect_uri:
              options.redirect ??
              `${data.redirect_uri}?code=CODE&state=${data.state}`,
          };
        },
      },
    },
  } as unknown as Pick<Client, "idp" | "connectedApp">;
  return { client, calls };
}

function request(overrides: Record<string, unknown> = {}) {
  const parsed = readAuthorizationRequest({ ...query, ...overrides } as never);
  if (!parsed.success) {
    throw new Error("fixture request should parse");
  }
  return parsed.data as AuthorizationRequest;
}

describe("MCP-003 a request without scope or resource gets Menta's", () => {
  const mcp = {
    scopes: ["commerce:invoke"],
    resource: "https://menta.example/mcp",
  };
  const bare = readAuthorizationRequest({
    client_id: "https://chatgpt.com/oauth/x/client.json",
    redirect_uri: "https://chatgpt.com/connector/oauth/x",
    response_type: "code",
  });
  it("fills them in, with a refresh token", () => {
    if (!bare.success) {
      throw bare.error;
    }
    const filled = withDefaults(bare.data, mcp);
    expect(filled.scope).toBe("commerce:invoke offline_access");
    expect(filled.resource).toEqual(["https://menta.example/mcp"]);
  });
  it("keeps what the assistant asked for, and adds only a refresh token", () => {
    const asked = readAuthorizationRequest({
      client_id: "connected-app-test-chatgpt",
      redirect_uri: "https://chatgpt.com/connector/oauth/x",
      response_type: "code",
      scope: "commerce:invoke",
      resource: "https://other.example/mcp",
    });
    if (!asked.success) {
      throw asked.error;
    }
    expect(withDefaults(asked.data, mcp)).toEqual({
      ...asked.data,
      scope: "commerce:invoke offline_access",
    });
    const already = {
      ...asked.data,
      scope: "openid offline_access commerce:invoke",
    };
    expect(withDefaults(already, mcp)).toEqual(already);
  });
});

describe("MCP-003 Connected Apps consent acts for the signed-in user", () => {
  it("shows the client, scopes and return host when consent is needed", async () => {
    const { client, calls } = fakeStytch();
    const screen = await createConsent(client).start("SESSION", request());
    expect(screen).toEqual({
      kind: "consent",
      client: {
        name: "ChatGPT",
        description: "OpenAI's assistant",
        logoUrl: null,
        icon: "/assistants/chatgpt.png",
      },
      returnsTo: "chatgpt.com",
      scopes: [
        {
          scope: "commerce:invoke",
          description: "Start checkouts",
          grantable: true,
        },
      ],
    });
    expect(calls).toEqual([
      {
        method: "authorizeStart",
        data: {
          client_id: query.client_id,
          redirect_uri: query.redirect_uri,
          response_type: "code",
          scopes: ["openid", "commerce:invoke"],
          session_token: "SESSION",
        },
      },
      { method: "clients.get", data: { client_id: query.client_id } },
    ]);
  });

  it("names Grok Bot by its Cursor agents redirect, as sign-in does", async () => {
    const { client } = fakeStytch({
      registered: {
        name: "Cursor",
        redirects: [
          "https://www.cursor.com/agents/mcp/oauth/callback",
          "http://localhost:51234/callback",
        ],
      },
    });
    const screen = await createConsent(client).start("SESSION", request());
    expect(screen).toMatchObject({
      client: { name: "Grok Bot", icon: "/assistants/grokbot.png" },
    });
  });

  it("falls back to what authorizeStart returned when the lookup fails", async () => {
    const { client } = fakeStytch({ registered: null });
    const screen = await createConsent(client).start("SESSION", request());
    expect(screen).toMatchObject({
      client: { name: "ChatGPT", icon: "/assistants/chatgpt.png" },
    });
  });

  it("finishes at once when the user already allowed this client", async () => {
    const { client, calls } = fakeStytch({ consentRequired: false });
    const result = await createConsent(client).start("SESSION", request());
    expect(result).toEqual({
      kind: "redirect",
      redirectUri: `${query.redirect_uri}?code=CODE&state=state-123`,
    });
    expect(calls.map((call) => call.method)).toEqual([
      "authorizeStart",
      "authorize",
    ]);
    expect(calls[1].data.consent_granted).toBe(true);
  });

  it("passes PKCE, state and the MCP resource with the user's decision", async () => {
    const { client, calls } = fakeStytch();
    await createConsent(client).decide("SESSION", request(), false);
    expect(calls[0].data).toEqual({
      consent_granted: false,
      scopes: ["openid", "commerce:invoke"],
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      response_type: "code",
      session_token: "SESSION",
      state: "state-123",
      code_challenge: query.code_challenge,
      resources: [query.resource],
    });
  });

  it("never navigates to a script URL and hides provider errors", async () => {
    const unsafe = fakeStytch({ redirect: "javascript:alert(1)" });
    await expect(
      createConsent(unsafe.client).decide("SESSION", request(), true),
    ).rejects.toBeInstanceOf(ConsentError);
    const failing = fakeStytch({ fail: true });
    const error = await createConsent(failing.client)
      .start("SESSION", request())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConsentError);
    expect(String((error as Error).message)).not.toContain("CANARY");
  });

  it.each(["session_not_found", "invalid_session_token"])(
    "asks to sign in again when Stytch says %s",
    async (errorType) => {
      const { client } = fakeStytch({
        error: { error_type: errorType, error_message: "PROVIDER_BODY_CANARY" },
      });
      const consent = createConsent(client);
      for (const attempt of [
        () => consent.start("SESSION", request()),
        () => consent.decide("SESSION", request(), true),
      ]) {
        const error = await attempt().catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(SessionGone);
        expect(String((error as Error).message)).not.toContain("CANARY");
      }
    },
  );

  it("keeps the one fixed message for any other Stytch failure", async () => {
    const { client } = fakeStytch({
      error: {
        error_type: "invalid_redirect_uri",
        error_message: "PROVIDER_BODY_CANARY",
      },
    });
    const error = await createConsent(client)
      .start("SESSION", request())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConsentError);
    expect(String((error as Error).message)).not.toContain("CANARY");
  });

  it.each([
    { response_type: "token" },
    { code_challenge_method: "plain" },
    { redirect_uri: "not a url" },
    { client_id: "" },
    { state: "line\nbreak" },
  ])("rejects a malformed request before calling Stytch: %o", (change) => {
    expect(readAuthorizationRequest({ ...query, ...change }).success).toBe(
      false,
    );
  });

  it("keeps every repeated resource and the first of other parameters", () => {
    const parsed = readAuthorizationRequest({
      ...query,
      resource: ["https://a.invalid/mcp", "https://b.invalid/mcp"],
      client_id: ["first", "second"],
    });
    expect(parsed.success && parsed.data.resource).toEqual([
      "https://a.invalid/mcp",
      "https://b.invalid/mcp",
    ]);
    expect(parsed.success && parsed.data.client_id).toBe("first");
  });
});

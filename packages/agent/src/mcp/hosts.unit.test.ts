import { describe, expect, it } from "vitest";
import {
  claudeUiDomain,
  createCursorAgentResolver,
  createHostResolver,
  fetchClientMetadata,
  hostFromRedirectUrls,
  hostOfClient,
  isClientIdUrl,
  isCursorAgentRedirects,
} from "./hosts.js";

/** The documents ChatGPT and Claude Code publish (fetched 2026-10-07). */
const CHATGPT_CIMD = "https://chatgpt.com/oauth/client.json";
const CLAUDE_CODE_CIMD = "https://claude.ai/oauth/claude-code-client-metadata";
const documents: Record<string, unknown> = {
  [CHATGPT_CIMD]: {
    client_id: CHATGPT_CIMD,
    client_uri: "https://chatgpt.com/",
    redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
    client_name: "ChatGPT",
  },
  [CLAUDE_CODE_CIMD]: {
    client_id: CLAUDE_CODE_CIMD,
    client_name: "Claude Code",
    redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
  },
};

/** A fetch that serves `documents` and records what was asked. */
function fakeFetch(served = documents) {
  const asked: { url: string; redirect?: string }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, ...(init?.redirect ? { redirect: init.redirect } : {}) });
    const body = served[url];
    return body === undefined
      ? new Response("not found", { status: 404 })
      : Response.json(body);
  }) as typeof fetch;
  return { impl, asked };
}

/** A partial Stytch client whose clients.get answers from `records` or throws. */
function stytch(records: Record<string, Record<string, unknown>>) {
  const asked: string[] = [];
  return {
    asked,
    client: {
      connectedApp: {
        clients: {
          get: async ({ client_id }: { client_id: string }) => {
            asked.push(client_id);
            const record = records[client_id];
            if (!record) {
              throw new Error("connected_app_not_found");
            }
            return { connected_app: { client_id, ...record } };
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: a partial Stytch client
    } as any,
  };
}

describe("MCP Apps hosts", () => {
  it("matches Claude's documented ui.domain example", () => {
    expect(claudeUiDomain("https://example.com/mcp")).toBe(
      "c3d80a4ed901ee05b21755a88273b4a4.claudemcpcontent.com",
    );
    // The hash covers the exact URL string.
    expect(claudeUiDomain("https://example.com/mcp/")).not.toBe(
      claudeUiDomain("https://example.com/mcp"),
    );
  });

  it.each([
    [["https://claude.ai/api/mcp/auth_callback"], "claude"],
    [["https://claude.com/api/mcp/auth_callback"], "claude"],
    [["https://chatgpt.com/connector_platform_oauth_redirect"], "chatgpt"],
    [["https://platform.openai.com/apps-manage/oauth"], "chatgpt"],
    [["http://localhost:6274/oauth/callback"], null],
    [["https://claude.ai.evil.invalid/cb"], null],
    [["https://notclaude.ai/cb"], null],
    [["http://claude.ai/cb"], null],
    [
      [
        "https://claude.ai/api/mcp/auth_callback",
        "https://chatgpt.com/connector_platform_oauth_redirect",
      ],
      null,
    ],
    [["not a url"], null],
    [[], null],
  ])("classifies %j as %s", (urls, host) => {
    expect(hostFromRedirectUrls(urls)).toBe(host);
  });

  it("looks a client up once and caches it", async () => {
    let calls = 0;
    const hostOf = createHostResolver({
      connectedApp: {
        clients: {
          get: async ({ client_id }: { client_id: string }) => {
            calls += 1;
            return {
              connected_app: {
                client_id,
                redirect_urls: ["https://claude.ai/api/mcp/auth_callback"],
              },
            };
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: a partial Stytch client
    } as any);
    expect(await hostOf("client-1")).toBe("claude");
    expect(await hostOf("client-1")).toBe("claude");
    expect(calls).toBe(1);
    expect(await hostOf("")).toBeNull();
  });

  it("treats a failed lookup as unknown, and asks again later", async () => {
    let calls = 0;
    const hostOf = createHostResolver({
      connectedApp: {
        clients: {
          get: async () => {
            calls += 1;
            throw new Error("down");
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: a partial Stytch client
    } as any);
    expect(await hostOf("client-1")).toBeNull();
    expect(await hostOf("client-1")).toBeNull();
    expect(calls).toBe(2);
  });

  describe("client ID metadata documents (CIMD)", () => {
    it.each([
      [CHATGPT_CIMD, true],
      ["https://chatgpt.com/oauth/abc123/client.json", true],
      [CLAUDE_CODE_CIMD, true],
      ["connected-app-test-1234", false],
      ["https://chatgpt.com", false],
      ["http://chatgpt.com/oauth/client.json", false],
      ["", false],
    ])("treats %j as a metadata URL: %s", (clientId, expected) => {
      expect(isClientIdUrl(clientId)).toBe(expected);
    });

    it.each([
      // ChatGPT's stable and per-connection documents.
      [
        CHATGPT_CIMD,
        ["https://chatgpt.com/connector_platform_oauth_redirect"],
        "chatgpt",
      ],
      [
        "https://chatgpt.com/oauth/abc123/client.json",
        ["https://chatgpt.com/connector/oauth/abc123"],
        "chatgpt",
      ],
      // Claude's hosted apps: a Claude document with Claude's callback.
      [
        "https://claude.ai/oauth/mcp-client-metadata",
        ["https://claude.ai/api/mcp/auth_callback"],
        "claude",
      ],
      // Claude Code: Claude's domain, but loopback redirects and no card.
      [
        CLAUDE_CODE_CIMD,
        ["http://localhost/callback", "http://127.0.0.1/callback"],
        null,
      ],
      // Another domain claiming ChatGPT's redirect doesn't become ChatGPT.
      [
        "https://evil.invalid/client.json",
        ["https://chatgpt.com/connector_platform_oauth_redirect"],
        null,
      ],
      // The document's host and its redirects must agree.
      [CHATGPT_CIMD, ["https://claude.ai/api/mcp/auth_callback"], null],
      [CHATGPT_CIMD, [], null],
    ])(
      "classifies the CIMD client %s with %j as %s",
      (clientId, redirectUrls, host) => {
        expect(hostOfClient({ clientId, redirectUrls })).toBe(host);
      },
    );

    it("keeps DCR clients classified by redirect URLs alone", () => {
      expect(
        hostOfClient({
          clientId: "connected-app-test-1234",
          redirectUrls: ["https://claude.ai/api/mcp/auth_callback"],
        }),
      ).toBe("claude");
      // A Stytch ID registered through CIMD is held to its document URL.
      expect(
        hostOfClient({
          clientId: "connected-app-test-1234",
          metadataUrl: "https://evil.invalid/client.json",
          redirectUrls: ["https://claude.ai/api/mcp/auth_callback"],
        }),
      ).toBeNull();
    });

    it("reads a document that names itself, without following redirects", async () => {
      const { impl, asked } = fakeFetch();
      expect(await fetchClientMetadata(CHATGPT_CIMD, impl)).toEqual([
        "https://chatgpt.com/connector_platform_oauth_redirect",
      ]);
      expect(asked).toEqual([{ url: CHATGPT_CIMD, redirect: "error" }]);
    });

    it("refuses a document that doesn't name itself, and never fetches other domains", async () => {
      const { impl, asked } = fakeFetch({
        [CHATGPT_CIMD]: {
          client_id: "https://chatgpt.com/oauth/other.json",
          redirect_uris: [
            "https://chatgpt.com/connector_platform_oauth_redirect",
          ],
        },
      });
      expect(await fetchClientMetadata(CHATGPT_CIMD, impl)).toBeNull();
      expect(
        await fetchClientMetadata("https://evil.invalid/c.json", impl),
      ).toBeNull();
      expect(
        await fetchClientMetadata("http://chatgpt.com/oauth/client.json", impl),
      ).toBeNull();
      expect(asked.map((item) => item.url)).toEqual([CHATGPT_CIMD]);
    });

    it("treats a broken, oversized or unreachable document as unknown", async () => {
      const broken = (async () =>
        new Response("{not json")) as unknown as typeof fetch;
      expect(await fetchClientMetadata(CHATGPT_CIMD, broken)).toBeNull();
      const huge = (async () =>
        new Response(" ".repeat(70_000))) as unknown as typeof fetch;
      expect(await fetchClientMetadata(CHATGPT_CIMD, huge)).toBeNull();
      const down = (async () => {
        throw new Error("network");
      }) as unknown as typeof fetch;
      expect(await fetchClientMetadata(CHATGPT_CIMD, down)).toBeNull();
    });

    it("uses Stytch's record of a CIMD client when it has one", async () => {
      const { client, asked } = stytch({
        [CHATGPT_CIMD]: {
          client_id_metadata_url: CHATGPT_CIMD,
          redirect_urls: [
            "https://chatgpt.com/connector_platform_oauth_redirect",
          ],
        },
      });
      const { impl, asked: fetched } = fakeFetch();
      const hostOf = createHostResolver(client, { fetch: impl });
      expect(await hostOf(CHATGPT_CIMD)).toBe("chatgpt");
      expect(asked).toEqual([CHATGPT_CIMD]);
      expect(fetched).toEqual([]);
    });

    it("falls back to the document when Stytch can't return the client, and caches it", async () => {
      const { client, asked } = stytch({});
      const { impl, asked: fetched } = fakeFetch();
      const hostOf = createHostResolver(client, { fetch: impl });
      expect(await hostOf(CHATGPT_CIMD)).toBe("chatgpt");
      expect(await hostOf(CHATGPT_CIMD)).toBe("chatgpt");
      expect(await hostOf(CLAUDE_CODE_CIMD)).toBeNull();
      expect(asked).toEqual([CHATGPT_CIMD, CLAUDE_CODE_CIMD]);
      expect(fetched.map((item) => item.url)).toEqual([
        CHATGPT_CIMD,
        CLAUDE_CODE_CIMD,
      ]);
    });

    it("classifies a Stytch ID registered through CIMD by its document", async () => {
      const { client } = stytch({
        "connected-app-test-cimd": {
          client_id_metadata_url: CHATGPT_CIMD,
          redirect_urls: [],
        },
      });
      const { impl } = fakeFetch();
      const hostOf = createHostResolver(client, { fetch: impl });
      expect(await hostOf("connected-app-test-cimd")).toBe("chatgpt");
    });

    it("never fetches another assistant's document, and remembers it as unknown", async () => {
      const { client, asked } = stytch({});
      const { impl, asked: fetched } = fakeFetch();
      const hostOf = createHostResolver(client, { fetch: impl });
      const cursor = "https://cursor.invalid/oauth/client.json";
      expect(await hostOf(cursor)).toBeNull();
      expect(await hostOf(cursor)).toBeNull();
      expect(asked).toEqual([cursor]);
      expect(fetched).toEqual([]);
    });

    it("asks again later when a known host's document can't be read", async () => {
      const { client } = stytch({});
      const { impl, asked } = fakeFetch({});
      const hostOf = createHostResolver(client, { fetch: impl });
      expect(await hostOf(CHATGPT_CIMD)).toBeNull();
      expect(await hostOf(CHATGPT_CIMD)).toBeNull();
      expect(asked).toHaveLength(2);
    });
  });
});

describe("Cursor's hosted agents (Grok Bot)", () => {
  const AGENT = "https://www.cursor.com/agents/mcp/oauth/callback";

  it("signs in only through www.cursor.com/agents/", () => {
    expect(isCursorAgentRedirects([AGENT])).toBe(true);
    expect(isCursorAgentRedirects([])).toBe(false);
    expect(
      isCursorAgentRedirects(["cursor://anysphere.cursor-mcp/oauth/callback"]),
    ).toBe(false);
    // What Grok Bot registers (Stytch, 2026-10-28).
    expect(
      isCursorAgentRedirects([AGENT, "http://localhost:8787/callback"]),
    ).toBe(true);
    expect(
      isCursorAgentRedirects([
        AGENT,
        "cursor://anysphere.cursor-mcp/oauth/callback",
      ]),
    ).toBe(false);
    expect(
      isCursorAgentRedirects([
        "http://www.cursor.com/agents/mcp/oauth/callback",
      ]),
    ).toBe(false);
    expect(isCursorAgentRedirects(["https://www.cursor.com/settings"])).toBe(
      false,
    );
  });

  it("reads the client's redirect URLs from Stytch once, and says no when it can't", async () => {
    const { client, asked } = stytch({
      "grok-bot": { redirect_urls: [AGENT] },
      editor: {
        redirect_urls: ["cursor://anysphere.cursor-mcp/oauth/callback"],
      },
    });
    const isCursorAgent = createCursorAgentResolver(client);
    expect(await isCursorAgent("grok-bot")).toBe(true);
    expect(await isCursorAgent("grok-bot")).toBe(true);
    expect(await isCursorAgent("editor")).toBe(false);
    expect(await isCursorAgent("missing")).toBe(false);
    expect(await isCursorAgent(CHATGPT_CIMD)).toBe(false);
    expect(asked).toEqual(["grok-bot", "editor", "missing"]);
  });
});

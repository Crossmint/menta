import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  type CheckoutsApi,
  createCheckouts,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStytchFixture } from "../auth/fixtures/stytch.js";
import { createStytchAuthenticators } from "../auth/index.js";
import { type AppHost, createMcpEndpoint } from "./index.js";

const origin = "https://commerce.invalid";
const STREET = "1 STREET_CANARY Way";
const PROFILE_ID = "buyer-PROFILE_ID_CANARY";

/**
 * Crossmint as settings sees it: saved addresses (buyer profiles), the
 * user's browser profile (store sign-ins) and our stored default.
 */
function fakeCrossmint() {
  const calls: { op: string; user: unknown; id?: unknown }[] = [];
  const profiles = [
    // Crossmint lists newest first.
    {
      id: `${PROFILE_ID}-2`,
      label: "Mom",
      name: { first: "Grace", last: "Hopper" },
      contact: { email: "mom@example.invalid" },
      shipping: {
        addressLines: [STREET],
        locality: "Tampa",
        administrativeAreaCode: "US-FL",
        postalCode: "33601",
        countryCode: "US",
      },
    },
    {
      id: `${PROFILE_ID}-1`,
      label: "Home",
      name: { first: "Ada", last: "Lovelace" },
      contact: { email: "ada@example.invalid" },
      shipping: {
        addressLines: [STREET],
        locality: "Miami",
        administrativeAreaCode: "US-FL",
        postalCode: "33131",
        countryCode: "US",
      },
    },
  ];
  const state = {
    defaultId: `${PROFILE_ID}-1` as string | null,
    browserProfile: true,
    failAddresses: false,
  };
  const user = (options: { headers?: Record<string, string> }) =>
    options.headers?.["x-crossmint-user-id"];
  const ok = (data: unknown) => Promise.resolve({ data });
  const api = {
    buyerProfiles: {
      list: (options: { headers: Record<string, string> }) => {
        calls.push({ op: "addresses", user: user(options) });
        if (state.failAddresses) {
          return Promise.resolve({
            error: { message: "down" },
            response: { status: 500 },
          });
        }
        return ok({ data: profiles, nextCursor: null });
      },
    },
    browserProfiles: {
      list: (options: { headers: Record<string, string> }) => {
        calls.push({ op: "browser-profiles", user: user(options) });
        return ok({
          data: state.browserProfile ? [{ id: "browser-1" }] : [],
          nextCursor: null,
        });
      },
      delete: (options: {
        headers: Record<string, string>;
        path: { id: string };
      }) => {
        calls.push({
          op: "clear-sign-ins",
          user: user(options),
          id: options.path.id,
        });
        state.browserProfile = false;
        return ok({});
      },
    },
  } as unknown as CheckoutsApi;
  return {
    calls,
    state,
    checkouts: createCheckouts({
      api,
      actionUrl: (runId) => `${origin}/checkouts/${runId}`,
      addressDefaults: {
        get: async () => state.defaultId,
        set: async (_user, id) => {
          calls.push({ op: "set-default", user: _user, id });
          state.defaultId = id;
        },
      },
      browserProfiles: false,
    }),
  };
}

type Result = {
  isError?: boolean;
  content: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

const SETTINGS_TOOLS = [
  "settings_add_address",
  "settings_manage_cards",
  "settings_read",
  "settings_sign_out_stores",
  "settings_update",
];

describe("MCP-002 plugin settings (Settings inside ChatGPT)", () => {
  let fixture: Awaited<ReturnType<typeof createStytchFixture>>;
  let crossmint: ReturnType<typeof fakeCrossmint>;

  beforeAll(async () => {
    fixture = await createStytchFixture();
  });
  afterAll(async () => fixture?.close());

  function endpoint(host: AppHost | null) {
    const auth = createStytchAuthenticators({
      client: fixture.client,
      ...fixture.config,
    });
    return createMcpEndpoint({
      origin,
      oauth: {
        authorizationServerUrl: "https://auth.invalid",
        scopes: ["commerce:invoke"],
        authenticate: auth.authenticateMcpToken,
        hostOf: async () => host,
      },
      checkouts: () => crossmint.checkouts,
    });
  }

  async function connect(
    host: AppHost | null,
    mode: "legacy" | "auto" = "legacy",
  ) {
    const target = endpoint(host);
    const client = new Client(
      { name: "test-host", version: "1.0.0" },
      { versionNegotiation: { mode } },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
        fetch: (url, init) => target.fetch(new Request(url, init)),
        requestInit: {
          headers: { authorization: `Bearer ${await fixture.sign()}` },
        },
      }),
    );
    return client;
  }

  async function call(
    client: Client,
    name: string,
    args: Record<string, unknown> = {},
  ) {
    return (await client.callTool({ name, arguments: args })) as Result;
  }

  describe.each(["legacy", "auto"] as const)("over %s protocol", (mode) => {
    let client: Client;
    beforeAll(async () => {
      crossmint = fakeCrossmint();
      client = await connect("chatgpt", mode);
    });
    afterAll(async () => client?.close());

    it("advertises the settings tools as a capability extension", () => {
      // auto negotiates 2026-07-28 (server/discover); legacy initializes.
      expect(client.getNegotiatedProtocolVersion()).toEqual(
        mode === "auto" ? "2026-07-28" : expect.stringMatching(/^2025-/),
      );
      const capability = {
        readTool: "settings_read",
        updateTool: "settings_update",
      };
      const capabilities = client.getServerCapabilities();
      expect(capabilities?.extensions?.["openai/settings"]).toEqual(capability);
      expect(capabilities?.experimental?.["openai/settings"]).toEqual(
        capability,
      );
    });

    it("reads settings as labels, never IDs, streets or names", async () => {
      const result = await call(client, "settings_read");
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        schema: {
          type: "object",
          properties: {
            defaultAddress: {
              type: "string",
              title: "Default for my deliveries",
              description: expect.stringContaining("send it to Work"),
              enum: ["Home", "Mom", "None"],
            },
          },
          required: ["defaultAddress"],
        },
        values: { defaultAddress: "Home" },
        layout: [
          {
            kind: "group",
            title: "Cards · saved by Crossmint",
            items: [
              {
                kind: "tool",
                tool: "settings_manage_cards",
                title: "Manage cards",
                description: expect.stringContaining("last 4 digits"),
              },
            ],
          },
          {
            kind: "group",
            title: "Addresses",
            items: [
              { kind: "property", property: "defaultAddress" },
              {
                kind: "tool",
                tool: "settings_add_address",
                title: "Add an address",
                description: expect.any(String),
              },
            ],
          },
          {
            kind: "group",
            title: "Store sign-ins",
            items: [
              {
                kind: "tool",
                tool: "settings_sign_out_stores",
                title: "Sign out of all stores",
                description: expect.stringContaining(
                  "Stores remember you between checkouts",
                ),
              },
            ],
          },
        ],
      });
      const output = JSON.stringify(result);
      for (const secret of ["STREET_CANARY", "PROFILE_ID_CANARY", "Lovelace"]) {
        expect(output).not.toContain(secret);
      }
      // Always as the token's user.
      expect(crossmint.calls.length).toBeGreaterThan(0);
      expect(new Set(crossmint.calls.map((item) => item.user))).toEqual(
        new Set([fixture.userId]),
      );
    });

    it("declares the spec's tool shapes: {} in, outputSchema out, app-only", async () => {
      const { tools } = await client.listTools();
      const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
      for (const name of SETTINGS_TOOLS) {
        const tool = byName[name];
        expect(tool, name).toBeDefined();
        expect(tool?.title, name).toEqual(expect.any(String));
        const meta = tool?._meta as
          | { ui?: { visibility?: string[] }; "openai/visibility"?: string }
          | undefined;
        if (
          name === "settings_add_address" ||
          name === "settings_manage_cards"
        ) {
          // They draw a view, and ChatGPT won't render a private tool's
          // widget; they only link to /settings.
          expect(meta?.ui?.visibility, name).toBeUndefined();
          expect(meta?.["openai/visibility"], name).toBeUndefined();
        } else {
          expect(meta, name).toMatchObject({
            ui: { visibility: ["app"] },
            "openai/visibility": "private",
          });
        }
      }
      expect(byName.settings_read?.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
      expect(byName.settings_read?.annotations?.readOnlyHint).toBe(true);
      expect(byName.settings_read?.outputSchema).toMatchObject({
        type: "object",
        required: expect.arrayContaining(["schema", "values"]),
      });
      expect(byName.settings_update?.inputSchema).toMatchObject({
        type: "object",
        required: ["set"],
      });
      expect(byName.settings_update?.outputSchema).toMatchObject({
        required: ["values"],
      });
      // Buttons take {}; the two links open the account view.
      for (const name of [
        "settings_manage_cards",
        "settings_add_address",
        "settings_sign_out_stores",
      ]) {
        expect(byName[name]?.inputSchema, name).toMatchObject({
          type: "object",
        });
        const schema = byName[name]?.inputSchema as
          | { properties?: object }
          | undefined;
        expect(Object.keys(schema?.properties ?? {})).toEqual([]);
        // No settings entrypoint (removed in mcp-extensions 0.2.0): ChatGPT
        // drew no button for a tool that declared one.
        const entrypoints = (
          byName[name]?._meta?.["openai/ui"] as
            | { entrypoints?: { type?: string }[] }
            | undefined
        )?.entrypoints;
        expect(
          entrypoints?.some((entrypoint) => entrypoint.type === "settings"),
          name,
        ).not.toBe(true);
      }
      for (const name of ["settings_manage_cards", "settings_add_address"]) {
        expect(byName[name]?._meta, name).toMatchObject({
          ui: { resourceUri: "ui://oca/account" },
          "openai/outputTemplate": "ui://oca/account",
        });
      }
      expect(byName.settings_sign_out_stores?._meta?.ui).toEqual({
        visibility: ["app"],
      });
    });

    it("sets the default by label and reads it back", async () => {
      const result = await call(client, "settings_update", {
        set: { defaultAddress: "Mom" },
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        values: { defaultAddress: "Mom" },
      });
      expect(crossmint.state.defaultId).toBe(`${PROFILE_ID}-2`);
      const read = await call(client, "settings_read");
      expect(read.structuredContent?.values).toEqual({
        defaultAddress: "Mom",
      });
    });

    it("clears the default with None, the same as Remove default", async () => {
      const result = await call(client, "settings_update", {
        set: { defaultAddress: "None" },
      });
      expect(result.structuredContent).toEqual({
        values: { defaultAddress: "None" },
      });
      expect(crossmint.state.defaultId).toBeNull();
      // Nothing to clear: no write.
      const writes = crossmint.calls.filter(
        (item) => item.op === "set-default",
      ).length;
      await call(client, "settings_update", {
        set: { defaultAddress: "None" },
      });
      expect(
        crossmint.calls.filter((item) => item.op === "set-default"),
      ).toHaveLength(writes);
      crossmint.state.defaultId = `${PROFILE_ID}-1`;
    });

    it("refuses a label that isn't saved, and anything but defaultAddress", async () => {
      const unknown = await call(client, "settings_update", {
        set: { defaultAddress: "Cabin" },
      });
      expect(unknown.isError).toBe(true);
      expect(unknown.content[0]?.text).toContain("Cabin");
      expect(crossmint.state.defaultId).toBe(`${PROFILE_ID}-1`);
      for (const args of [
        {},
        { set: {} },
        { set: { defaultAddress: "Home", other: true } },
        { set: { defaultAddress: "Home" }, userId: fixture.otherUserId },
      ]) {
        const result = await call(client, "settings_update", args);
        expect(result.isError, JSON.stringify(args)).toBe(true);
      }
      expect(crossmint.state.defaultId).toBe(`${PROFILE_ID}-1`);
    });

    it("links Manage cards and Add an address to /settings, with its copy", async () => {
      const cards = await call(client, "settings_manage_cards");
      expect(cards.structuredContent).toEqual({
        section: "cards",
        title: "Cards · saved by Crossmint",
        text: expect.stringContaining("You approve every spending limit."),
        action: "Manage cards",
        url: `${origin}/wallet#cards`,
      });
      const address = await call(client, "settings_add_address");
      expect(address.structuredContent).toMatchObject({
        section: "add-address",
        title: "Addresses",
        text: expect.stringContaining("Add where orders should be delivered."),
        action: "Add an address",
        url: `${origin}/addresses#add-address`,
      });
    });

    it("serves the account view self-contained, linking only to our origin", async () => {
      const read = await client.readResource({
        uri: "ui://oca/account",
      });
      const content = read.contents[0] as {
        mimeType?: string;
        text?: string;
        _meta?: Record<string, unknown>;
      };
      expect(content.mimeType).toBe("text/html;profile=mcp-app");
      expect(content.text).toContain(
        `<meta name="oca-origin" content="${origin}">`,
      );
      expect(content.text).toContain("ui/open-link");
      expect(content.text).not.toMatch(/<script[^>]+src=/);
      expect(content._meta).toMatchObject({
        ui: {
          csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
        },
        "openai/widgetCSP": { redirect_domains: [origin] },
      });
    });

    it("signs out of all stores like /api/store-sign-ins, as a tooltip line", async () => {
      crossmint.state.browserProfile = true;
      const result = await call(client, "settings_sign_out_stores");
      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toBe(
        "Signed out of all stores. The next checkout starts fresh.",
      );
      expect(crossmint.calls.at(-1)).toEqual({
        op: "clear-sign-ins",
        user: fixture.userId,
        id: "browser-1",
      });
      const again = await call(client, "settings_sign_out_stores");
      expect(again.content[0]?.text).toBe("No saved store sign-ins.");
      const read = await call(client, "settings_read");
      expect(JSON.stringify(read.structuredContent)).toContain(
        "No saved store sign-ins",
      );
    });

    it("reports Crossmint errors as tool errors without values", async () => {
      crossmint.state.failAddresses = true;
      const read = await call(client, "settings_read");
      expect(read.isError).toBe(true);
      const update = await call(client, "settings_update", {
        set: { defaultAddress: "Home" },
      });
      expect(update.isError).toBe(true);
      crossmint.state.failAddresses = false;
    });
  });

  it.each([[null], ["claude" as const]])(
    "offers no settings to %s hosts",
    async (host) => {
      crossmint = fakeCrossmint();
      const client = await connect(host);
      const { tools } = await client.listTools();
      expect(tools.filter((tool) => tool.name.startsWith("settings_"))).toEqual(
        [],
      );
      expect(
        client.getServerCapabilities()?.extensions?.["openai/settings"],
      ).toBeUndefined();
      await expect(
        call(client, "settings_update", { set: { defaultAddress: "Mom" } }),
      ).rejects.toThrow("not found");
      expect(crossmint.state.defaultId).toBe(`${PROFILE_ID}-1`);
      await client.close();
    },
  );

  it("offers settings to a local dev host", async () => {
    crossmint = fakeCrossmint();
    const client = await connect("local");
    const { tools } = await client.listTools();
    expect(
      tools
        .map((tool) => tool.name)
        .filter((name) => name.startsWith("settings_"))
        .sort(),
    ).toEqual(SETTINGS_TOOLS);
    await client.close();
  });
});

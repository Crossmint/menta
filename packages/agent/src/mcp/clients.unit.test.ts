import { EXTENSION_ID } from "@modelcontextprotocol/ext-apps/server";
import { describe, expect, it, vi } from "vitest";
import {
  type ClientRecord,
  type ClientStore,
  createClientCards,
  createMemoryClientStore,
  createSqlClientStore,
  declaredCards,
  declaresCards,
  GROK_BOT_CLIENT_NAME,
  isGrokBot,
  MCP_APPS_EXTENSION,
} from "./clients.js";

const ui = { extensions: { [MCP_APPS_EXTENSION]: { mimeTypes: [] } } };
const capabilitiesKey = "io.modelcontextprotocol/clientCapabilities";

describe("which clients draw cards", () => {
  it("uses the MCP Apps extension ID", () => {
    expect(MCP_APPS_EXTENSION).toBe(EXTENSION_ID);
  });

  it("counts only a declared MCP Apps extension", () => {
    expect(declaresCards(ui)).toBe(true);
    for (const capabilities of [
      undefined,
      null,
      {},
      { elicitation: {} },
      { extensions: {} },
      { extensions: { [MCP_APPS_EXTENSION]: true } },
      { extensions: { "openai/elicitation": { form: {} } } },
    ]) {
      expect(declaresCards(capabilities)).toBe(false);
    }
  });

  it("reads a 2026-07-28 request's own capabilities", () => {
    const request = (capabilities: unknown) => ({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "x", _meta: { [capabilitiesKey]: capabilities } },
    });
    expect(declaredCards(request(ui))).toEqual({
      cards: true,
      initialize: false,
      name: null,
    });
    expect(declaredCards(request({ elicitation: {} }))).toEqual({
      cards: false,
      initialize: false,
      name: null,
    });
  });

  it("reads a 2025-era initialize, to record", () => {
    // Grok Bot's initialize: clientInfo Cursor, elicitation and nothing else.
    const grokBot = {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        clientInfo: { name: "Cursor", version: "1.0.0" },
        capabilities: { elicitation: {} },
      },
    };
    expect(declaredCards(grokBot)).toEqual({
      cards: false,
      initialize: true,
      name: "Cursor",
    });
    expect(
      declaredCards([
        { ...grokBot, params: { ...grokBot.params, capabilities: ui } },
      ]),
    ).toEqual({ cards: true, initialize: true, name: "Cursor" });
    expect(
      declaredCards({
        ...grokBot,
        params: { ...grokBot.params, clientInfo: { name: "x".repeat(300) } },
      })?.name,
    ).toHaveLength(100);
    expect(
      declaredCards({
        ...grokBot,
        params: { ...grokBot.params, clientInfo: undefined },
      })?.name,
    ).toBeNull();
  });

  it("says nothing for later 2025-era requests and odd bodies", () => {
    for (const body of [
      null,
      "x",
      [],
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      { jsonrpc: "2.0", method: "notifications/initialized" },
    ]) {
      expect(declaredCards(body)).toBeNull();
    }
  });
});

describe("telling Grok Bot apart", () => {
  it("is clientInfo Cursor without MCP Apps", () => {
    expect(GROK_BOT_CLIENT_NAME).toBe("Cursor");
    expect(isGrokBot({ cards: false, name: "Cursor" })).toBe(true);
    // Cursor's IDE draws cards (2.6+) and names itself differently.
    expect(isGrokBot({ cards: true, name: "Cursor" })).toBe(false);
    expect(isGrokBot({ cards: false, name: "cursor-vscode" })).toBe(false);
    expect(isGrokBot({ cards: false, name: null })).toBe(false);
    expect(isGrokBot(null)).toBe(false);
  });

  it("is Cursor signing in through Cursor's hosted agents, whatever it declares", () => {
    expect(
      isGrokBot({ cards: true, name: "Cursor" }, { cursorAgent: true }),
    ).toBe(true);
    expect(
      isGrokBot({ cards: true, name: "cursor-vscode" }, { cursorAgent: true }),
    ).toBe(false);
  });
});

const grok: ClientRecord = { cards: false, name: "Cursor" };
const ide: ClientRecord = { cards: true, name: "cursor-vscode" };

describe("recorded clients", () => {
  it("round-trips through the memory store", async () => {
    const store = createMemoryClientStore();
    expect(await store.client("grok-bot")).toBeNull();
    await store.setClient("grok-bot", grok);
    await store.setClient("cursor", ide);
    expect(await store.client("grok-bot")).toEqual(grok);
    expect(await store.client("cursor")).toEqual(ide);
    await store.setClient("grok-bot", { cards: true, name: "Cursor" });
    expect(await store.client("grok-bot")).toEqual({
      cards: true,
      name: "Cursor",
    });
  });

  it("round-trips through SQL, writing only the ID, a boolean and the name", async () => {
    const rows = new Map<string, ClientRecord>();
    const seen: { text: string; parameters: readonly unknown[] }[] = [];
    const store = createSqlClientStore(async (text, parameters) => {
      seen.push({ text, parameters });
      const [clientId, cards, name] = parameters as [
        string,
        boolean | undefined,
        string | null | undefined,
      ];
      if (text.startsWith("INSERT")) {
        rows.set(clientId, { cards: cards === true, name: name ?? null });
        return [];
      }
      const row = rows.get(clientId);
      return row ? [{ draws_cards: row.cards, client_name: row.name }] : [];
    });
    expect(await store.client("grok-bot")).toBeNull();
    await store.setClient("grok-bot", grok);
    expect(await store.client("grok-bot")).toEqual(grok);
    await store.setClient("grok-bot", { cards: true, name: null });
    expect(await store.client("grok-bot")).toEqual({ cards: true, name: null });
    expect(seen.map((item) => item.parameters)).toContainEqual([
      "grok-bot",
      false,
      "Cursor",
    ]);
    expect(seen.every((item) => item.text.includes("mcp_clients"))).toBe(true);
  });
});

describe("the per-instance cache", () => {
  function counting(store: ClientStore = createMemoryClientStore()) {
    const reads = vi.fn(store.client);
    const writes = vi.fn(store.setClient);
    return {
      reads,
      writes,
      store: { client: reads, setClient: writes },
    };
  }

  it("answers from what it recorded, and writes it through", async () => {
    const { reads, writes, store } = counting();
    const cards = createClientCards(store);
    await cards.record("cursor", ide);
    expect(writes).toHaveBeenCalledWith("cursor", ide);
    expect(await cards.lookup("cursor")).toEqual(ide);
    expect(reads).not.toHaveBeenCalled();
  });

  it("reads what another instance recorded once, then from memory", async () => {
    const shared = createMemoryClientStore();
    await createClientCards(shared).record("grok-bot", grok);
    const { reads, store } = counting(shared);
    const cards = createClientCards(store);
    expect(await cards.lookup("grok-bot")).toEqual(grok);
    expect(await cards.lookup("grok-bot")).toEqual(grok);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("reads the store again after the TTL", async () => {
    let now = 0;
    const shared = createMemoryClientStore();
    const { reads, store } = counting(shared);
    const cards = createClientCards(store, { ttlMs: 1000, now: () => now });
    await shared.setClient("cursor", grok);
    expect(await cards.lookup("cursor")).toEqual(grok);
    await shared.setClient("cursor", ide);
    now = 999;
    expect(await cards.lookup("cursor")).toEqual(grok);
    now = 1000;
    expect(await cards.lookup("cursor")).toEqual(ide);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it("doesn't cache an unknown client: its initialize may land elsewhere", async () => {
    const shared = createMemoryClientStore();
    const cards = createClientCards(shared);
    expect(await cards.lookup("new")).toBeNull();
    await shared.setClient("new", ide);
    expect(await cards.lookup("new")).toEqual(ide);
  });

  it("works without a store, on this instance only", async () => {
    const cards = createClientCards(null);
    expect(await cards.lookup("cursor")).toBeNull();
    await cards.record("cursor", ide);
    expect(await cards.lookup("cursor")).toEqual(ide);
  });

  it("never throws when the store fails, and ignores unusable IDs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken: ClientStore = {
      client: async () => {
        throw new Error("down");
      },
      setClient: async () => {
        throw new Error("down");
      },
    };
    const cards = createClientCards(broken);
    expect(await cards.lookup("cursor")).toBeNull();
    await expect(cards.record("cursor", grok)).resolves.toBeUndefined();
    expect(await cards.lookup("cursor")).toEqual(grok);
    const empty = createMemoryClientStore();
    const guarded = createClientCards(empty);
    await guarded.record("", ide);
    await guarded.record("x".repeat(3000), ide);
    expect(empty.rows.size).toBe(0);
    warn.mockRestore();
  });
});

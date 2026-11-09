import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ClientStore, createSqlClientStore } from "./clients.js";

/**
 * The client store and migration against a real, disposable Postgres. Opt-in,
 * like event-store.db.test.ts: set OCA_TEST_DATABASE_URL (never a shared
 * database). Each run works in its own schema and drops it afterwards.
 */
const databaseUrl = process.env.OCA_TEST_DATABASE_URL;
const migrations = new URL("../../../../migrations/", import.meta.url);

describe.skipIf(!databaseUrl)("MCP clients in Postgres", () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  const schema = `test_clients_${randomBytes(6).toString("hex")}`;
  let store: ClientStore;

  async function migrate() {
    // Same statement split as scripts/migrate.mjs.
    for (const file of (await readdir(migrations)).sort()) {
      const text = await readFile(new URL(file, migrations), "utf8");
      for (const statement of text.split(";").map((part) => part.trim())) {
        if (statement) {
          await client.query(statement);
        }
      }
    }
  }

  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await migrate();
    // Migrations are re-run on every deploy.
    await migrate();
    store = createSqlClientStore(
      async (text, parameters) =>
        (await client.query(text, [...parameters])).rows,
    );
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });

  it("records what a client declared and updates it", async () => {
    const grok = { cards: false, name: "Cursor" };
    expect(await store.client("grok-bot")).toBeNull();
    await store.setClient("grok-bot", grok);
    expect(await store.client("grok-bot")).toEqual(grok);
    await store.setClient("grok-bot", grok);
    await store.setClient("grok-bot", { cards: true, name: "Cursor" });
    expect(await store.client("grok-bot")).toEqual({
      cards: true,
      name: "Cursor",
    });
    await store.setClient("grok-bot", { cards: true, name: null });
    expect(await store.client("grok-bot")).toEqual({ cards: true, name: null });
    const url = "https://example.invalid/oauth/client.json";
    await store.setClient(url, { cards: true, name: "ChatGPT" });
    expect(await store.client(url)).toEqual({ cards: true, name: "ChatGPT" });
    const { rows } = await client.query(
      "SELECT count(*)::int AS n FROM mcp_clients",
    );
    expect(rows[0]?.n).toBe(2);
  });
});

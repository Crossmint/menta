import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createRoutineKeyBox,
  createSqlRoutineStore,
  type RoutineStore,
} from "./grok-bot.js";

/**
 * The Grok Bot routine store and migration against a real, disposable
 * Postgres. Opt-in, like event-store.db.test.ts: set OCA_TEST_DATABASE_URL
 * (never a shared database). Each run works in its own schema and drops it.
 */
const databaseUrl = process.env.OCA_TEST_DATABASE_URL;
const migrations = new URL("../../../../migrations/", import.meta.url);
const KEY = "grok-routine-key-4f2a";

describe.skipIf(!databaseUrl)("Grok Bot routines in Postgres", () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  const schema = `test_grok_${randomBytes(6).toString("hex")}`;
  let store: RoutineStore;

  async function migrate() {
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
    store = createSqlRoutineStore(
      async (text, parameters) =>
        (await client.query(text, [...parameters])).rows,
      createRoutineKeyBox("server-secret"),
    );
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });

  it("saves the key sealed and reads it back", async () => {
    expect(await store.get("u1")).toBeNull();
    await store.save("u1", {
      url: "https://hooks.invalid/a",
      key: KEY,
      keyHint: "4f2a",
    });
    expect(await store.get("u1")).toMatchObject({
      url: "https://hooks.invalid/a",
      key: KEY,
      keyHint: "4f2a",
      enabled: true,
      seen: {},
      watches: {},
    });
    const { rows } = await client.query(
      "SELECT key_sealed FROM grok_bot_routines WHERE user_id = 'u1'",
    );
    expect(String(rows[0]?.key_sealed)).not.toContain(KEY);
    // Another server secret can't open it.
    const other = createSqlRoutineStore(
      async (text, parameters) =>
        (await client.query(text, [...parameters])).rows,
      createRoutineKeyBox("another-secret"),
    );
    expect((await other.get("u1"))?.key).toBeNull();
  });

  it("adopts runs, claims each state once, and keeps Grok Bot's reads", async () => {
    await store.noteRead("u1", "run-1", { k: "running:", t: 100, g: 100 }, 0);
    await store.noteRead("u2", "run-1", { k: "running:", t: 100, g: 100 }, 0);
    expect(await store.get("u2")).toBeNull();
    // Grok Bot read it at 100: no claim while it's following (quiet since 120).
    expect(
      await store.claim("u1", "run-1", "running:", { k: "x:1", t: 130 }, 90),
    ).toBe(false);
    expect(
      await store.claim(
        "u1",
        "run-1",
        "running:",
        { k: "awaiting_input:req", t: 200, g: 100 },
        150,
      ),
    ).toBe(true);
    // Only one caller moves a state.
    expect(
      await store.claim(
        "u1",
        "run-1",
        "running:",
        { k: "awaiting_input:req", t: 200 },
        150,
      ),
    ).toBe(false);
    // A failed delivery moves it back without the quiet check.
    expect(
      await store.claim(
        "u1",
        "run-1",
        "awaiting_input:req",
        { k: "running:", t: 100, g: 100 },
        null,
      ),
    ).toBe(true);
    expect((await store.get("u1"))?.seen["run-1"]).toEqual({
      k: "running:",
      t: 100,
      g: 100,
    });
    // Old runs are forgotten on the next note.
    await store.noteRead("u1", "run-2", { k: "running:", t: 500, g: 500 }, 400);
    expect(Object.keys((await store.get("u1"))?.seen ?? {})).toEqual(["run-2"]);
  });

  it("leases one follower per run", async () => {
    expect(await store.lease("u1", "run-2", { c: "a", u: 1_000 }, 500)).toBe(
      true,
    );
    expect(await store.lease("u1", "run-2", { c: "b", u: 1_000 }, 600)).toBe(
      false,
    );
    // The same chain renews; an expired lease is free.
    expect(await store.lease("u1", "run-2", { c: "a", u: 2_000 }, 700)).toBe(
      true,
    );
    expect(await store.lease("u1", "run-2", { c: "b", u: 3_000 }, 2_500)).toBe(
      true,
    );
    await store.release("u1", "run-2", "a");
    expect((await store.get("u1"))?.watches).toEqual({
      "run-2": { c: "b", u: 3_000 },
    });
    await store.release("u1", "run-2", "b");
    expect((await store.get("u1"))?.watches).toEqual({});
  });

  it("records deliveries, turns off and on, and forgets on remove", async () => {
    await store.recordDelivery(
      "u1",
      "http_4xx",
      Date.parse("2026-10-07T00:00:00Z"),
    );
    expect(await store.get("u1")).toMatchObject({
      lastError: "http_4xx",
      lastAttemptAt: Date.parse("2026-10-07T00:00:00Z"),
    });
    await store.recordDelivery("u1", null, Date.parse("2026-10-07T00:01:00Z"));
    expect(await store.get("u1")).toMatchObject({
      lastError: null,
      lastDeliveryAt: Date.parse("2026-10-07T00:01:00Z"),
      lastAttemptAt: Date.parse("2026-10-07T00:01:00Z"),
    });
    expect(await store.setEnabled("u1", false)).toBe(true);
    expect(await store.lease("u1", "run-3", { c: "a", u: 9_000 }, 1)).toBe(
      false,
    );
    expect(await store.setEnabled("nobody", true)).toBe(false);
    // Saving again turns it back on and keeps what it knows.
    await store.save("u1", {
      url: "https://hooks.invalid/b",
      key: `${KEY}-2`,
      keyHint: "a-2",
    });
    expect(await store.get("u1")).toMatchObject({
      enabled: true,
      url: "https://hooks.invalid/b",
      lastError: null,
      lastAttemptAt: null,
    });
    expect(Object.keys((await store.get("u1"))?.seen ?? {})).toEqual(["run-2"]);
    await store.remove("u1");
    expect(await store.get("u1")).toBeNull();
  });

  it("offers updates once per user", async () => {
    expect(await store.offer("u-offer")).toBe(true);
    expect(await store.offer("u-offer")).toBe(false);
    expect(await store.offer("u-offer-2")).toBe(true);
  });

  it("records client names next to whether they draw cards", async () => {
    await client.query(
      "INSERT INTO mcp_clients (client_id, draws_cards, client_name) VALUES ('c', false, 'Cursor')",
    );
    const { rows } = await client.query(
      "SELECT client_name FROM mcp_clients WHERE client_id = 'c'",
    );
    expect(rows[0]?.client_name).toBe("Cursor");
  });
});

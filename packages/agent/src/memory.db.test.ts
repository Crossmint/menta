import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createSqlMemoryStore,
  MemoryLimitError,
  type MemoryStore,
} from "./memory.js";

const databaseUrl = process.env.OCA_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("Shared memory in Postgres", () => {
  const db = new pg.Client({ connectionString: databaseUrl });
  const schema = `test_memory_${randomBytes(6).toString("hex")}`;
  let store: MemoryStore;
  beforeAll(async () => {
    await db.connect();
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    const migration = await readFile(
      new URL("../../../migrations/0008_user_memories.sql", import.meta.url),
      "utf8",
    );
    await db.query(migration);
    await db.query(migration);
    store = createSqlMemoryStore(
      async (text, parameters) => (await db.query(text, [...parameters])).rows,
    );
  });
  afterAll(async () => {
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await db.end();
  });

  it("persists notes across store instances and isolates reads, edits and deletions by user", async () => {
    const saved = await store.save("alice", "My usual is an oat flat white.");
    const next = createSqlMemoryStore(
      async (text, parameters) => (await db.query(text, [...parameters])).rows,
    );
    expect(await next.read("alice")).toEqual([saved]);
    expect(await next.read("bob")).toEqual([]);
    await next.edit("bob", saved.id, "Someone else's note");
    await next.remove("bob", saved.id);
    await next.clear("bob");
    expect(await store.read("alice")).toEqual([saved]);
    await next.edit("alice", saved.id, "My usual is a cortado.");
    expect(await store.read("alice")).toEqual([
      { ...saved, text: "My usual is a cortado." },
    ]);
    await store.remove("alice", saved.id);
    await store.remove("alice", saved.id);
    expect(await store.read("alice")).toEqual([]);
  });

  it("merges concurrent saves, deduplicates retried saves, and never reuses deleted IDs", async () => {
    const saved = await Promise.all([
      store.save("concurrent", "First note"),
      store.save("concurrent", "Second note"),
      store.save("concurrent", "First note"),
    ]);
    expect(
      (await store.read("concurrent")).map((entry) => entry.text).sort(),
    ).toEqual(["First note", "Second note"]);
    expect(saved[0].id).toBe(saved[2].id);
    await store.clear("concurrent");
    const fresh = await store.save("concurrent", "First note");
    expect(fresh.id).not.toBe(saved[0].id);
    await store.remove("concurrent", saved[0].id);
    expect(await store.read("concurrent")).toEqual([fresh]);
  });

  it("does not restore a removed note when another chat saves concurrently", async () => {
    const old = await store.save("remove-race", "Outdated note");
    await Promise.all([
      store.save("remove-race", "New note"),
      store.remove("remove-race", old.id),
    ]);
    expect(
      (await store.read("remove-race")).map((entry) => entry.text),
    ).toEqual(["New note"]);
  });

  it("bounds recall without silently truncating notes and recovers space after forgetting", async () => {
    const first = await store.save("full", "a".repeat(2000));
    await store.save("full", "b".repeat(2000));
    await store.save("full", "c".repeat(2000));
    await expect(store.save("full", "d".repeat(2000))).rejects.toBeInstanceOf(
      MemoryLimitError,
    );
    expect(await store.read("full")).toHaveLength(3);
    await store.remove("full", first.id);
    await store.save("full", "d".repeat(2000));
    expect(await store.read("full")).toHaveLength(3);
  });
});

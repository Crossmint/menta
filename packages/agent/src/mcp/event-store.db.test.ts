import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createSecretBox,
  createSqlEventStore,
  type EventStore,
  type NewSubscription,
} from "./event-store.js";

/**
 * The SQL store and migration against a real, disposable Postgres. Opt-in:
 * set OCA_TEST_DATABASE_URL (never a shared database), e.g.
 *   docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:17-alpine
 *   OCA_TEST_DATABASE_URL=postgres://postgres:test@127.0.0.1:55432/postgres pnpm test
 * Each run works in its own schema and drops it afterwards.
 */
const databaseUrl = process.env.OCA_TEST_DATABASE_URL;
const migrations = new URL("../../../../migrations/", import.meta.url);
const secret = `whsec_${Buffer.alloc(32, 3).toString("base64")}`;
const T0 = Date.parse("2026-10-05T12:00:00.000Z");

describe.skipIf(!databaseUrl)("MCP event subscriptions in Postgres", () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  const schema = `test_events_${randomBytes(6).toString("hex")}`;
  let store: EventStore;

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

  const subscription = (
    overrides: Partial<NewSubscription> = {},
  ): NewSubscription => ({
    id: "sub_a",
    userId: "user-1",
    name: "checkout.needs_you",
    runId: "run-1",
    url: "https://hooks.example.com/cb",
    host: "chatgpt",
    secret,
    previousSecret: null,
    previousUntil: null,
    expiresAt: T0 + 120_000,
    createdAt: T0,
    verifiedAt: T0,
    seen: { "run-1": { k: "running:", t: 1 } },
    ...overrides,
  });

  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await migrate();
    // Migrations are re-run on every deploy.
    await migrate();
    store = createSqlEventStore(
      async (text, parameters) =>
        (await client.query(text, [...parameters])).rows,
      createSecretBox("server-secret"),
    );
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });

  it("stores a subscription with its secret sealed", async () => {
    await store.save(subscription());
    const saved = await store.get("sub_a");
    expect(saved).toMatchObject({
      id: "sub_a",
      userId: "user-1",
      runId: "run-1",
      secret,
      expiresAt: T0 + 120_000,
      createdAt: T0,
      seen: { "run-1": { k: "running:", t: 1 } },
      lastDeliveryAt: null,
    });
    const { rows } = await client.query(
      "SELECT secret FROM mcp_event_subscriptions WHERE id = 'sub_a'",
    );
    expect(String(rows[0]?.secret)).toMatch(/^v1\./);
    expect(String(rows[0]?.secret)).not.toContain(secret.slice(6, 20));
  });

  it("refreshes in place, keeping what deliveries recorded", async () => {
    await store.markSeen("sub_a", { "run-2": { k: "succeeded:", t: 2 } });
    const next = `whsec_${Buffer.alloc(32, 4).toString("base64")}`;
    await store.save(
      subscription({
        secret: next,
        previousSecret: secret,
        previousUntil: T0 + 300_000,
        expiresAt: T0 + 240_000,
        createdAt: T0 + 999,
        seen: {},
      }),
    );
    expect(await store.get("sub_a")).toMatchObject({
      secret: next,
      previousSecret: secret,
      previousUntil: T0 + 300_000,
      expiresAt: T0 + 240_000,
      createdAt: T0,
      seen: {
        "run-1": { k: "running:", t: 1 },
        "run-2": { k: "succeeded:", t: 2 },
      },
    });
  });

  it("never lets another user overwrite a subscription", async () => {
    await store.save(
      subscription({ userId: "user-2", url: "https://evil.example/cb" }),
    );
    expect((await store.get("sub_a"))?.userId).toBe("user-1");
  });

  it("finds live subscriptions covering a run", async () => {
    await store.save(subscription({ id: "sub_all", runId: null }));
    await store.save(subscription({ id: "sub_other_run", runId: "run-9" }));
    await store.save(subscription({ id: "sub_expired", expiresAt: T0 - 1 }));
    await store.save(subscription({ id: "sub_user2", userId: "user-2" }));
    const ids = (await store.covering("user-1", "run-1", T0))
      .map((item) => item.id)
      .sort();
    expect(ids).toEqual(["sub_a", "sub_all"]);
    expect(await store.count("user-1", T0)).toBe(3);
  });

  it("remembers verification per user and URL", async () => {
    expect(
      await store.verifiedAt("user-1", "https://hooks.example.com/cb"),
    ).toBe(T0);
    expect(
      await store.verifiedAt("user-3", "https://hooks.example.com/cb"),
    ).toBe(null);
  });

  it("records delivery failures and recovery", async () => {
    await store.recordDelivery("sub_a", "http_5xx", T0 + 10);
    await store.recordDelivery("sub_a", "timeout", T0 + 20);
    expect(await store.get("sub_a")).toMatchObject({
      lastError: "timeout",
      failedSince: T0 + 10,
    });
    await store.recordDelivery("sub_a", null, T0 + 30);
    expect(await store.get("sub_a")).toMatchObject({
      lastError: null,
      failedSince: null,
      lastDeliveryAt: T0 + 30,
    });
  });

  it("replaces seen when pruning", async () => {
    await store.replaceSeen("sub_a", { "run-3": { k: "failed:", t: 3 } });
    expect((await store.get("sub_a"))?.seen).toEqual({
      "run-3": { k: "failed:", t: 3 },
    });
  });

  it("removes only the user's own subscription, and purges expired ones", async () => {
    await store.remove("user-2", "sub_a");
    expect(await store.get("sub_a")).not.toBeNull();
    await store.remove("user-1", "sub_a");
    expect(await store.get("sub_a")).toBeNull();
    await store.purge(T0);
    expect(await store.get("sub_expired")).toBeNull();
    expect(await store.get("sub_all")).not.toBeNull();
  });

  it("returns null for a secret sealed under another key", async () => {
    const other = createSqlEventStore(
      async (text, parameters) =>
        (await client.query(text, [...parameters])).rows,
      createSecretBox("rotated-server-secret"),
    );
    expect((await other.get("sub_all"))?.secret).toBe(null);
  });
});

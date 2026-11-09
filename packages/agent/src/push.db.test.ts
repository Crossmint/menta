import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  checkoutPush,
  createSqlPushStore,
  createWebPush,
  type PushStore,
  pushSubscriptionSchema,
} from "./push.js";

const subscription = (name: string) => ({
  endpoint: `https://fcm.googleapis.com/wp/${name}`,
  keys: {
    p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString(
      "base64url",
    ),
    auth: Buffer.alloc(16, 2).toString("base64url"),
  },
});
const view = (status = "running", pending: CheckoutView["pending"] = null) =>
  ({
    runId: "run",
    startUrl: "https://www.starbucks.com/order?token=PRIVATE_URL",
    store: "starbucks.com",
    status,
    pending,
    task: "PRIVATE_TASK",
    liveViewUrl: "https://uc.crossmint.com/private",
    result: null,
  }) as CheckoutView;
const question = {
  kind: "question",
  requestId: "request-1",
  question: "PRIVATE_QUESTION",
  fields: [],
  expiresAt: null,
} as const;

describe("notification content and endpoints", () => {
  it("sends repeat tests as distinct notifications", async () => {
    const store: PushStore = {
      save: vi.fn(),
      enrollment: vi.fn(),
      has: vi.fn(),
      devices: vi.fn(async () => [
        { id: "device", subscription: subscription("test") },
      ]),
      remove: vi.fn(),
      claim: vi.fn(),
      finish: vi.fn(),
    };
    const send = vi.fn<Parameters<typeof createWebPush>[1]>(async () => ({}));
    const push = createWebPush(store, send);
    await push.test("owner", "device");
    await push.test("owner", "device");
    expect(send).toHaveBeenCalledTimes(2);
    const tags = send.mock.calls.map((call) => call[1].tag);
    expect(tags[0]).toMatch(/^oca-test-/);
    expect(tags[1]).toMatch(/^oca-test-/);
    expect(tags[0]).not.toBe(tags[1]);
  });

  it("only notifies for attention or outcomes, without private content", () => {
    expect(checkoutPush(view(), "chat")).toBeNull();
    expect(checkoutPush(view("cancelled"), "chat")).toBeNull();
    expect(
      checkoutPush(view("awaiting_input", question), "chat"),
    ).toMatchObject({
      body: "starbucks.com has a question about your order.",
      url: "/c/chat",
      tag: "oca-run",
    });
    expect(
      JSON.stringify(checkoutPush(view("awaiting_input", question), "chat")),
    ).not.toContain("PRIVATE");
    expect(checkoutPush(view("succeeded"), "chat")?.body).toContain(
      "confirmed",
    );
    expect(
      checkoutPush(
        {
          ...view("failed"),
          result: { failureReason: "reconciliation_required" },
        } as CheckoutView,
        "chat",
      )?.body,
    ).toContain("before buying again");
  });
  it("names the requested choice without exposing the question or field values", () => {
    const pending = {
      ...question,
      fields: [
        {
          key: "PRIVATE_KEY",
          label: "Drink size",
          kind: "choice",
          required: true,
          options: [{ value: "PRIVATE_VALUE", label: "PRIVATE_OPTION" }],
        },
      ],
    } as const;
    const message = checkoutPush(view("awaiting_input", pending), "chat");
    expect(message?.body).toBe("starbucks.com needs your drink size.");
    expect(JSON.stringify(message)).not.toContain("PRIVATE");
    expect(
      checkoutPush(
        view("awaiting_input", {
          ...pending,
          fields: [
            { ...pending.fields[0], label: "Size" },
            { ...pending.fields[0], label: "Color" },
          ],
        }),
        "chat",
      )?.body,
    ).toBe("starbucks.com needs your size and color.");
  });
  it("keeps unknown questions, contact details and masked fields private", () => {
    const field = {
      key: "field",
      label: "Address for PRIVATE_RECIPIENT",
      kind: "text",
      required: true,
    } as const;
    const address = checkoutPush(
      view("awaiting_input", {
        ...question,
        question: "Deliver to PRIVATE_STREET?",
        fields: [field],
      }),
      "chat",
    );
    expect(address?.body).toBe(
      "starbucks.com has a question about your order.",
    );
    expect(JSON.stringify(address)).not.toContain("PRIVATE");
    for (const pending of [
      {
        ...question,
        fields: [{ ...field, label: "Size", sensitive: true as const }],
      },
      { ...question, fields: [{ ...field, label: "Verification code" }] },
      {
        ...question,
        question: "What is your password?",
        fields: [{ ...field, label: "Size" }],
      },
      {
        ...question,
        kind: "protected" as const,
        fields: [],
        standard: [],
        actionUrl: "PRIVATE_ACTION",
      },
    ]) {
      expect(checkoutPush(view("awaiting_input", pending), "chat")?.body).toBe(
        "starbucks.com needs private details. Open Menta to continue securely.",
      );
    }
  });
  it("uses the payment merchant and store-specific outcomes without copying private summaries", () => {
    const payment = {
      ...question,
      kind: "payment",
      amount: { amount: "12.50", currency: "USD", exact: true },
      merchant: {
        name: "Starbucks",
        url: "PRIVATE_MERCHANT_URL",
        countryCode: "US",
      },
      actionUrl: "PRIVATE_ACTION",
    } as const;
    const message = checkoutPush(view("awaiting_input", payment), "chat");
    expect(message?.body).toBe(
      "Your order at Starbucks is ready for payment approval.",
    );
    expect(JSON.stringify(message)).not.toContain("PRIVATE");
    expect(checkoutPush(view("succeeded"), "chat")?.body).toBe(
      "starbucks.com confirmed your order.",
    );
    expect(
      checkoutPush(
        {
          ...view("blocked"),
          result: {
            summary: "PRIVATE_SUMMARY",
            blockedCode: "merchant.checkout_error",
          },
        } as CheckoutView,
        "chat",
      )?.body,
    ).toBe("starbucks.com checkout stopped. Open Menta to see what happened.");
    expect(
      checkoutPush({ ...view("failed"), startUrl: "PRIVATE_URL" }, "chat")
        ?.body,
    ).toBe("The store checkout stopped. Open Menta to see what happened.");
  });
  it("skips expired questions and bounds their lifetime", () => {
    expect(
      checkoutPush(
        view("awaiting_input", {
          ...question,
          expiresAt: "2026-01-01T00:00:00Z",
        }),
        "chat",
      ),
    ).toBeNull();
    const now = Date.now();
    expect(
      checkoutPush(view("awaiting_input", question), "chat", now)?.expiresAt,
    ).toBe(now + 300_000);
  });
  it.each([
    "https://127.0.0.1/wp/x",
    "https://fcm.googleapis.com.evil.invalid/wp/x",
    "https://fcm.googleapis.com:8443/wp/x",
    "http://fcm.googleapis.com/wp/x",
    "https://user@fcm.googleapis.com/wp/x",
  ])("rejects untrusted endpoint %s", (endpoint) => {
    expect(
      pushSubscriptionSchema.safeParse({ ...subscription("x"), endpoint })
        .success,
    ).toBe(false);
  });
  it.each([
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://web.push.apple.com/x",
    "https://wns.notify.windows.com/x",
  ])("accepts browser push provider %s", (endpoint) => {
    expect(
      pushSubscriptionSchema.safeParse({ ...subscription("x"), endpoint })
        .success,
    ).toBe(true);
  });
});

const databaseUrl = process.env.OCA_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)(
  "Desktop notification delivery in Postgres",
  () => {
    const db = new pg.Client({ connectionString: databaseUrl });
    const schema = `test_push_${randomBytes(6).toString("hex")}`;
    let store: PushStore;
    const transaction = async (
      statements: { sql: string; args: readonly unknown[] }[],
    ) => {
      const client = new pg.Client({
        connectionString: databaseUrl,
        options: `-c search_path=${schema}`,
      });
      await client.connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const { sql, args } of statements) {
          results.push((await client.query(sql, [...args])).rows);
        }
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        await client.end();
      }
    };
    beforeAll(async () => {
      await db.connect();
      await db.query(`CREATE SCHEMA ${schema}`);
      await db.query(`SET search_path TO ${schema}`);
      const migration = await readFile(
        new URL("../../../migrations/0009_web_push.sql", import.meta.url),
        "utf8",
      );
      await db.query(migration);
      await db.query(migration);
      store = createSqlPushStore(
        async (sql, args) => (await db.query(sql, [...args])).rows,
        "fixture-secret",
        transaction,
      );
    });
    afterAll(async () => {
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await db.end();
    });
    it("seals subscriptions, preserves device IDs on refresh, and scopes all access to the owner", async () => {
      const id = await store.save("alice", subscription("alice"));
      expect(await store.save("alice", subscription("alice"))).toBe(id);
      expect(await store.has("bob", id)).toBe(false);
      expect(await store.devices("bob")).toEqual([]);
      await store.remove("bob", id);
      expect(await store.has("alice", id)).toBe(true);
      expect(await store.claim("bob", id, "run", "question")).toBe(false);
      const raw = JSON.stringify(
        (
          await db.query("SELECT * FROM web_push_subscriptions WHERE id = $1", [
            id,
          ])
        ).rows,
      );
      expect(raw).not.toContain("fcm.googleapis.com");
      expect(raw).not.toContain(subscription("alice").keys.auth);
      const restarted = createSqlPushStore(
        async (sql, args) => (await db.query(sql, [...args])).rows,
        "fixture-secret",
        transaction,
      );
      expect((await restarted.devices("alice"))[0]?.subscription).toEqual(
        subscription("alice"),
      );
      await store.remove("alice", id);
    });
    it("sends once per question even with concurrent reads and process restarts, and sends again for a new question", async () => {
      const id = await store.save("dedupe", subscription("dedupe"));
      const send = vi.fn(async () => ({}));
      const push = createWebPush(store, send);
      const pending = view("awaiting_input", question);
      await Promise.all([
        push.observe("dedupe", pending, "chat"),
        push.observe("dedupe", pending, "chat"),
      ]);
      await createWebPush(store, send).observe("dedupe", pending, "chat");
      expect(send).toHaveBeenCalledTimes(1);
      await push.observe(
        "dedupe",
        view("awaiting_input", { ...question, requestId: "request-2" }),
        "chat",
      );
      await push.observe("dedupe", view("succeeded"), "chat");
      expect(send).toHaveBeenCalledTimes(3);
      expect(await store.claim("dedupe", id, "run", "succeeded:")).toBe(false);
      await store.remove("dedupe", id);
    });
    it("retries transient failures, releases failed claims, and removes expired subscriptions", async () => {
      const id = await store.save("retry", subscription("retry"));
      const send = vi
        .fn()
        .mockRejectedValueOnce({ statusCode: 503 })
        .mockResolvedValue({});
      await createWebPush(store, send).observe(
        "retry",
        view("awaiting_input", question),
        "chat",
      );
      expect(send).toHaveBeenCalledTimes(2);
      const invalid = vi.fn().mockRejectedValue({ statusCode: 401 });
      await createWebPush(store, invalid).observe(
        "retry",
        view("succeeded"),
        "chat",
      );
      expect(await store.claim("retry", id, "run", "succeeded:")).toBe(true);
      await store.finish(id, "run", "succeeded:", false);
      await createWebPush(
        store,
        vi.fn().mockRejectedValue({ statusCode: 410 }),
      ).observe("retry", view("succeeded"), "chat");
      expect(await store.has("retry", id)).toBe(false);
    });
    it("caps concurrent enrollments at 20 and replaces renewals without keeping stale endpoints", async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 24 }, (_, i) =>
          store.save("quota", subscription(`quota-${i}`)),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(20);
      expect(
        (
          await db.query(
            "SELECT count(*) AS count FROM web_push_subscriptions WHERE user_id='quota'",
          )
        ).rows[0].count,
      ).toBe("20");
      const device = (await store.devices("quota"))[0];
      if (!device) {
        throw new Error("Missing device");
      }
      const renewed = await store.save(
        "quota",
        subscription("quota-renewed"),
        device.id,
      );
      expect(await store.has("quota", device.id)).toBe(false);
      expect(await store.has("quota", renewed)).toBe(true);
      expect(await store.devices("quota")).toHaveLength(20);
      const rows = await store.devices("quota");
      for (const row of rows) {
        await store.remove("quota", row.id);
      }
    });
    it("prunes old delivery records but retains recent deduplication", async () => {
      const id = await store.save("retention", subscription("retention"));
      await store.claim("retention", id, "old", "succeeded:");
      await store.claim("retention", id, "recent", "succeeded:");
      await db.query(
        "UPDATE web_push_deliveries SET claimed_at=now()-interval '8 days' WHERE subscription_id=$1 AND run_id='old'",
        [id],
      );
      await store.devices("retention");
      const rows = (
        await db.query(
          "SELECT run_id FROM web_push_deliveries WHERE subscription_id=$1",
          [id],
        )
      ).rows;
      expect(rows).toEqual([{ run_id: "recent" }]);
      await store.remove("retention", id);
    });
    it("only tests a device owned by the signed-in user", async () => {
      const id = await store.save("test", subscription("test"));
      const send = vi.fn(async () => ({}));
      const push = createWebPush(store, send);
      await expect(push.test("other", id)).rejects.toThrow(
        "Enable notifications",
      );
      expect(send).not.toHaveBeenCalled();
      await push.test("test", id);
      expect(send).toHaveBeenCalledOnce();
      await store.remove("test", id);
    });
  },
);

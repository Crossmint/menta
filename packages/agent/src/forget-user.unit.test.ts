import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createSqlForgetUser } from "./forget-user.js";

const user = {
  id: "user-1",
  principal: { issuer: "stytch.com/project-1", subject: "user-1" },
};

describe("forget user", () => {
  it("deletes the user's rows from every per-user table", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await createSqlForgetUser(query)(user);
    expect(query.mock.calls).toEqual([
      ["DELETE FROM default_addresses WHERE user_id = $1", ["user-1"]],
      ["DELETE FROM mcp_event_subscriptions WHERE user_id = $1", ["user-1"]],
      ["DELETE FROM grok_bot_offers WHERE user_id = $1", ["user-1"]],
      ["DELETE FROM grok_bot_routines WHERE user_id = $1", ["user-1"]],
      ["DELETE FROM user_memories WHERE user_id = $1", ["user-1"]],
      ["DELETE FROM web_push_subscriptions WHERE user_id = $1", ["user-1"]],
      ["DELETE FROM checkout_agents WHERE user_id = $1", ["user-1"]],
      ["DELETE FROM card_names WHERE user_id = $1", ["user-1"]],
      ["DELETE FROM card_setup WHERE user_id = $1", ["user-1"]],
      [
        "DELETE FROM web_session_owners WHERE issuer = $1 AND subject = $2",
        ["stytch.com/project-1", "user-1"],
      ],
    ]);
  });

  it("stops at the first failure, so the caller can retry", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("down"));
    await expect(createSqlForgetUser(query)(user)).rejects.toThrow("down");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("covers every table a migration creates with a user column", async () => {
    const dir = new URL("../../../migrations/", import.meta.url);
    const sql = (
      await Promise.all(
        (
          await readdir(dir)
        ).map((name) => readFile(new URL(name, dir), "utf8")),
      )
    ).join("\n");
    const dropped = new Set(
      [...sql.matchAll(/DROP TABLE IF EXISTS (\w+)/g)].map((m) => m[1]),
    );
    const perUser = [
      ...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([^;]*?)\n\)/g),
    ]
      .filter(
        ([, table, body]) =>
          !dropped.has(table) && /\buser_id\b/i.test(body ?? ""),
      )
      .map(([, table]) => table);
    const query = vi.fn().mockResolvedValue([]);
    await createSqlForgetUser(query)(user);
    const deleted = query.mock.calls.map(
      ([text]) => /DELETE FROM (\w+)/.exec(String(text))?.[1],
    );
    expect(perUser.length).toBeGreaterThan(0);
    for (const table of perUser) {
      expect(deleted).toContain(table);
    }
    expect(deleted).toContain("web_session_owners");
  });
});

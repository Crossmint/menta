import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createSqlAddressDefaults } from "./address-defaults.js";

describe("default address store", () => {
  it("reads the user's default, or null when none is set", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ buyer_profile_id: "profile-1" }])
      .mockResolvedValueOnce([]);
    const defaults = createSqlAddressDefaults(query);
    expect(await defaults.get("user-1")).toBe("profile-1");
    expect(await defaults.get("user-2")).toBeNull();
    expect(query.mock.calls[0]).toEqual([
      "SELECT buyer_profile_id FROM default_addresses WHERE user_id = $1",
      ["user-1"],
    ]);
  });

  it("upserts one row per user", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await createSqlAddressDefaults(query).set("user-1", "profile-2");
    const [text, parameters] = query.mock.calls[0] ?? [];
    expect(text).toMatch(
      /^INSERT INTO default_addresses \(user_id, buyer_profile_id\)/,
    );
    expect(text).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/);
    expect(parameters).toEqual(["user-1", "profile-2"]);
  });

  it("clears the user's default, leaving none", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await createSqlAddressDefaults(query).set("user-1", null);
    expect(query.mock.calls[0]).toEqual([
      "DELETE FROM default_addresses WHERE user_id = $1",
      ["user-1"],
    ]);
  });

  it("has a migration for the table it uses", async () => {
    const sql = await readFile(
      new URL(
        "../../../migrations/0003_default_addresses.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS default_addresses/);
    expect(sql).toMatch(/user_id text PRIMARY KEY/);
    expect(sql).toMatch(/buyer_profile_id text NOT NULL/);
  });
});

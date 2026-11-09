import { describe, expect, it, vi } from "vitest";
import { createSqlAgentUse, throttledAgentUse } from "./agent-use.js";

describe("agent use", () => {
  it("touches with the agent's name and version, trimmed to the columns", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await createSqlAgentUse(query).touch("user-1", "client-1", {
      name: "openai-mcp",
      version: "x".repeat(50),
    });
    expect(query.mock.calls[0]?.[1]).toEqual([
      "user-1",
      "client-1",
      "openai-mcp",
      "x".repeat(40),
    ]);
  });

  it("reads the user's agents by client ID", async () => {
    const query = vi.fn().mockResolvedValue([
      {
        client_id: "client-1",
        client_name: null,
        client_version: null,
        first_used_at: new Date("2026-11-01T00:00:00Z"),
        last_used_at: new Date("2026-11-08T00:00:00Z"),
      },
    ]);
    const uses = await createSqlAgentUse(query).of("user-1");
    expect(query.mock.calls[0]?.[1]).toEqual(["user-1"]);
    expect(uses.get("client-1")).toEqual({
      name: null,
      version: null,
      firstUsedAt: "2026-11-01T00:00:00.000Z",
      lastUsedAt: "2026-11-08T00:00:00.000Z",
    });
  });

  it("writes a busy agent once per window, but always when it says who it is", async () => {
    let now = 0;
    const touch = vi.fn().mockResolvedValue(undefined);
    const throttled = throttledAgentUse(
      { touch, of: vi.fn() },
      { everyMs: 1000, now: () => now },
    );
    await throttled("user-1", "client-1", null);
    await throttled("user-1", "client-1", null);
    await throttled("user-1", "client-1", { name: "Claude", version: "1" });
    // An initialize without clientInfo says nothing: throttled.
    await throttled("user-1", "client-1", { name: null, version: null });
    now = 1500;
    await throttled("user-1", "client-1", null);
    await throttled("user-2", "client-1", null);
    expect(touch).toHaveBeenCalledTimes(4);
  });

  it("never throws, and retries after a failed write", async () => {
    const touch = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throttled = throttledAgentUse({ touch, of: vi.fn() });
    await throttled("user-1", "client-1", null);
    await throttled("user-1", "client-1", null);
    expect(touch).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

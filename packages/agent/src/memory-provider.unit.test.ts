import type {
  MemoryOperationContext,
  MemoryScopeContext,
  MemoryToolsContext,
} from "eve/memory";
import { describe, expect, it, vi } from "vitest";
import type { MemoryStore } from "./memory.js";
import { commerceMemory, memoryScope } from "./memory-provider.js";

const id = "43dcb591-f874-44f2-8289-ab613432f1e1";
function context(user: string, session = "conversation-1") {
  return {
    session: { id: session },
    memory: { scope: { value: user, key: `locked-${user}` } },
  } as unknown as MemoryOperationContext & MemoryToolsContext;
}

describe("automatic memory recall", () => {
  it("loads the same user's notes at a new conversation and after compaction, then replaces deleted notes with an empty record", async () => {
    const read = vi
      .fn()
      .mockResolvedValue([{ id, text: "My usual is an oat flat white." }]);
    const provider = commerceMemory(() => ({ read }) as unknown as MemoryStore);
    const first = await provider.recall["turn.started"](
      context("user-a") as Parameters<
        (typeof provider.recall)["turn.started"]
      >[0],
    );
    const second = await provider.recall["turn.started"](
      context("user-a", "conversation-2") as Parameters<
        (typeof provider.recall)["turn.started"]
      >[0],
    );
    const compacted = await provider.recall["compaction.completed"](
      context("user-a") as Parameters<
        (typeof provider.recall)["compaction.completed"]
      >[0],
    );
    expect(first).toEqual(second);
    expect(first).toEqual(compacted);
    expect(first.messages[0].content).toContain("oat flat white");
    expect(read.mock.calls).toEqual([["user-a"], ["user-a"], ["user-a"]]);
    read.mockResolvedValue([]);
    const forgotten = await provider.recall["turn.started"](
      context("user-a") as Parameters<
        (typeof provider.recall)["turn.started"]
      >[0],
    );
    expect(forgotten.messages[0].id).toBe(first.messages[0].id);
    expect(forgotten.messages[0].content).toContain("No memories saved");
  });

  it("binds tools to the locked user, including when replayed in another conversation", async () => {
    const save = vi.fn().mockResolvedValue({ id, text: "Useful note" });
    const remove = vi.fn().mockResolvedValue(undefined);
    const provider = commerceMemory(
      () => ({ save, remove }) as unknown as MemoryStore,
    );
    const tools = await provider.tools(context("user-a"));
    await tools.save_memory.execute({ text: "Useful note" }, {} as never);
    await tools.remove_memory.execute({ id }, {} as never);
    expect(save).toHaveBeenCalledWith("user-a", "Useful note");
    expect(remove).toHaveBeenCalledWith("user-a", id);
  });

  it.each([
    null,
    { authenticator: "stytch", principalType: "runtime", subject: "user-a" },
    { authenticator: "other", principalType: "user", subject: "user-a" },
  ])(
    "disables memory without a verified user, including in local development: %j",
    (auth) => {
      expect(
        memoryScope({
          session: { auth: { current: auth } },
        } as MemoryScopeContext),
      ).toBeNull();
    },
  );

  it("uses the authenticated Stytch subject", () => {
    expect(
      memoryScope({
        session: {
          auth: {
            current: {
              authenticator: "stytch",
              principalType: "user",
              subject: "user-a",
            },
          },
        },
      } as MemoryScopeContext),
    ).toBe("user-a");
  });
});

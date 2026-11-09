import type { Checkouts } from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it, vi } from "vitest";
import {
  attributedCheckouts,
  type CheckoutAgents,
  createSqlCheckoutAgents,
} from "./checkout-agents";

function memoryAgents(): CheckoutAgents & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    async record(userId, runId, agent) {
      rows.set(`${userId}:${runId}`, agent);
    },
    async of(userId, runIds) {
      return new Map(
        runIds.flatMap((runId) => {
          const agent = rows.get(`${userId}:${runId}`);
          return agent ? [[runId, agent] as const] : [];
        }),
      );
    },
  };
}

function checkoutsStarting(result: unknown) {
  return {
    create: vi.fn(async () => result),
  } as unknown as Checkouts;
}

const input = {} as Parameters<Checkouts["create"]>[1];

describe("which agent started a checkout", () => {
  it("notes the agent of a run that started", async () => {
    const store = memoryAgents();
    const checkouts = attributedCheckouts(
      checkoutsStarting({ runId: "run-1", status: "running" }),
      async () => "Grok Bot",
      store,
    );
    await checkouts.create("user-1", input);
    expect(await store.of("user-1", ["run-1"])).toEqual(
      new Map([["run-1", "Grok Bot"]]),
    );
    expect(await store.of("user-2", ["run-1"])).toEqual(new Map());
  });

  it("notes nothing when nothing started or no agent is known", async () => {
    const store = memoryAgents();
    await attributedCheckouts(
      checkoutsStarting({ status: "needs_address", label: "Mom" }),
      async () => "Grok Bot",
      store,
    ).create("user-1", input);
    await attributedCheckouts(
      checkoutsStarting({ runId: "run-2", status: "running" }),
      async () => null,
      store,
    ).create("user-1", input);
    expect(store.rows.size).toBe(0);
  });

  it("never fails a checkout over the note", async () => {
    const started = { runId: "run-3", status: "running" };
    const failing: CheckoutAgents = {
      record: async () => {
        throw new Error("database down");
      },
      of: async () => new Map(),
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await attributedCheckouts(
      checkoutsStarting(started),
      async () => "Claude",
      failing,
    ).create("user-1", input);
    expect(result).toBe(started);
  });

  it("reads only the user's own runs", async () => {
    const calls: { text: string; parameters: readonly unknown[] }[] = [];
    const store = createSqlCheckoutAgents(async (text, parameters) => {
      calls.push({ text, parameters });
      return [{ run_id: "run-1", agent: "Menta chat" }];
    });
    expect(await store.of("user-1", ["run-1", "run-9"])).toEqual(
      new Map([["run-1", "Menta chat"]]),
    );
    expect(calls[0].text).toContain("user_id = $1");
    expect(calls[0].parameters).toEqual(["user-1", ["run-1", "run-9"]]);
    expect(await store.of("user-1", [])).toEqual(new Map());
    expect(calls).toHaveLength(1);
  });
});

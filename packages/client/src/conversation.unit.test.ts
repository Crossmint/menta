import type { EveMessage } from "eve/react";
import { describe, expect, it } from "vitest";
import { dockNoteLine, readDockNote } from "./checkouts";
import {
  canceledRuns,
  checkoutMentions,
  placeOutcomes,
  runOf,
  type ToolPart,
  withoutConfirmedEchoes,
} from "./conversation";

function tool(part: Partial<ToolPart>): ToolPart {
  return {
    type: "dynamic-tool",
    toolCallId: "call-1",
    toolName: "checkouts__get",
    state: "output-available",
    input: {},
    output: undefined,
    ...part,
  } as ToolPart;
}

function message(
  id: string,
  role: "user" | "assistant",
  text: string,
  optimistic = false,
): EveMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
    ...(optimistic ? { metadata: { optimistic: true } } : {}),
  } as EveMessage;
}

describe("runOf", () => {
  it("reads the checkout a create or get returned", () => {
    const view = { runId: "run_1", status: "running" };
    expect(runOf(tool({ output: view }))).toEqual({ runId: "run_1", view });
  });

  it("knows the run a watch is waiting on before it returns", () => {
    expect(
      runOf(
        tool({
          toolName: "watch_checkout",
          state: "input-available",
          input: { runId: "run_2" },
        }),
      ),
    ).toEqual({ runId: "run_2", view: null });
  });

  it("ignores other tools", () => {
    expect(
      runOf(tool({ toolName: "web_search", output: { runId: "x" } })),
    ).toBeNull();
  });
});

describe("withoutConfirmedEchoes", () => {
  it("drops the optimistic copy once the server confirms it", () => {
    const messages = [
      message("a", "user", "Buy socks", true),
      message("b", "user", "Buy socks"),
    ];
    expect(withoutConfirmedEchoes(messages).map((m) => m.id)).toEqual(["b"]);
  });

  it("keeps an optimistic message with no confirmed twin", () => {
    const messages = [
      message("a", "assistant", "Hi"),
      message("b", "user", "Buy socks", true),
    ];
    expect(withoutConfirmedEchoes(messages)).toHaveLength(2);
  });
});

describe("dockNoteLine", () => {
  it("says what the user did in the panel", () => {
    const note = readDockNote(
      'Answered the store in the checkout panel (checkout run_1 at amazon.com):\n- Size: "10"',
    );
    expect(note && dockNoteLine(note)).toEqual({
      what: "You answered amazon.com",
      detail: "10",
    });
  });

  it("names an approval's store", () => {
    const note = readDockNote(
      "Approved the payment in the checkout panel (checkout run_1 at target.com).",
    );
    expect(note && dockNoteLine(note)).toEqual({
      what: "You approved the payment at target.com",
      detail: "",
    });
  });

  it("still reads the old dock form's saved-address notes", () => {
    for (const text of [
      "Saved the Mom address (Tampa, FL). Start the checkout.",
      "Saved the Mom address (Tampa, FL). It's my default now.",
    ]) {
      const note = readDockNote(text);
      expect(note && dockNoteLine(note)).toEqual({
        what: "You saved the Mom address",
        detail: "Tampa, FL",
      });
    }
    expect(readDockNote("Saved the day (again).")).toBeNull();
    expect(
      readDockNote("Saved the Work address (NYC). Also buy socks"),
    ).toBeNull();
  });
});

describe("checkout placement", () => {
  const running = { runId: "run_1", status: "running" };
  const done = { runId: "run_1", status: "succeeded" };
  const messages = [
    message("u1", "user", "Buy it"),
    {
      id: "a1",
      role: "assistant",
      parts: [
        tool({ toolName: "checkouts__create", output: running }),
        tool({ toolName: "watch_checkout", output: running }),
      ],
    },
    message("u2", "user", "Thanks"),
    {
      id: "a2",
      role: "assistant",
      parts: [{ type: "text", text: "Done." }, tool({ output: done })],
    },
  ] as EveMessage[];

  it("puts the row at the first mention and remembers where it ended", () => {
    const mentions = checkoutMentions(messages);
    expect(mentions.rendered[1]?.[0]?.runId).toBe("run_1");
    expect(mentions.rendered[1]?.[1]).toBeNull();
    expect(mentions.lastSeen.get("run_1")).toBe(3);
    expect(mentions.sawEnd.get("run_1")).toEqual({ message: 3, part: 1 });
    expect(mentions.refs).toEqual([{ runId: "run_1", initial: done }]);
  });

  it("places a settled run's card where the agent saw it end", () => {
    const mentions = checkoutMentions(messages);
    const views = new Map([["run_1", done as never]]);
    expect(placeOutcomes(mentions, views, {}).get("run_1")).toEqual({
      message: 3,
      part: 1,
    });
  });

  it("places a run that ended unseen at the end of the latest message", () => {
    const mentions = checkoutMentions(messages.slice(0, 3));
    const views = new Map([["run_1", done as never]]);
    expect(placeOutcomes(mentions, views, { run_1: 2 }).get("run_1")).toEqual({
      message: 2,
      part: null,
    });
    expect(
      placeOutcomes(mentions, new Map([["run_1", running as never]]), {}).size,
    ).toBe(0);
  });

  it("collects runs the agent was asked to cancel", () => {
    const cancel = {
      id: "a3",
      role: "assistant",
      parts: [
        tool({ toolName: "checkouts__cancel", input: { runId: "run_2" } }),
      ],
    } as EveMessage;
    expect([...canceledRuns([...messages, cancel], ["run_3"])]).toEqual([
      "run_3",
      "run_2",
    ]);
  });
});

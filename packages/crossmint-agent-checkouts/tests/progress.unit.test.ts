import { describe, expect, it, vi } from "vitest";
import {
  type CheckoutsApi,
  createCheckouts,
  forModel,
} from "../extension/lib/checkouts.js";
import {
  emptyLog,
  foldMessages,
  progressOf,
  stepText,
} from "../extension/lib/progress.js";

const at = (second: number) =>
  new Date(Date.UTC(2026, 9, 6, 12, 0, second)).toISOString();

/** A browser tool call as Crossmint publishes it (revision 1 running, 2 ended). */
function step(
  id: string,
  second: number,
  text: string,
  status = "completed",
  kinds: string[] = ["click"],
  revision = status === "running" ? 1 : 2,
) {
  return {
    id,
    revision,
    role: "assistant",
    createdAt: at(second),
    parts: [
      { type: "text", text },
      {
        type: "activity",
        status,
        operations: kinds.map((kind) => ({ kind, count: 1 })),
      },
    ],
  };
}

describe("checkout progress from run messages", () => {
  it("shows the newest step and the last five, newest first", () => {
    const log = foldMessages(
      emptyLog,
      Array.from({ length: 7 }, (_, index) =>
        step(`m${index}`, index, `Step ${index}`),
      ),
    );
    const progress = progressOf(log);
    expect(progress.now).toEqual({
      text: "Step 6",
      status: "completed",
      at: at(6),
    });
    expect(progress.recent.map((item) => item.text)).toEqual([
      "Step 6",
      "Step 5",
      "Step 4",
      "Step 3",
      "Step 2",
    ]);
  });

  it("replaces a step only with a higher revision", () => {
    const started = step(
      "m1",
      1,
      "Adding the croissant to the cart",
      "running",
    );
    const ended = { ...step("m1", 1, "Adding the croissant to the cart") };
    let log = foldMessages(emptyLog, [started, ended]);
    expect(progressOf(log).now?.status).toBe("completed");
    // A stale copy (lower revision) arriving later changes nothing.
    log = foldMessages(log, [started]);
    expect(progressOf(log).now?.status).toBe("completed");
    expect(progressOf(log).recent).toHaveLength(1);
  });

  it("orders by when the step started, not when its revision arrived", () => {
    const log = foldMessages(emptyLog, [
      step("a", 1, "Opening the menu", "running"),
      step("b", 2, "Choosing a size", "running"),
      step("a", 1, "Opening the menu"),
    ]);
    const progress = progressOf(log);
    expect(progress.now?.text).toBe("Choosing a size");
    expect(progress.recent.map((item) => item.text)).toEqual([
      "Choosing a size",
      "Opening the menu",
    ]);
  });

  it("ignores user messages, other parts and unknown shapes", () => {
    const log = foldMessages(emptyLog, [
      step("a", 1, "Searching the store"),
      {
        id: "u1",
        revision: 1,
        role: "user",
        createdAt: at(2),
        parts: [{ type: "text", text: "Use standard shipping" }],
      },
      {
        id: "q1",
        revision: 1,
        role: "assistant",
        createdAt: at(3),
        parts: [
          {
            type: "input_request",
            requestId: "r",
            question: "Which size?",
            status: "open",
          },
        ],
      },
      {
        id: "r1",
        revision: 1,
        role: "assistant",
        createdAt: at(4),
        parts: [{ type: "result", outcome: "failed", summary: "Nope" }],
      },
      // Text without activity is not a step.
      {
        id: "t1",
        revision: 1,
        role: "assistant",
        createdAt: at(5),
        parts: [{ type: "text", text: "Narration" }],
      },
      { id: "x", parts: "nope" },
      null,
      { ...step("bad-time", 6, "No time"), createdAt: "not a date" },
    ]);
    const progress = progressOf(log);
    expect(progress.recent.map((item) => item.text)).toEqual([
      "Searching the store",
    ]);
    expect(progress.now?.text).toBe("Searching the store");
  });

  it("skips unknown part types and operation kinds without failing", () => {
    const log = foldMessages(emptyLog, [
      {
        id: "a",
        revision: 1,
        role: "assistant",
        createdAt: at(1),
        parts: [
          { type: "future_part", whatever: true },
          { type: "text", text: "Calling the store's tool" },
          {
            type: "activity",
            status: "running",
            operations: [{ kind: "call_webmcp_tool", tool: "cart", count: 1 }],
          },
        ],
      },
    ]);
    expect(progressOf(log)).toMatchObject({
      now: { text: "Calling the store's tool", status: "running" },
    });
  });

  it("uses a newer checkpoint's text for the current line", () => {
    const log = foldMessages(emptyLog, [
      step("a", 1, "Filling in your details"),
      {
        id: "cp",
        revision: 1,
        role: "assistant",
        createdAt: at(2),
        parts: [{ type: "progress", text: "The cart is ready for checkout." }],
      },
    ]);
    const progress = progressOf(log);
    expect(progress.now).toEqual({
      text: "The cart is ready for checkout.",
      status: "completed",
      at: at(2),
    });
    // Checkpoints aren't steps.
    expect(progress.recent.map((item) => item.text)).toEqual([
      "Filling in your details",
    ]);
    // A step after the checkpoint takes over again.
    const later = foldMessages(log, [
      step("b", 3, "Choosing shipping", "running"),
    ]);
    expect(progressOf(later).now?.text).toBe("Choosing shipping");
  });

  it("keeps lines on one line and at most 240 chars", () => {
    expect(stepText("  Adding\n the   croissant ")).toBe(
      "Adding the croissant",
    );
    const long = stepText("a".repeat(400));
    expect(long).toHaveLength(240);
    expect(long.endsWith("…")).toBe(true);
    expect(stepText("b".repeat(240))).toBe("b".repeat(240));
    const log = foldMessages(emptyLog, [step("a", 1, "c".repeat(300))]);
    expect(progressOf(log).now?.text).toHaveLength(240);
  });
});

/** A run read plus its messages, as Crossmint pages them. */
function fakeApi(status = "running") {
  const pages: Record<string, unknown> = {
    start: {
      data: [
        step("a", 1, "Searching the store", "completed", ["search_catalog"]),
      ],
      nextCursor: "c1",
      streamCursor: "c1",
    },
    c1: {
      data: [step("b", 2, "Adding it to the cart", "running")],
      nextCursor: null,
      streamCursor: "c2",
    },
    c2: {
      data: [step("b", 2, "Adding it to the cart")],
      nextCursor: null,
      streamCursor: "c3",
    },
  };
  return {
    get: vi.fn(async () => ({
      data: {
        runId: "run-1",
        revision: 1,
        status,
        createdAt: at(0),
        browser: { embedUrl: "https://live.invalid/LIVE" },
        input: {
          request: { startUrl: "https://store.example/" },
          constraints: { maxCost: { amount: "20.00", currency: "USD" } },
        },
        ...(status === "succeeded"
          ? {
              result: {
                summary: "Done",
                purchase: { kind: "confirmed_without_receipt" },
              },
            }
          : {}),
      },
    })),
    messages: {
      list: vi.fn(
        async ({ query }: { query: { cursor?: string; limit: number } }) => ({
          data: pages[query.cursor ?? "start"] ?? {
            data: [],
            nextCursor: null,
            streamCursor: query.cursor,
          },
        }),
      ),
    },
  };
}

const checkoutsFor = (api: ReturnType<typeof fakeApi>) =>
  createCheckouts({
    api: api as unknown as CheckoutsApi,
    actionUrl: String,
    buyerProfiles: false,
    browserProfiles: false,
  });

describe("reading progress with a checkout", () => {
  it("pages from the start once, then reads only what's new", async () => {
    const api = fakeApi();
    const checkouts = checkoutsFor(api);
    const first = await checkouts.get("user-1", "run-1", { progress: true });
    expect(first.progress).toMatchObject({
      now: { text: "Adding it to the cart", status: "running" },
    });
    expect(api.messages.list.mock.calls.map(([call]) => call)).toEqual([
      {
        headers: { "x-crossmint-user-id": "user-1" },
        path: { id: "run-1" },
        query: { limit: 100 },
      },
      expect.objectContaining({ query: { limit: 100, cursor: "c1" } }),
    ]);
    const second = await checkouts.get("user-1", "run-1", { progress: true });
    expect(second.progress?.now?.status).toBe("completed");
    expect(api.messages.list).toHaveBeenCalledTimes(3);
    expect(api.messages.list.mock.calls[2]?.[0].query).toEqual({
      limit: 100,
      cursor: "c2",
    });
    // Another user's read of the same run starts its own log.
    await checkouts.get("user-2", "run-1", { progress: true });
    expect(api.messages.list.mock.calls[3]?.[0].query).toEqual({ limit: 100 });
  });

  it("reads no messages unless asked, and none for an ended run", async () => {
    const api = fakeApi();
    expect(
      (await checkoutsFor(api).get("user-1", "run-1")).progress,
    ).toBeNull();
    const done = fakeApi("succeeded");
    const view = await checkoutsFor(done).get("user-1", "run-1", {
      progress: true,
    });
    expect(view.progress).toBeNull();
    expect(api.messages.list).not.toHaveBeenCalled();
    expect(done.messages.list).not.toHaveBeenCalled();
  });

  it("is null when the messages can't be read, and nothing else breaks", async () => {
    const api = fakeApi();
    api.messages.list.mockResolvedValueOnce({
      error: { message: "down" },
    } as never);
    const view = await checkoutsFor(api).get("user-1", "run-1", {
      progress: true,
    });
    expect(view.status).toBe("running");
    expect(view.liveViewUrl).toBe("https://live.invalid/LIVE");
    expect(view.progress).toBeNull();

    const broken = fakeApi();
    broken.messages.list.mockResolvedValueOnce({
      data: { data: "not a list" },
    } as never);
    expect(
      (await checkoutsFor(broken).get("user-1", "run-1", { progress: true }))
        .progress,
    ).toBeNull();
  });

  it("never reaches the model", async () => {
    const view = await checkoutsFor(fakeApi()).get("user-1", "run-1", {
      progress: true,
    });
    expect(view.progress?.now?.text).toBeTruthy();
    const model = JSON.stringify(forModel(view));
    expect(model).not.toContain("progress");
    expect(model).not.toContain("Adding it to the cart");
    expect(model).not.toContain("live.invalid");
  });
});

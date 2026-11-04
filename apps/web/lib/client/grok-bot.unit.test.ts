import { describe, expect, it } from "vitest";
import { testResult } from "../server/grok-bot";
import { ago, deliveryLine, deliveryProblem, testNote } from "./grok-bot";

const now = Date.parse("2026-10-07T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(now - minutes * 60_000).toISOString();

describe("Grok Bot updates on the account page", () => {
  it("says when the last delivery went out and how it went", () => {
    expect(deliveryLine(null, now)).toBe("Nothing sent yet");
    expect(
      deliveryLine({ at: minutesAgo(0), ok: true, error: null }, now),
    ).toBe("Last sent just now · Delivered");
    expect(
      deliveryLine({ at: minutesAgo(5), ok: false, error: "http_4xx" }, now),
    ).toBe("Last sent 5 min ago · Refused");
    expect(
      deliveryLine({ at: minutesAgo(180), ok: false, error: "timeout" }, now),
    ).toBe("Last sent 3 h ago · Not delivered");
    expect(ago(minutesAgo(59), now)).toBe("59 min ago");
  });

  it("explains only a failed delivery", () => {
    expect(deliveryProblem(null)).toBeNull();
    expect(
      deliveryProblem({ at: minutesAgo(1), ok: true, error: null }),
    ).toBeNull();
    expect(
      deliveryProblem({ at: minutesAgo(1), ok: false, error: "http_4xx" }),
    ).toContain("refused");
    expect(
      deliveryProblem({ at: minutesAgo(1), ok: false, error: "timeout" }),
    ).toContain("tries again");
  });

  it("shows the test's outcome inline after Save or Send a test", () => {
    expect(testNote(null)).toBeNull();
    expect(testNote(testResult({ ok: true }))).toEqual({
      ok: true,
      text: "Grok Bot got the test. It starts a run and tells you in a moment.",
    });
    expect(
      testNote(testResult({ ok: false, reason: "http_4xx" })),
    ).toMatchObject({ ok: false, text: expect.stringContaining("refused") });
    expect(
      testNote(testResult({ ok: false, reason: "key_unreadable" })),
    ).toMatchObject({ text: expect.stringContaining("Paste it again") });
    expect(testNote({ ok: false })).toMatchObject({
      text: "The test didn't go through. Try again.",
    });
  });
});

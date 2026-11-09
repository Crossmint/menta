import { afterEach, expect, it, vi } from "vitest";
import clock from "../agent/instructions/current-time.js";

afterEach(() => {
  vi.useRealTimers();
});

it("refreshes the runtime clock between turns, including across midnight", async () => {
  vi.useFakeTimers();
  const resolve = clock.events["turn.started"];
  expect(resolve).toBeDefined();
  vi.setSystemTime(new Date("2026-10-10T23:59:59Z"));
  const first = await resolve?.({}, {} as never);
  expect(first?.content).toContain("2026-10-10T23:59:59.000Z (UTC)");
  vi.setSystemTime(new Date("2026-10-11T00:00:01Z"));
  const next = await resolve?.({}, {} as never);
  expect(next?.content).toContain("2026-10-11T00:00:01.000Z (UTC)");
  expect(first?.content).not.toEqual(next?.content);
});

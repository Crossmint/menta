/** What /api/grok-bot says about the last delivery (update or test). Never the key. */
export interface LastDelivery {
  readonly at: string | null;
  readonly ok: boolean;
  readonly error: string | null;
}

/** "just now", "5 min ago", "3 h ago", else the date. */
export function ago(iso: string, now = Date.now()) {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString();
}

/** The status line's last part: when the last delivery went out and how it went. */
export function deliveryLine(last: LastDelivery | null, now = Date.now()) {
  if (!last) {
    return "Nothing sent yet";
  }
  const when = last.at ? ` ${ago(last.at, now)}` : "";
  if (last.ok) {
    return `Last sent${when} · Delivered`;
  }
  return `Last sent${when} · ${last.error === "http_4xx" ? "Refused" : "Not delivered"}`;
}

/** The last delivery's problem in plain words, or null when it went through. */
export function deliveryProblem(last: LastDelivery | null) {
  if (!last || last.ok) {
    return null;
  }
  return last.error === "http_4xx"
    ? "Grok Bot refused the last update. Check the key, and that the routine isn't paused."
    : "Grok Bot didn't answer the last update. Menta tries again on the next change.";
}

/** What a test (Save or Send a test) says inline. */
export function testNote(test: { ok: boolean; error?: string } | null) {
  if (!test) {
    return null;
  }
  return test.ok
    ? {
        ok: true,
        text: "Grok Bot got the test. It starts a run and tells you in a moment.",
      }
    : {
        ok: false,
        text: test.error ?? "The test didn't go through. Try again.",
      };
}

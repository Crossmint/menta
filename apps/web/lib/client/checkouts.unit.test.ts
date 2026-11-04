import { afterEach, describe, expect, it, vi } from "vitest";
import {
  byUrgency,
  type CheckoutView,
  dockNote,
  followCheckout,
  formAnswers,
  isMissing,
  nextChoice,
  type QuestionField,
  readDockNote,
  shownRun,
} from "./checkouts";

describe("checkout polling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shares one poller per run and stops for good on 404", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const stopA = followCheckout("gone");
    const stopB = followCheckout("gone");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(isMissing("gone")).toBe(true);
    stopA();
    stopB();
    const stopC = followCheckout("gone");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    stopC();
  });

  it("backs off on errors instead of hammering", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response("{}", { status: 502 }));
    vi.stubGlobal("fetch", fetch);
    const stop = followCheckout("flaky");
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    // 0s, then ~5.8s, ~13s, ~30s, ~70s, then every 2 minutes.
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(7);
    expect(isMissing("flaky")).toBe(false);
    stop();
  });
});

function run(
  runId: string,
  pending: CheckoutView["pending"],
  createdAt = "2026-10-06T05:00:00.000Z",
): CheckoutView {
  return {
    runId,
    revision: 1,
    status: pending ? "awaiting_input" : "running",
    createdAt,
    startUrl: "https://www.amazon.com/",
    store: "amazon.com",
    task: null,
    maxCost: { amount: "15.00", currency: "USD" },
    usesSavedDetails: false,
    shipsTo: null,
    fulfillment: "delivery",
    liveViewUrl: null,
    pending,
    progress: null,
    result: null,
  };
}

const base = { requestId: "r", question: "?", expiresAt: null };

describe("dock order", () => {
  it("puts payment before a question, a secure step and working runs", () => {
    const working = run("working", null, "2026-10-06T06:00:00.000Z");
    const question = run("question", { ...base, kind: "question", fields: [] });
    const secure = run("secure", {
      ...base,
      kind: "protected",
      fields: [],
      standard: [],
      actionUrl: "",
    });
    const payment = run("payment", {
      ...base,
      kind: "payment",
      amount: { amount: "9.71", currency: "USD", exact: true },
      merchant: { name: "Amazon", url: "", countryCode: "US" },
      actionUrl: "",
    });
    expect(
      [working, secure, question, payment].sort(byUrgency).map((r) => r.runId),
    ).toEqual(["payment", "question", "secure", "working"]);
  });

  it("shows the newest first when two need the same thing", () => {
    const older = run("older", null, "2026-10-06T05:00:00.000Z");
    const newer = run("newer", null, "2026-10-06T05:30:00.000Z");
    expect([older, newer].sort(byUrgency).map((r) => r.runId)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("holds the user's switch until something new needs them", () => {
    const payment = run("payment", {
      ...base,
      requestId: "pay",
      kind: "payment",
      amount: { amount: "9.71", currency: "USD", exact: true },
      merchant: { name: "Amazon", url: "", countryCode: "US" },
      actionUrl: "",
    });
    const question = run("question", {
      ...base,
      requestId: "size",
      kind: "question",
      fields: [],
    });
    const working = run("working", null);
    const runs = [payment, question, working];
    expect(shownRun(runs, null)?.runId).toBe("payment");
    const choice = nextChoice(runs, "payment");
    expect(choice?.runId).toBe("question");
    expect(shownRun(runs, choice)?.runId).toBe("question");
    // The switch wraps around.
    expect(nextChoice(runs, "working")?.runId).toBe("payment");
    // A new request anywhere puts the most urgent run first again.
    const asked = run("working", {
      ...base,
      requestId: "color",
      kind: "question",
      fields: [],
    });
    expect(shownRun([payment, question, asked], choice)?.runId).toBe("payment");
    // A choice that left the list falls back to the first, even while the
    // runs still need the same things.
    const gone = { runId: "gone", needs: choice?.needs ?? "" };
    expect(shownRun(runs, gone)?.runId).toBe("payment");
  });
});

// The shape of a real Crossmint choice question (amazon.com, 2026-10-06).
const toy: QuestionField = {
  key: "toy",
  label: "Choose one cat toy",
  required: true,
  kind: "choice",
  multiple: false,
  options: [
    {
      value: "SunGrow Cat Crinkle Balls, 6 Pcs ($4.99)",
      label: "SunGrow Cat Crinkle Balls, 6 pieces — $4.99",
    },
    {
      value: "Catstages Squeak Squeak Mouse Cat Toy ($5.39)",
      label: "Catstages Squeak Squeak Mouse Cat Toy — $5.39",
    },
  ],
};

describe("store question answers", () => {
  it("answers a choice with the option value and says the label", () => {
    expect(
      formAnswers([toy], { toy: "SunGrow Cat Crinkle Balls, 6 Pcs ($4.99)" }),
    ).toEqual({
      answers: { toy: "SunGrow Cat Crinkle Balls, 6 Pcs ($4.99)" },
      said: [
        {
          label: "Choose one cat toy",
          value: "SunGrow Cat Crinkle Balls, 6 pieces — $4.99",
        },
      ],
    });
  });

  it("waits until every required field has a valid value", () => {
    const quantity: QuestionField = {
      key: "qty",
      label: "Quantity",
      required: true,
      kind: "integer",
    };
    expect(formAnswers([toy, quantity], { qty: "2" }).answers).toBeNull();
    expect(
      formAnswers([quantity], { qty: "1.5" }).answers,
      "not an integer",
    ).toBeNull();
    expect(formAnswers([quantity], { qty: " 2 " }).answers).toEqual({
      qty: 2,
    });
  });

  it("skips empty optional fields", () => {
    const email: QuestionField = {
      key: "amazon_identifier",
      label: "Amazon email address or mobile number",
      required: false,
      kind: "text",
    };
    expect(formAnswers([email], { amazon_identifier: "  " })).toEqual({
      answers: {},
      said: [],
    });
    const gift: QuestionField = {
      key: "gift",
      label: "Gift wrap?",
      required: false,
      kind: "boolean",
    };
    expect(formAnswers([email, gift], { gift: false })).toEqual({
      answers: { gift: false },
      said: [{ label: "Gift wrap?", value: "No" }],
    });
  });

  it("labels each field when there are several", () => {
    const extras: QuestionField = {
      key: "extras",
      label: "Add-ons",
      required: false,
      kind: "choice",
      multiple: true,
      options: [
        { value: "wrap", label: "Gift wrap" },
        { value: "note", label: "Gift note" },
      ],
    };
    expect(
      formAnswers([toy, extras], {
        toy: "Catstages Squeak Squeak Mouse Cat Toy ($5.39)",
        extras: ["wrap", "note"],
      }),
    ).toEqual({
      answers: {
        toy: "Catstages Squeak Squeak Mouse Cat Toy ($5.39)",
        extras: ["wrap", "note"],
      },
      said: [
        {
          label: "Choose one cat toy",
          value: "Catstages Squeak Squeak Mouse Cat Toy — $5.39",
        },
        { label: "Add-ons", value: "Gift wrap, Gift note" },
      ],
    });
  });
});

describe("dock messages", () => {
  const run = { runId: "run-7", store: "travel.state.gov" };

  it("names the checkout and spells out each answer for the agent", () => {
    const note = dockNote(run, {
      kind: "answer",
      said: [
        { label: "Departure day", value: "12" },
        { label: "Departure date: month", value: 'October "early"' },
      ],
      secure: true,
    });
    expect(note).toBe(
      [
        "Answered the store in the checkout panel (checkout run-7 at travel.state.gov):",
        '- Departure day: "12"',
        '- Departure date: month: "October \\"early\\""',
        "- Private details: sent securely",
      ].join("\n"),
    );
    expect(readDockNote(note)).toEqual({
      kind: "answer",
      store: "travel.state.gov",
      values: ["12", 'October "early"', "private details sent securely"],
    });
  });

  it("reads approvals, older answer lines, and nothing else", () => {
    expect(readDockNote(dockNote(run, { kind: "approval" }))).toEqual({
      kind: "approval",
      store: "travel.state.gov",
    });
    expect(readDockNote("I approved the payment.")).toEqual({
      kind: "approval",
      store: null,
    });
    expect(readDockNote("Answered the store: Yes; No")).toEqual({
      kind: "answer",
      store: null,
      values: ["Yes; No"],
    });
    expect(readDockNote("Answered the store in my head")).toBeNull();
    expect(readDockNote("Buy me socks")).toBeNull();
  });

  it("says a cancel from the panel in one line the agent can't mistake", () => {
    const note = dockNote(run, { kind: "cancel" });
    expect(note).toBe(
      `Cancelled the checkout in the checkout panel (checkout ${run.runId} at travel.state.gov).`,
    );
    expect(readDockNote(note)).toEqual({
      kind: "cancel",
      store: "travel.state.gov",
    });
    expect(readDockNote(`${note}\nAnd buy it again`)).toBeNull();
    expect(readDockNote("Cancelled the checkout")).toBeNull();
  });
});

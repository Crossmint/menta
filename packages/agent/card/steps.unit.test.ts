import { toView } from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it } from "vitest";
import { localeMeta, CARD_STEP as serverCardStep } from "../src/mcp/card.js";
import { present } from "../src/mcp/moments.js";
import { en } from "../src/ui/i18n/en.js";
import { EN, type Ui } from "../src/ui/i18n/index.js";
import {
  answeredContext,
  CARD_STEP,
  type Checkout,
  cardLocale,
  isCurrent,
  keepsLastState,
  outcomeLine,
  type Pinned,
  paidOf,
  paidOnMentaMessage,
  paidPast,
  parseResult,
  passedStep,
  savedSaid,
  settledLine,
  stepDoneMessage,
  stepKey,
} from "./model.js";

const origin = "https://commerce.invalid";
const actionUrl = (runId: string) => `${origin}/checkouts/${runId}`;

function run(status: string, extra: Record<string, unknown> = {}) {
  return {
    runId: "run-1",
    revision: 1,
    status,
    createdAt: "2026-10-05T12:00:00.000Z",
    input: {
      request: { startUrl: "https://www.amazon.example/", task: "Cat toy" },
      constraints: { maxCost: { amount: "40.00", currency: "USD" } },
    },
    browser: { embedUrl: "https://live.invalid/LIVE_VIEW_CANARY" },
    ...extra,
  };
}

function asking(requestId: string, interaction: Record<string, unknown>) {
  return run("awaiting_input", {
    requiredAction: {
      requestId,
      request: { question: "Which toy?", expiresAt: null, interaction },
    },
  });
}

const toyQuestion = asking("req-toy", {
  kind: "form",
  fields: [
    {
      key: "toy",
      label: "Toy",
      required: true,
      handling: "standard",
      input: {
        kind: "choice",
        selection: { kind: "one" },
        options: [
          { value: "wand", label: "Feather wand" },
          { value: "mouse", label: "Catnip mouse" },
        ],
      },
    },
  ],
});
const payment = asking("req-pay", {
  kind: "payment",
  amount: { kind: "exact", value: "12.99", currency: "USD" },
  merchant: {
    name: "Amazon",
    url: "https://www.amazon.example",
    countryCode: "US",
  },
});

/** The card's view of a Crossmint run, through the real server's result. */
function card(raw: unknown, role?: "start" | "step") {
  const parsed = parseResult(
    JSON.parse(
      JSON.stringify(
        present(
          // Fixtures stand in for Crossmint's DTO.
          toView(raw as never, actionUrl),
          role ? { role } : {},
        ),
      ),
    ),
    origin,
  );
  if (!parsed) {
    throw new Error("fixture");
  }
  return parsed;
}

function pinOf(
  raw: unknown,
  role: "start" | "step",
  said: string | null = null,
): Pinned {
  const checkout = card(raw, role).checkout;
  return {
    role,
    step: role === "start" ? "working" : stepKey(checkout),
    pending: role === "start" ? null : checkout.pending,
    said,
  };
}

const live = (raw: unknown): Checkout => card(raw).checkout;
const placed = run("succeeded", {
  result: {
    summary: "Order placed.",
    purchase: {
      kind: "receipt_captured",
      receipt: {
        total: { amount: "12.99", currency: "USD" },
        merchantOrderId: "112-7",
      },
    },
  },
});
const cancelled = run("cancelled", { result: { summary: "Cancelled." } });
const alone = { earlierSameStep: false };

describe("step cards", () => {
  it("shares the step key with the server and reads what the card is drawn for", () => {
    expect(CARD_STEP).toBe(serverCardStep);
    expect(card(run("running")).role).toBe("start");
    expect(card(toyQuestion).role).toBe("step");
    expect(card(toyQuestion, "start").role).toBe("start");
  });

  it("names the step a checkout is on", () => {
    expect(stepKey(live(run("queued")))).toBe("working");
    expect(stepKey(live(run("running")))).toBe("working");
    expect(stepKey(live(toyQuestion))).toBe("ask:req-toy");
    expect(stepKey(live(placed))).toBe("end");
  });

  it("never keeps a card for a working checkout live: cards are for what the user does", () => {
    const start = pinOf(run("running"), "start");
    expect(isCurrent(start, live(run("running")), alone)).toBe(false);
    expect(isCurrent(start, live(toyQuestion), alone)).toBe(false);
    const working = pinOf(run("running"), "step");
    expect(working.step).toBe("working");
    expect(isCurrent(working, live(run("running")), alone)).toBe(false);
  });

  it("keeps a step card live while the checkout is on its step, and the first of two copies only", () => {
    const question = pinOf(toyQuestion, "step");
    expect(isCurrent(question, live(toyQuestion), alone)).toBe(true);
    // A newer card for a later step doesn't matter: this step has passed anyway.
    expect(isCurrent(question, live(payment), alone)).toBe(false);
    expect(isCurrent(question, live(run("running")), alone)).toBe(false);
    // show_checkout_step twice for the same step: the second copy settles.
    expect(
      isCurrent(question, live(toyQuestion), { earlierSameStep: true }),
    ).toBe(false);
  });

  it("settles a store question into the question and the user's answer, and private details into a check", () => {
    const still = { moved: false, duplicate: false };
    // Answered here: right away, while the checkout is still on the step.
    expect(
      passedStep(
        pinOf(toyQuestion, "step", "Feather wand"),
        live(toyQuestion),
        still,
      ),
    ).toEqual({
      kind: "question",
      question: "Which toy?",
      said: "Feather wand",
    });
    // Answered elsewhere (chat): the question, without an answer to repeat.
    expect(
      passedStep(pinOf(toyQuestion, "step"), live(run("running")), {
        moved: true,
        duplicate: false,
      }),
    ).toEqual({ kind: "question", question: "Which toy?", said: "" });
    // Not yet answered, or a second copy: the card isn't settled this way.
    expect(
      passedStep(pinOf(toyQuestion, "step"), live(toyQuestion), still),
    ).toBeNull();
    expect(
      passedStep(
        pinOf(toyQuestion, "step", "Feather wand"),
        live(toyQuestion),
        {
          moved: false,
          duplicate: true,
        },
      ),
    ).toBeNull();
    // Payments keep their one line.
    expect(passedStep(pinOf(payment, "step"), live(placed), still)).toBeNull();
  });

  it("keeps a step card as it was when the checkout stops, and settles it when the order is placed", () => {
    const question = pinOf(toyQuestion, "step");
    expect(keepsLastState(question, live(cancelled), true)).toBe(true);
    expect(keepsLastState(question, live(run("failed")), true)).toBe(true);
    expect(keepsLastState(question, live(placed), true)).toBe(false);
    expect(keepsLastState(question, live(toyQuestion), true)).toBe(false);
    // The receipt card (drawn for the end) is not a step.
    expect(keepsLastState(pinOf(placed, "step"), live(placed), true)).toBe(
      false,
    );
  });

  it("settles a card replayed after its checkout stopped: none of its own reads saw it active", () => {
    const question = pinOf(toyQuestion, "step");
    // A reload or an old conversation: drawn from the old tool result, its
    // first read finds the checkout already stopped.
    expect(keepsLastState(question, live(cancelled), false)).toBe(false);
    expect(keepsLastState(question, live(run("failed")), false)).toBe(false);
    expect(keepsLastState(pinOf(payment, "step"), live(cancelled), false)).toBe(
      false,
    );
    expect(keepsLastState(pinOf(payment, "step"), live(cancelled), true)).toBe(
      true,
    );
  });

  it("reads what the user answered from ChatGPT's saved widget state, including cards saved before `said`", () => {
    expect(savedSaid({ said: "Feather wand" })).toBe("Feather wand");
    expect(savedSaid({ said: "" })).toBe("");
    // Saved as the whole settled line before this release.
    expect(savedSaid({ done: "Answered · Feather wand" })).toBe("Feather wand");
    expect(savedSaid({ done: "Respondido · Talla: M; Color: rojo" })).toBe(
      "Talla: M; Color: rojo",
    );
    expect(savedSaid({ done: "Sent securely" })).toBe("");
    expect(savedSaid({})).toBeNull();
    expect(savedSaid(undefined)).toBeNull();
  });

  it("settles a payment card into one line about its step", () => {
    const leader = { moved: true, duplicate: false, leader: true };
    const older = { moved: true, duplicate: false, leader: false };
    expect(settledLine(pinOf(payment, "step"), live(placed), older)).toEqual({
      tone: "muted",
      text: "Approved",
    });
    // The payment, approved, then the order: the newest card carries the outcome.
    expect(settledLine(pinOf(payment, "step"), live(placed), leader)).toEqual({
      tone: "success",
      text: "Approved · Order placed",
    });
    // The start card points at the step below, then just says it started.
    const start = pinOf(run("running"), "start");
    expect(settledLine(start, live(toyQuestion), older)).toEqual({
      tone: "attention",
      text: "Waiting on you below",
    });
    expect(settledLine(start, live(run("running")), older).text).toBe(
      "Checkout started · up to $40.00",
    );
    // A second copy of a step that is still open.
    expect(
      settledLine(pinOf(toyQuestion, "step"), live(toyQuestion), {
        moved: false,
        duplicate: true,
        leader: true,
      }).text,
    ).toBe("Shown above");
  });

  it("tells the host what the user did in plain words, and the model to wait for the next step", () => {
    const checkout = live(toyQuestion);
    expect(
      stepDoneMessage(checkout, { kind: "answer", said: "Feather wand" }),
    ).toBe("Feather wand");
    expect(
      answeredContext(checkout, "Which toy?", "Feather wand", "req-toy"),
    ).toContain("Call continue with runId run-1 and afterRequestId req-toy");
  });
});

describe("the card's language", () => {
  /** A stand-in Spanish catalog: only the lines this test reads. */
  const es: Ui = {
    ...EN,
    locale: "es",
    tag: "es",
    m: {
      ...en,
      outcome: { ...en.outcome, receipt: "Pedido confirmado por la tienda." },
      settled: {
        ...en.settled,
        answered: "Respondido",
        started: "Pago iniciado · hasta {amount}",
      },
    },
  };

  it("writes the card's lines in the language it is given", () => {
    expect(outcomeLine(live(placed), es)).toBe(
      "Pedido confirmado por la tienda.",
    );
    expect(
      settledLine(
        pinOf(toyQuestion, "step"),
        live(run("running")),
        { moved: true, duplicate: false, leader: false },
        es,
      ).text,
    ).toBe("Respondido");
    const start = pinOf(run("running"), "start");
    expect(
      settledLine(
        start,
        live(run("running")),
        { moved: false, duplicate: false, leader: false },
        es,
      ).text,
    ).toMatch(/^Pago iniciado · hasta 40,00\sUS\$$/);
    // English by default.
    expect(outcomeLine(live(placed))).toBe(
      "Order confirmed by the store. Receipt captured.",
    );
  });

  it("keeps what the model reads in English", () => {
    const checkout = live(payment);
    expect(stepDoneMessage(checkout, { kind: "protected" })).toBe(
      "Sent amazon.example the details securely",
    );
    expect(
      answeredContext(checkout, "Which toy?", "Feather wand", "req-toy"),
    ).toContain("Call continue with runId run-1 and afterRequestId req-toy");
  });

  it("reads the language a show result carries, and where it came from", () => {
    const shown = (meta: Record<string, string>) => {
      const result = present(toView(toyQuestion as never, actionUrl), {
        role: "step",
        meta,
      });
      return parseResult(JSON.parse(JSON.stringify(result)), origin);
    };
    const fromAssistant = shown(localeMeta({ "openai/locale": "en-US" }, "es"));
    expect(fromAssistant?.locale).toBe("es");
    expect(fromAssistant?.localeFromAssistant).toBe(true);
    const fromHost = shown(localeMeta({ "openai/locale": "fr-FR" }));
    expect(fromHost?.locale).toBe("fr-FR");
    expect(fromHost?.localeFromAssistant).toBe(false);
    const none = shown({});
    expect(none?.locale).toBeNull();
  });

  it("picks the assistant's language, then the host's, then the request's", () => {
    const sources = {
      assistant: null,
      hostContext: undefined,
      openAi: undefined,
      request: null,
      browser: undefined,
    };
    expect(cardLocale(sources)).toBe("en");
    expect(cardLocale({ ...sources, browser: "it-IT" })).toBe("it");
    expect(cardLocale({ ...sources, request: "fr-FR", browser: "it-IT" })).toBe(
      "fr",
    );
    expect(cardLocale({ ...sources, request: "fr-FR" })).toBe("fr");
    expect(cardLocale({ ...sources, request: "fr-FR", openAi: "de-DE" })).toBe(
      "de",
    );
    expect(
      cardLocale({
        ...sources,
        request: "fr-FR",
        openAi: "de-DE",
        hostContext: "ja-JP",
      }),
    ).toBe("ja");
    expect(
      cardLocale({
        assistant: "es",
        browser: "it-IT",
        request: "fr-FR",
        openAi: "de-DE",
        hostContext: "ja-JP",
      }),
    ).toBe("es");
    // An unsupported language reads English rather than breaking.
    expect(cardLocale({ ...sources, assistant: "tlh" })).toBe("en");
    expect(cardLocale({ ...sources, hostContext: "<x>" })).toBe("en");
  });
});

describe("a payment that went through on Menta", () => {
  const at = (status: string, requestId?: string) =>
    ({
      status,
      pending: requestId
        ? ({ kind: "payment", requestId } as unknown as Checkout["pending"])
        : null,
    }) as Pick<Checkout, "status" | "pending">;

  it("counts only a checkout that moved on past that payment", () => {
    expect(paidPast(at("awaiting_input", "req-pay"), "req-pay")).toBe(false);
    expect(paidPast(at("running"), "req-pay")).toBe(true);
    expect(
      paidPast(
        {
          status: "awaiting_input",
          pending: {
            kind: "question",
            requestId: "req-next",
          } as unknown as Checkout["pending"],
        },
        "req-pay",
      ),
    ).toBe(true);
    // Asked for a payment again: the charge may have failed.
    expect(paidPast(at("awaiting_input", "req-next"), "req-pay")).toBe(false);
    expect(paidPast(at("succeeded"), "req-pay")).toBe(true);
    for (const status of ["cancelled", "failed", "blocked"]) {
      expect(paidPast(at(status), "req-pay"), status).toBe(false);
    }
  });

  it("says it only when the server confirms a spending limit paid it", () => {
    expect(paidOf({ _meta: { "oca/paid": true } })).toBe(true);
    expect(paidOf({ _meta: { "oca/paid": false } })).toBe(false);
    expect(paidOf({ _meta: {} })).toBe(false);
    expect(paidOf({ isError: true, _meta: { "oca/paid": true } })).toBe(false);
    expect(paidOf(undefined)).toBe(false);
  });

  it("tells the assistant in the user's words, naming the store", () => {
    expect(paidOnMentaMessage({ store: "ubereats.com" })).toBe(
      "I set up a spending limit on Menta and it paid the ubereats.com checkout",
    );
  });
});

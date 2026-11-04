import { toView } from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it } from "vitest";
import {
  CARD_CREDENTIALS as serverCredentials,
  SECURE_STEP as serverSecureStep,
} from "../src/mcp/card.js";
import { present } from "../src/mcp/moments.js";
import { uiFor } from "../src/ui/i18n/index.js";
import {
  CARD_CREDENTIALS,
  canRunSecureStep,
  type Pending,
  parseCredentials,
  parseResult,
  SECURE_STEP,
  type SecureEvent,
  type SecureState,
  secretAsk,
  secretTitle,
  secureDoneContext,
  secureStep,
  startSecureStep,
} from "./model.js";

const origin = "https://commerce.invalid";
const actionUrl = (runId: string) => `${origin}/checkouts/${runId}`;

function awaiting(interaction: Record<string, unknown>, requestId = "req-1") {
  return {
    runId: "run-1",
    revision: 1,
    status: "awaiting_input",
    createdAt: "2026-10-05T12:00:00.000Z",
    input: {
      request: { startUrl: "https://www.store.invalid/item", task: "One mug" },
      constraints: { maxCost: { amount: "40.00", currency: "USD" } },
    },
    browser: null,
    requiredAction: {
      requestId,
      request: {
        question: "Sign in",
        expiresAt: "2026-10-05T13:00:00.000Z",
        interaction,
      },
    },
  };
}

/** The card's view of a real server result. */
function snapshot(raw: unknown, secure = true) {
  // biome-ignore lint/suspicious/noExplicitAny: fixtures stand in for Crossmint's DTO
  const result = present(toView(raw as any, actionUrl), { secureStep: secure });
  return parseResult(JSON.parse(JSON.stringify(result)), origin);
}

const payment = awaiting({
  kind: "payment",
  amount: { kind: "maximum", value: "31.20", currency: "USD" },
  merchant: { name: "Store", url: "https://store.invalid", countryCode: "US" },
});
const signIn = awaiting({
  kind: "form",
  fields: [
    {
      key: "email",
      label: "Email",
      required: true,
      handling: "standard",
      input: { kind: "text", placeholder: "you@example" },
    },
    {
      key: "password",
      label: "Password",
      required: true,
      handling: "protected",
      input: {
        kind: "text",
        display: "masked",
        autoComplete: "current-password",
        injected: "<script>",
      },
    },
  ],
});

const ready = { secureStep: true, canCallTools: true, frozen: false };

describe("card secure step: parsing", () => {
  it("shares its _meta keys with the server", () => {
    expect(SECURE_STEP).toBe(serverSecureStep);
    expect(CARD_CREDENTIALS).toBe(serverCredentials);
  });

  it("reads the server's secure-step flag", () => {
    expect(snapshot(payment)?.secureStep).toBe(true);
    expect(snapshot(payment, false)?.secureStep).toBe(false);
  });

  it("keeps the merchant and expiry Crossmint's authorization needs", () => {
    expect(snapshot(payment)?.checkout.pending).toMatchObject({
      kind: "payment",
      merchant: "Store",
      merchantUrl: "https://store.invalid",
      merchantCountry: "US",
      expiresAt: "2026-10-05T13:00:00.000Z",
      amount: { amount: "31.20", currency: "USD", exact: false },
    });
  });

  it("rebuilds a mixed form: ordinary fields plus clean Crossmint descriptors", () => {
    const pending = snapshot(signIn)?.checkout.pending;
    expect(pending).toMatchObject({ kind: "protected" });
    expect(pending?.kind === "protected" && pending.fields).toEqual([
      {
        handling: "standard",
        field: {
          key: "email",
          label: "Email",
          required: true,
          kind: "text",
          multiple: false,
          options: [],
          placeholder: "you@example",
        },
      },
      {
        handling: "protected",
        descriptor: {
          key: "password",
          label: "Password",
          required: true,
          handling: "protected",
          // Unknown keys never reach Crossmint's frame.
          input: {
            kind: "text",
            display: "masked",
            autoComplete: "current-password",
          },
        },
      },
    ]);
  });

  it("keeps a form it can't show in the card on the secure page", () => {
    const multiline = awaiting({
      kind: "form",
      fields: [
        {
          key: "note",
          label: "Note",
          required: true,
          handling: "protected",
          input: { kind: "text", multiline: true },
        },
      ],
    });
    const pending = snapshot(multiline)?.checkout.pending ?? null;
    expect(pending).toMatchObject({ kind: "protected", fields: [] });
    expect(canRunSecureStep(pending, ready)).toBe(false);
    expect(startSecureStep(pending, ready)).toEqual({ phase: "link" });
  });

  it("accepts credentials only from _meta, well formed and unexpired", () => {
    const jwt = "aaa.bbb.ccc";
    const good = {
      content: [{ type: "text", text: "Secure step ready." }],
      _meta: {
        [CARD_CREDENTIALS]: {
          apiKey: "ck_production_x",
          jwt,
          expiresAt: Date.now() + 60_000,
        },
      },
    };
    expect(parseCredentials(good)).toMatchObject({ jwt });
    expect(parseCredentials({ ...good, isError: true })).toBeNull();
    expect(
      parseCredentials({ structuredContent: good._meta[CARD_CREDENTIALS] }),
    ).toBeNull();
    for (const bad of [
      { apiKey: "sk_production_x", jwt, expiresAt: Date.now() + 60_000 },
      { apiKey: "ck_production_x", jwt: "nope", expiresAt: Date.now() + 1 },
      { apiKey: "ck_production_x", jwt, expiresAt: Date.now() - 1 },
    ]) {
      expect(parseCredentials({ _meta: { [CARD_CREDENTIALS]: bad } })).toBe(
        null,
      );
    }
  });
});

describe("card secure step: when to try it in the card", () => {
  const pay = snapshot(payment)?.checkout.pending ?? null;
  const form = snapshot(signIn)?.checkout.pending ?? null;

  it.each([
    ["the server offers it", ready, true],
    ["the server doesn't", { ...ready, secureStep: false }, false],
    ["the host can't call tools", { ...ready, canCallTools: false }, false],
    ["a newer card took over", { ...ready, frozen: true }, false],
  ])("tries it when %s", (_label, options, expected) => {
    expect(canRunSecureStep(form, options)).toBe(expected);
  });

  it("never for questions or payments", () => {
    const question: Pending = {
      kind: "question",
      requestId: "q",
      question: "?",
      fields: [],
    };
    expect(canRunSecureStep(question, ready)).toBe(false);
    expect(canRunSecureStep(pay, ready)).toBe(false);
  });
});

/** Runs events from a fresh step and returns every phase it passed through. */
function play(...events: SecureEvent["type"][]) {
  let state: SecureState = { phase: "loading", requestId: "req-1" };
  const phases: string[] = [state.phase];
  for (const type of events) {
    state = secureStep(state, { type } as SecureEvent);
    phases.push(state.phase);
  }
  return phases;
}

describe("card secure step: fallback rules", () => {
  it("runs the happy path to sent", () => {
    expect(play("alive", "submit", "submitted")).toEqual([
      "loading",
      "ready",
      "sending",
      "sent",
    ]);
  });

  it.each([
    [["unavailable"], "fallback"],
    [["blocked"], "fallback"],
    [["timeout"], "fallback"],
    [["error"], "fallback"],
    [["alive", "blocked"], "fallback"],
    [["alive", "error"], "fallback"],
    [["alive", "submit", "submit-failed"], "fallback"],
  ] as const)("falls back to the secure page after %j", (events, last) => {
    expect(play(...events).at(-1)).toBe(last);
  });

  it("ignores a late timeout once Crossmint answered", () => {
    expect(play("alive", "timeout").at(-1)).toBe("ready");
  });

  it("returns to the form when the user has something to fix", () => {
    expect(play("alive", "submit", "invalid").at(-1)).toBe("ready");
  });

  it("doesn't drop a send in flight, or reopen once sent", () => {
    expect(play("alive", "submit", "error", "blocked").at(-1)).toBe("sending");
    expect(play("alive", "submit", "submitted", "error", "retry").at(-1)).toBe(
      "sent",
    );
  });

  it("lets the user try the card again after a fallback", () => {
    expect(play("timeout", "retry", "alive")).toEqual([
      "loading",
      "fallback",
      "loading",
      "ready",
    ]);
  });

  it("stays on the link when the step never ran in the card", () => {
    expect(secureStep({ phase: "link" }, { type: "alive" })).toEqual({
      phase: "link",
    });
  });

  it("tells the model what happened without any value", () => {
    const view = snapshot(signIn);
    const pending = view?.checkout.pending;
    if (!view || pending?.kind !== "protected") {
      throw new Error("fixture");
    }
    const text = secureDoneContext(view.checkout, pending);
    expect(text).toContain("entered the private details");
    expect(text).not.toMatch(/orderIntent|jwt|ck_/i);
  });
});

describe("card secure step: its title", () => {
  const secret = (input: Record<string, unknown>, key = "secret") => ({
    key,
    label: "Anything",
    required: true,
    handling: "protected",
    input: { kind: "text", ...input },
  });

  it("reads what the store asks for from Crossmint's input hints, not label words", () => {
    expect(
      secretAsk([
        { key: "email", handling: "standard" },
        secret({ autoComplete: "current-password" }),
      ]),
    ).toBe("signIn");
    // A sign-in that also asks for a code is still a sign-in.
    expect(
      secretAsk([
        secret({ autoComplete: "one-time-code" }, "code"),
        secret({ autoComplete: "current-password" }),
      ]),
    ).toBe("signIn");
    expect(secretAsk([secret({ autoComplete: "new-password" })])).toBe(
      "newPassword",
    );
    expect(secretAsk([secret({ autoComplete: "one-time-code" })])).toBe("code");
    expect(secretAsk([secret({ inputMode: "numeric" })])).toBe("code");
    // Typed as a number by Crossmint's descriptor, not only by its keyboard.
    expect(secretAsk([secret({ kind: "integer" })])).toBe("code");
    expect(secretAsk([secret({ kind: "number" })])).toBe("code");
    // Two numeric fields aren't one code; a label never decides it.
    expect(
      secretAsk([
        secret({ inputMode: "numeric" }, "a"),
        secret({ inputMode: "numeric" }, "b"),
      ]),
    ).toBe("details");
    expect(
      secretAsk([{ ...secret({}), label: "Password (one-time code)" }]),
    ).toBe("details");
    expect(secretAsk(undefined)).toBe("details");
  });

  it("parses it with the step, even for a form only the secure page can show", () => {
    const pending = snapshot(signIn)?.checkout.pending;
    expect(pending?.kind === "protected" && pending.ask).toBe("signIn");
  });

  it("titles the step by what the store asks for, with the store's name", () => {
    expect(secretTitle("signIn", "Uber Eats", "Log in")).toEqual({
      title: "Sign in to Uber Eats",
      line: "Uber Eats is asking you to sign in to continue the order.",
    });
    expect(secretTitle("newPassword", "Uber Eats", "")).toEqual({
      title: "Create your Uber Eats password",
      line: null,
    });
    expect(secretTitle("code", "Uber Eats", "Code?")).toEqual({
      title: "Enter the code Uber Eats sent you",
      line: "Check your email or phone for it.",
    });
    // Other details: the store's own question under the title, if any.
    expect(secretTitle("details", "Uber Eats", " Your PIN, please ")).toEqual({
      title: "Uber Eats needs a few private details",
      line: "Your PIN, please",
    });
    expect(secretTitle("details", "Uber Eats", "").line).toBeNull();
    expect(secretTitle("signIn", "Uber Eats", "", uiFor("es")).title).toBe(
      "Inicia sesión en Uber Eats",
    );
  });
});

import type { QuestionField } from "@oca/crossmint-agent-checkouts/checkouts";
import { describe, expect, it } from "vitest";
import {
  askAgain,
  formRequest,
  formSupport,
  noForms,
  questionForm,
  readQuestion,
  sameForm,
} from "./forms.js";

const caps = (value: unknown) => ({
  "io.modelcontextprotocol/clientCapabilities": value,
});

function question(fields: QuestionField[], text = "Pick your options") {
  return {
    kind: "question" as const,
    requestId: "req-1",
    question: text,
    expiresAt: null,
    fields,
  };
}

const size: QuestionField = {
  key: "size",
  label: "Size",
  required: true,
  kind: "choice",
  multiple: false,
  options: [
    { value: "s", label: "Small" },
    { value: "m", label: "Medium" },
  ],
};
const extras: QuestionField = {
  key: "extras",
  label: "Extras",
  required: false,
  kind: "choice",
  multiple: true,
  options: [
    { value: "cheese", label: "Cheese" },
    { value: "bacon", label: "Bacon" },
  ],
};
const gift: QuestionField = {
  key: "gift",
  label: "Gift wrap",
  required: true,
  kind: "boolean",
};
const count: QuestionField = {
  key: "count",
  label: "How many",
  required: false,
  kind: "integer",
};
const note: QuestionField = {
  key: "note",
  label: "Note",
  required: false,
  kind: "text",
  placeholder: "For the driver",
};

describe("MCP-FORMS-001 what a client can draw", () => {
  it.each([
    [undefined, noForms],
    [caps({}), noForms],
    [caps({ elicitation: {} }), { forms: true, url: false, openai: false }],
    [
      caps({ elicitation: { form: {} } }),
      { forms: true, url: false, openai: false },
    ],
    [
      caps({ elicitation: { url: {} } }),
      { forms: false, url: true, openai: false },
    ],
    [
      caps({ elicitation: { form: {}, url: {} } }),
      { forms: true, url: true, openai: false },
    ],
    [
      caps({
        elicitation: { form: {} },
        extensions: { "openai/elicitation": { form: {} } },
      }),
      { forms: true, url: false, openai: true },
    ],
    // OpenAI's forms over MRTR need standard form mode too.
    [caps({ extensions: { "openai/elicitation": { form: {} } } }), noForms],
  ])("%o → %o", (envelope, expected) => {
    expect(formSupport(envelope)).toEqual(expected);
  });

  it("gives a card host no form or link, whatever it declares", () => {
    const chatgpt = caps({
      elicitation: { form: {}, url: {} },
      extensions: { "openai/elicitation": { form: {} } },
    });
    expect(formSupport(chatgpt, { cardHost: true })).toEqual(noForms);
  });

  it("puts an OpenAI form's schema in its _meta, beside an empty one", () => {
    const form = questionForm(question([size]), { openai: true });
    if (!form) {
      throw new Error("expected a form");
    }
    expect(formRequest(form, { openai: true })).toEqual({
      method: "elicitation/create",
      params: {
        mode: "form",
        message: "Pick your options",
        requestedSchema: { type: "object", properties: {} },
        _meta: {
          "openai/elicitation": { requestedSchema: form.requestedSchema },
        },
      },
    });
    expect(formRequest(form).params).toMatchObject({
      requestedSchema: form.requestedSchema,
    });
    expect(formRequest(form).params).not.toHaveProperty("_meta");
  });
});

describe("MCP-FORMS-002 the store's question as the dock asks it", () => {
  it("maps every field kind, with Something else last and nothing required", () => {
    const form = questionForm(question([size, extras, gift, count, note]), {
      openai: false,
    });
    expect(form?.message).toBe("Pick your options");
    expect(form?.requestedSchema).toEqual({
      type: "object",
      properties: {
        size: {
          type: "string",
          title: "Size",
          oneOf: [
            { const: "s", title: "Small" },
            { const: "m", title: "Medium" },
          ],
        },
        extras: {
          type: "array",
          title: "Extras",
          items: {
            anyOf: [
              { const: "cheese", title: "Cheese" },
              { const: "bacon", title: "Bacon" },
            ],
          },
        },
        gift: {
          type: "string",
          title: "Gift wrap",
          oneOf: [
            { const: "yes", title: "Yes" },
            { const: "no", title: "No" },
          ],
        },
        count: { type: "integer", title: "How many" },
        note: {
          type: "string",
          title: "Note",
          maxLength: 4000,
          description: "For the driver",
        },
        somethingElse: {
          type: "string",
          title: "Something else",
          description: "Tell the store what you want instead",
          maxLength: 1000,
        },
      },
    });
  });

  it("keeps Something else apart from a store field of the same key", () => {
    const form = questionForm(
      question([{ ...note, key: "somethingElse" }]),
      noForms,
    );
    expect(form?.other).toBe("somethingElse_");
  });

  it("draws thumbnails only for OpenAI hosts and https pictures", () => {
    const pictured: QuestionField = {
      ...size,
      options: [
        { value: "s", label: "Small", image: "https://img.invalid/s.png" },
        { value: "m", label: "Medium", image: "http://img.invalid/m.png" },
      ],
    };
    const standard = questionForm(question([pictured]), noForms);
    expect(JSON.stringify(standard)).not.toContain("thumbnail");
    const openai = questionForm(question([pictured]), { openai: true });
    expect(openai?.requestedSchema.properties.size).toEqual({
      type: "string",
      title: "Size",
      maxLength: 1000,
      "x-openai-suggestions": [
        {
          const: "s",
          title: "Small",
          "x-openai-thumbnail": { src: "https://img.invalid/s.png" },
        },
        { const: "m", title: "Medium" },
      ],
    });
    expect(openai?.other).toBeNull();
  });

  it.each([
    { label: "Order code", sensitive: true as const },
    { label: "Password" },
    { label: "Card number" },
    { label: "Enter the verification code" },
    { label: "PIN" },
  ])("never asks for %o in a form", (change) => {
    expect(questionForm(question([{ ...note, ...change }]), noForms)).toBe(
      null,
    );
  });
});

describe("MCP-FORMS-003 reading the answers back", () => {
  const all = question([size, extras, gift, count, note]);
  const form = questionForm(all, noForms);
  if (!form) {
    throw new Error("expected a form");
  }

  it("turns the form into answers for the store and the dock's note", () => {
    expect(
      readQuestion(form, all, {
        size: "m",
        extras: ["bacon"],
        gift: "no",
        count: 2,
        note: " Ring twice ",
      }),
    ).toEqual({
      kind: "answers",
      answers: {
        size: "m",
        extras: ["bacon"],
        gift: false,
        count: 2,
        note: "Ring twice",
      },
      said: [
        { label: "Size", value: "Medium" },
        { label: "Extras", value: "Bacon" },
        { label: "Gift wrap", value: "No" },
        { label: "How many", value: "2" },
        { label: "Note", value: "Ring twice" },
      ],
    });
  });

  it("lets Something else replace the answers, as in the dock", () => {
    expect(
      readQuestion(form, all, { size: "s", somethingElse: " Navy, size M " }),
    ).toEqual({ kind: "instead", text: "Navy, size M" });
  });

  it.each([
    [{}, "Answer Size and Gift wrap, or tell the store"],
    [{ gift: "yes" }, "Answer Size, or tell the store"],
    [{ size: "xl", gift: "yes" }, "Check Size."],
    [{ size: "s", gift: "maybe" }, "Check Gift wrap."],
    [{ size: "s", gift: "yes", count: 1.5 }, "Check How many."],
    [{ size: "s", gift: "yes", extras: ["ham"] }, "Check Extras."],
  ])("says what's missing or wrong for %o", (content, problem) => {
    const read = readQuestion(form, all, content);
    expect(read.kind).toBe("incomplete");
    expect(read.kind === "incomplete" && read.problem).toContain(problem);
  });

  it("asks at least one thing when nothing is required", () => {
    const optional = question([count]);
    const small = questionForm(optional, noForms);
    expect(small && readQuestion(small, optional, {})).toEqual({
      kind: "incomplete",
      problem:
        "Answer the question, or tell the store what you want instead under Something else.",
    });
  });

  it("reads a typed choice on OpenAI hosts as Something else", () => {
    const both = question([size, gift]);
    const openai = questionForm(both, { openai: true });
    expect(openai && readQuestion(openai, both, { size: "m" })).toMatchObject({
      kind: "incomplete",
      problem: "Answer Gift wrap, or type what you want instead.",
    });
    expect(
      openai && readQuestion(openai, both, { size: "XL tall", gift: "yes" }),
    ).toEqual({ kind: "instead", text: "Size: XL tall; Gift wrap: Yes" });
    expect(
      openai && readQuestion(openai, both, { size: "m", gift: "yes" }),
    ).toMatchObject({ kind: "answers", answers: { size: "m", gift: true } });
  });

  it("asks again with the problem first and the user's entries kept", () => {
    const again = askAgain(form, "Check Size.", { size: "xl", note: "" });
    expect(again.message).toBe("Check Size.\n\nPick your options");
    expect(again.requestedSchema.properties.size?.default).toBe("xl");
    expect(again.requestedSchema.properties.note).not.toHaveProperty("default");
  });
});

describe("MCP-FORMS-005 a state answers only its own form", () => {
  it("matches form, checkout and question", () => {
    const asked = { form: "question", runId: "r", requestId: "q" } as const;
    expect(sameForm(asked, asked)).toBe(true);
    expect(sameForm(undefined, asked)).toBe(false);
    expect(sameForm({ ...asked, requestId: "q2" }, asked)).toBe(false);
    expect(sameForm({ ...asked, form: "secure" }, asked)).toBe(false);
  });
});

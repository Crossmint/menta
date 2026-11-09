import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FormEntry } from "./answers.js";
import { RequestForm } from "./question.js";

function render(
  entries: readonly FormEntry[],
  options: { disabled?: boolean; pick?: boolean } = {},
) {
  return renderToStaticMarkup(
    createElement(RequestForm, {
      requestId: "req-1",
      question: "Which one?",
      expiresAt: null,
      entries,
      sent: undefined,
      onSubmit: async () => {},
      renderProtected: () => createElement("div", { "data-slot": "" }),
      ...options,
    }),
  );
}

const password: FormEntry = {
  kind: "protected",
  field: { key: "password", label: "Uber Eats password", required: true },
};
const size: FormEntry = {
  kind: "standard",
  field: {
    key: "size",
    label: "Size",
    required: true,
    kind: "choice",
    options: [
      { value: "s", label: "Small" },
      { value: "m", label: "Medium" },
    ],
  },
};
const note: FormEntry = {
  kind: "standard",
  field: { key: "note", label: "Note", required: true, kind: "text" },
};

/** The opening tags of every control in the markup. */
const controls = (html: string) =>
  html.match(/<(input|button|select|textarea)\b[^>]*>/g) ?? [];

describe("the request form", () => {
  it("shows a private field's label even when it's the only field", () => {
    const html = render([password]);
    expect(html).toContain('<span class="label text-muted">Uber Eats password');
    expect(html).not.toContain('class="sr-only">Uber Eats password');
  });

  it("shows the store's question above a labelled private field", () => {
    expect(render([password])).toContain("Which one?");
  });

  it("keeps a single ordinary question's label for screen readers only", () => {
    expect(render([note])).toContain('class="sr-only">Note</legend>');
  });

  it("disables every control when frozen on a stopped checkout", () => {
    for (const html of [
      render([size], { disabled: true, pick: true }),
      render([note], { disabled: true }),
      render([size, note], { disabled: true }),
      render([password], { disabled: true }),
    ]) {
      const found = controls(html);
      expect(found.length).toBeGreaterThan(0);
      for (const tag of found) {
        expect(tag).toMatch(/\bdisabled=""/);
      }
    }
    // Live, the same form answers.
    expect(
      controls(render([note])).some((tag) => !tag.includes("disabled")),
    ).toBe(true);
  });
});

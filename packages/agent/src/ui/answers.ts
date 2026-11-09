/** The store-question logic both checkout views share, DOM-free. */

import { EN, type Ui } from "./i18n/index.js";

/**
 * One ordinary field of a store's question, as both the web app's checkout
 * views and the in-host card parse it.
 */
export interface UiField {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly kind: "text" | "number" | "integer" | "boolean" | "choice";
  readonly multiple?: boolean;
  readonly options?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly placeholder?: string | null;
}

/** A field of a request: ordinary, or private (entered in Crossmint's protected input). */
export type FormEntry =
  | { readonly kind: "standard"; readonly field: UiField }
  | {
      readonly kind: "protected";
      readonly field: {
        readonly key: string;
        readonly label: string;
        readonly required: boolean;
      };
    };

/** What the user has entered for one field, before it becomes an answer. */
export type Draft = string | string[] | boolean | undefined;

/** One answered field, in the user's terms. */
export interface Said {
  readonly label: string;
  readonly value: string;
}

export type Answer = string | number | boolean | string[];

function answerOf(field: UiField, draft: Draft) {
  if (field.kind === "boolean") {
    return typeof draft === "boolean" ? draft : undefined;
  }
  if (field.kind === "choice") {
    if (field.multiple) {
      return Array.isArray(draft) && draft.length > 0 ? draft : undefined;
    }
    return typeof draft === "string" && draft ? draft : undefined;
  }
  const text = typeof draft === "string" ? draft.trim() : "";
  if (!text) {
    return undefined;
  }
  if (field.kind === "text") {
    return text;
  }
  const number = Number(text);
  return Number.isFinite(number) &&
    (field.kind === "number" || Number.isInteger(number))
    ? number
    : null;
}

/**
 * Turn drafts into Crossmint form answers (choice fields answer with option
 * values) and what was answered, as the user saw it. `answers` is null until
 * every required field has a valid value; empty optional fields are left out.
 */
export function formAnswers(
  fields: readonly UiField[],
  drafts: Record<string, Draft>,
  ui: Ui = EN,
): { answers: Record<string, Answer> | null; said: Said[] } {
  const answers: Record<string, Answer> = {};
  const said: Said[] = [];
  for (const field of fields) {
    const value = answerOf(field, drafts[field.key]);
    if (value === null || (value === undefined && field.required)) {
      return { answers: null, said: [] };
    }
    if (value === undefined) {
      continue;
    }
    answers[field.key] = value;
    const labels = (Array.isArray(value) ? value : [value]).map((item) =>
      typeof item === "boolean"
        ? item
          ? ui.m.common.yes
          : ui.m.common.no
        : (field.options?.find((option) => option.value === item)?.label ??
          String(item)),
    );
    said.push({ label: field.label, value: labels.join(", ") });
  }
  return { answers, said };
}

/** Single-choice lists longer than this are a dropdown rather than rows. */
export const LONG_LIST = 6;

export function optionsOf(field: UiField, ui: Ui = EN) {
  return field.kind === "boolean"
    ? [
        { value: "yes", label: ui.m.common.yes },
        { value: "no", label: ui.m.common.no },
      ]
    : (field.options ?? []);
}

/**
 * Whether a request is one pick away from an answer: a single yes/no or
 * single-choice field short enough for rows. The in-host card answers those
 * with a Choose button per option.
 */
export function onePick(entries: readonly FormEntry[]) {
  const only = entries.length === 1 ? entries[0] : undefined;
  if (only?.kind !== "standard") {
    return null;
  }
  const field = only.field;
  return field.kind === "boolean" ||
    (field.kind === "choice" &&
      !field.multiple &&
      (field.options?.length ?? 0) > 0 &&
      (field.options?.length ?? 0) <= LONG_LIST)
    ? field
    : null;
}

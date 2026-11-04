import {
  CLIENT_CAPABILITIES_META_KEY,
  createRequestStateCodec,
  type InputRequest,
  type RequestStateCodec,
} from "@modelcontextprotocol/server";
import type {
  CheckoutPending,
  QuestionField,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { asksForSecret } from "@oca/crossmint-agent-checkouts/secret-fields";
import { declaresCards } from "./clients.js";

/**
 * Native host forms: MCP elicitation over multi round-trip requests (MRTR,
 * protocol 2026-07-28). A tool returns `input_required` with a form or a
 * link; the host asks the user, then calls the same tool again with the
 * answers and the signed `requestState` we gave it. The server keeps
 * nothing: the retry carries the same arguments, and the checkout is read
 * again from Crossmint.
 *
 * The forms mirror the web dock: the store's question as the message, its
 * field and option labels, Yes/No for booleans, "Something else" for an
 * answer the options don't offer. Addresses are asked in chat (address-tools.ts).
 *
 * Payment approval and private details are never a form. Where the host
 * supports URL elicitation, they open Menta (the spending limit request page
 * for a payment, the secure page `/checkouts/[runId]` for private details),
 * where Crossmint's own components take them.
 *
 * Forms are the fallback, not the main surface: our own checkout card is one
 * UI everywhere it can be drawn (and it handles private fields), so a host
 * that shows MCP Apps cards (ChatGPT, Claude, a local MCP Apps host, or any
 * client declaring the MCP Apps extension) never gets a form or a link, even
 * where it declares elicitation. Only card-less clients that declare it do:
 * Claude Code, Codex, Cursor.
 */

/** What the client behind one request declared it can do. */
export interface FormSupport {
  /** Standard MCP form elicitation. */
  readonly forms: boolean;
  /** URL elicitation: the host opens a page of ours in the browser. */
  readonly url: boolean;
  /** OpenAI's form extensions (`openai/elicitation`): suggestions, thumbnails. */
  readonly openai: boolean;
}

export const noForms: FormSupport = { forms: false, url: false, openai: false };

/** Keys in `inputRequests` / `inputResponses`. */
export const QUESTION_FORM = "question";
export const SECURE_LINK = "secure";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads what the client declared on this request. Only 2026-07-28 requests
 * carry capabilities per request. 2025 traffic is served statelessly: the
 * per-request server never saw `initialize`, and the user's answer to a
 * server-to-client request would arrive as another HTTP request, possibly on
 * another instance. So 2025 clients never get a form: they get the card where
 * they draw it, else the secure page link (see clients.ts).
 */
export function formSupport(
  envelope: unknown,
  { cardHost = false }: { cardHost?: boolean } = {},
): FormSupport {
  const capabilities = isRecord(envelope)
    ? envelope[CLIENT_CAPABILITIES_META_KEY]
    : undefined;
  // A client that draws MCP Apps cards gets our card, not a form.
  if (!isRecord(capabilities) || cardHost || declaresCards(capabilities)) {
    return noForms;
  }
  const modes = isRecord(capabilities.elicitation)
    ? capabilities.elicitation
    : null;
  // An empty `elicitation: {}` means form mode only (spec, for compatibility).
  const forms = modes !== null && ("form" in modes || !("url" in modes));
  const url = modes !== null && "url" in modes;
  // OpenAI's forms over MRTR need both its extension and standard form mode
  // (OpenAI MCP Extensions 0.2.0).
  const extensions = capabilities.extensions;
  const openai =
    forms &&
    isRecord(extensions) &&
    isRecord(extensions["openai/elicitation"]) &&
    isRecord(extensions["openai/elicitation"].form);
  return { forms, url, openai };
}

// ---------------------------------------------------------------------------
// Signed request state

/**
 * What a form was asked for. Signed (HMAC) and bound to the user, so a retry
 * is only read as answers to the form we asked this user, for this checkout
 * and this question. Readable by the client: never put an address in it.
 */
export type FormState = {
  readonly form: typeof QUESTION_FORM | typeof SECURE_LINK;
  readonly runId: string;
  readonly requestId: string;
  /** Asked again after this incomplete answer (a short digest of it). */
  readonly sent?: string;
};

/** How long a form may stay open before its answers are refused. */
export const FORM_TTL_SECONDS = 30 * 60;

/**
 * The HMAC codec for `requestState`, bound to the authenticated user and
 * the method. `key` must be the same on every instance (at least 32 bytes).
 */
export function formStateCodec(
  key: Uint8Array | string,
): RequestStateCodec<FormState> {
  return createRequestStateCodec<FormState>({
    key,
    ttlSeconds: FORM_TTL_SECONDS,
    bind: (ctx) =>
      `${String(ctx.http?.authInfo?.extra?.userId ?? "")}\0${ctx.mcpReq.method}`,
  });
}

/** Whether a verified state is the one for this form. */
export function sameForm(
  state: FormState | undefined,
  expected: FormState,
): boolean {
  if (!state || state.form !== expected.form) {
    return false;
  }
  return (
    state.runId === expected.runId && state.requestId === expected.requestId
  );
}

// ---------------------------------------------------------------------------
// Forms

type Property = Record<string, unknown>;

export interface Form {
  readonly message: string;
  readonly requestedSchema: {
    readonly type: "object";
    readonly properties: Record<string, Property>;
    readonly required?: readonly string[];
  };
}

/** The embedded form request (`elicitation/create`, form mode). */
export function formRequest(
  form: Form,
  { openai = false }: Pick<Partial<FormSupport>, "openai"> = {},
): InputRequest {
  // Our schema keeps to the spec's flat primitives, plus OpenAI's keys
  // (`x-openai-suggestions`, `x-openai-thumbnail`) for hosts that declared
  // them. OpenAI hosts read it from `_meta["openai/elicitation"]` beside an
  // empty core schema; without that they report the form unsupported.
  return {
    method: "elicitation/create",
    params: {
      mode: "form",
      message: form.message,
      requestedSchema: openai
        ? { type: "object", properties: {} }
        : form.requestedSchema,
      ...(openai
        ? {
            _meta: {
              "openai/elicitation": { requestedSchema: form.requestedSchema },
            },
          }
        : {}),
    },
  } as InputRequest;
}

/** The embedded link request (`elicitation/create`, URL mode). */
export function linkRequest(message: string, url: string): InputRequest {
  return {
    method: "elicitation/create",
    params: { mode: "url", message, url },
  } as InputRequest;
}

/**
 * The same form again with what the user entered as defaults and the
 * problem first, so they fix one thing instead of starting over.
 */
export function askAgain(
  form: Form,
  problem: string,
  entered: Record<string, unknown>,
): Form {
  const properties: Record<string, Property> = {};
  for (const [key, property] of Object.entries(
    form.requestedSchema.properties,
  )) {
    const value = entered[key];
    const usable =
      typeof value === "string"
        ? value.trim() !== ""
        : typeof value === "number" ||
          typeof value === "boolean" ||
          (Array.isArray(value) && value.length > 0);
    properties[key] = usable ? { ...property, default: value } : property;
  }
  return {
    message: `${problem}\n\n${form.message}`,
    requestedSchema: { ...form.requestedSchema, properties },
  };
}

// ---------------------------------------------------------------------------
// Store questions

type Question = Extract<CheckoutPending, { kind: "question" }>;

/** Whether a question may be asked in a host's own form. */
export function formable(pending: Question) {
  return (
    pending.fields.length > 0 &&
    !asksForSecret(pending.question) &&
    !pending.fields.some(
      (field) => field.sensitive === true || asksForSecret(field.label),
    )
  );
}

const SOMETHING_ELSE = "Something else";
const SOMETHING_ELSE_HINT = "Tell the store what you want instead";
/** The longest answer `answer` takes (answers, and the user's own words). */
const MAX_TEXT = 4000;
const MAX_INSTEAD = 1000;

export interface QuestionForm extends Form {
  /** The "Something else" property, unique among the store's keys; null when choices take it. */
  readonly other: string | null;
  /** Choice fields take typed answers too (OpenAI suggestions): those mean Something else. */
  readonly suggestions: boolean;
}

function option(
  item: NonNullable<QuestionField["options"]>[number],
  openai: boolean,
) {
  const image = item.image;
  return {
    const: item.value,
    title: item.label,
    ...(openai && image && /^https:\/\//.test(image)
      ? { "x-openai-thumbnail": { src: image } }
      : {}),
  };
}

const yesNo = [
  { const: "yes", title: "Yes" },
  { const: "no", title: "No" },
];

function fieldSchema(field: QuestionField, openai: boolean): Property {
  const title = field.label;
  const options = (field.options ?? []).map((item) => option(item, openai));
  switch (field.kind) {
    case "choice":
      if (options.length === 0) {
        return { type: "string", title, maxLength: MAX_TEXT };
      }
      // OpenAI's suggestions are the dock's options plus its "Something
      // else…": the user picks one or types what they want instead.
      if (openai) {
        return field.multiple
          ? {
              type: "array",
              title,
              items: {
                type: "string",
                maxLength: MAX_INSTEAD,
                "x-openai-suggestions": options,
              },
            }
          : {
              type: "string",
              title,
              maxLength: MAX_INSTEAD,
              "x-openai-suggestions": options,
            };
      }
      return field.multiple
        ? { type: "array", title, items: { anyOf: options } }
        : { type: "string", title, oneOf: options };
    // The dock asks yes/no as two choices, so "not answered yet" stays
    // possible (a checkbox can't say that).
    case "boolean":
      return { type: "string", title, oneOf: yesNo };
    case "number":
    case "integer":
      return { type: field.kind, title };
    default:
      return {
        type: "string",
        title,
        maxLength: MAX_TEXT,
        ...(field.placeholder ? { description: field.placeholder } : {}),
      };
  }
}

/**
 * The store's question as a form: its wording, each field by its label, and
 * "Something else" last (or, on OpenAI hosts, typed into a choice). No field
 * is marked required, as in the dock: Something else replaces the answers,
 * and the server checks the store's required fields when they come back.
 */
export function questionForm(
  pending: Question,
  support: Pick<FormSupport, "openai">,
): QuestionForm | null {
  if (!formable(pending)) {
    return null;
  }
  const properties: Record<string, Property> = {};
  for (const field of pending.fields) {
    properties[field.key] = fieldSchema(field, support.openai);
  }
  const suggestions =
    support.openai &&
    pending.fields.some(
      (field) => field.kind === "choice" && (field.options ?? []).length > 0,
    );
  let other: string | null = null;
  if (!suggestions) {
    other = "somethingElse";
    while (other in properties) {
      other = `${other}_`;
    }
    properties[other] = {
      type: "string",
      title: SOMETHING_ELSE,
      description: SOMETHING_ELSE_HINT,
      maxLength: MAX_INSTEAD,
    };
  }
  return {
    message: pending.question.trim() || "The store has a question.",
    requestedSchema: { type: "object", properties },
    other,
    suggestions,
  };
}

export type Answer = string | number | boolean | string[];

export type QuestionReply =
  | { readonly kind: "instead"; readonly text: string }
  | {
      readonly kind: "answers";
      readonly answers: Record<string, Answer>;
      /** What the user said, by label, like the dock's note. */
      readonly said: readonly { label: string; value: string }[];
    }
  | { readonly kind: "incomplete"; readonly problem: string };

function empty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

type Read =
  | { kind: "ok"; answer: Answer; said: string }
  /** A typed value where the store has options: "Something else". */
  | { kind: "other"; said: string }
  | { kind: "invalid" };

function readField(
  field: QuestionField,
  value: unknown,
  suggestions: boolean,
): Read {
  const options = field.options ?? [];
  const known = (picked: unknown): picked is string =>
    typeof picked === "string" && options.some((item) => item.value === picked);
  const labelOf = (picked: string) =>
    options.find((item) => item.value === picked)?.label ?? picked.trim();
  switch (field.kind) {
    case "boolean": {
      const yes = value === true || value === "yes";
      const no = value === false || value === "no";
      return yes || no
        ? { kind: "ok", answer: yes, said: yes ? "Yes" : "No" }
        : { kind: "invalid" };
    }
    case "number":
    case "integer": {
      const number =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number(value.trim())
            : Number.NaN;
      if (
        !Number.isFinite(number) ||
        (field.kind === "integer" && !Number.isInteger(number))
      ) {
        return { kind: "invalid" };
      }
      return { kind: "ok", answer: number, said: String(number) };
    }
    case "choice": {
      if (options.length === 0) {
        break;
      }
      const picked = field.multiple
        ? Array.isArray(value)
          ? value
          : [value]
        : [value];
      if (
        !picked.every(
          (item) => typeof item === "string" && item.trim().length > 0,
        ) ||
        (!field.multiple && Array.isArray(value))
      ) {
        return { kind: "invalid" };
      }
      const values = picked as string[];
      const said = values.map(labelOf).join(", ");
      if (values.every(known)) {
        return {
          kind: "ok",
          answer: field.multiple ? values : (values[0] as string),
          said,
        };
      }
      return suggestions && said.length <= MAX_INSTEAD
        ? { kind: "other", said }
        : { kind: "invalid" };
    }
    default:
      break;
  }
  if (typeof value !== "string" || value.trim().length > MAX_TEXT) {
    return { kind: "invalid" };
  }
  return { kind: "ok", answer: value.trim(), said: value.trim() };
}

function list(labels: readonly string[]) {
  return labels.length <= 1
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * Turns the form the user sent back into answers for the store, "Something
 * else" (which wins, as in the dock), or one line saying what's missing.
 * The content comes from the host: every value is checked against the
 * store's own fields and options.
 */
export function readQuestion(
  form: QuestionForm,
  pending: Question,
  content: Record<string, unknown> | undefined,
): QuestionReply {
  const values = content ?? {};
  const other = form.other === null ? undefined : values[form.other];
  if (typeof other === "string" && other.trim() !== "") {
    const text = other.trim();
    return text.length > MAX_INSTEAD
      ? {
          kind: "incomplete",
          problem: `Keep ${SOMETHING_ELSE} under ${MAX_INSTEAD} characters.`,
        }
      : { kind: "instead", text };
  }
  const answers: Record<string, Answer> = {};
  const said: { label: string; value: string }[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];
  let typed = false;
  for (const field of pending.fields) {
    const value = values[field.key];
    if (empty(value)) {
      if (field.required) {
        missing.push(field.label);
      }
      continue;
    }
    const read = readField(field, value, form.suggestions);
    if (read.kind === "invalid") {
      invalid.push(field.label);
      continue;
    }
    if (read.kind === "other") {
      typed = true;
    } else {
      answers[field.key] = read.answer;
    }
    said.push({ label: field.label, value: read.said });
  }
  if (invalid.length > 0) {
    return { kind: "incomplete", problem: `Check ${list(invalid)}.` };
  }
  // A choice typed instead of picked is the dock's Something else: the
  // store gets everything the user said, in their words.
  if (typed) {
    const text = said
      .map((item) =>
        pending.fields.length > 1 ? `${item.label}: ${item.value}` : item.value,
      )
      .join("; ");
    return text.length > MAX_INSTEAD
      ? { kind: "incomplete", problem: "Keep your answer shorter." }
      : { kind: "instead", text };
  }
  if (missing.length > 0 || said.length === 0) {
    const what = missing.length > 0 ? list(missing) : "the question";
    return {
      kind: "incomplete",
      problem: form.suggestions
        ? `Answer ${what}, or type what you want instead.`
        : `Answer ${what}, or tell the store what you want instead under ${SOMETHING_ELSE}.`,
    };
  }
  return { kind: "answers", answers, said };
}

/**
 * The checkout card's data rules, free of the DOM so they can be unit tested.
 * Everything arriving from the host is untrusted: it is parsed field by field
 * into these types and anything unexpected is dropped. Unknown fields are
 * never read. The live-view URL never travels in a checkout view.
 */

import { money as showMoney } from "../src/ui/format.js";
import {
  EN,
  localeTag,
  pickLocale,
  type Ui,
  type UiLocale,
} from "../src/ui/i18n/index.js";
import { blockedReason, failureText } from "../src/ui/status.js";

export interface Money {
  readonly amount: string;
  readonly currency: string;
}

export interface Option {
  readonly value: string;
  readonly label: string;
}

export interface Field {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly kind: "text" | "number" | "integer" | "boolean" | "choice";
  readonly multiple: boolean;
  readonly options: readonly Option[];
  readonly placeholder: string | null;
}

export type Pending =
  | {
      readonly kind: "payment";
      readonly requestId: string;
      readonly question: string;
      readonly amount: Money & { readonly exact: boolean };
      readonly merchant: string;
      /** The rest of Crossmint's merchant, passed to its payment authorization as is. */
      readonly merchantUrl: string | null;
      readonly merchantCountry: string | null;
      readonly expiresAt: string | null;
      readonly actionUrl: string;
    }
  | {
      readonly kind: "question";
      readonly requestId: string;
      readonly question: string;
      readonly fields: readonly Field[];
    }
  | {
      readonly kind: "protected";
      readonly requestId: string;
      readonly question: string;
      /** The form in order: private fields for Crossmint's inputs, the rest as ordinary fields. */
      readonly fields: readonly SecureField[];
      /** What the private fields are, for the card's title. */
      readonly ask: SecretAsk;
      readonly actionUrl: string;
    };

/**
 * What a store's private fields ask for, from how Crossmint describes their
 * inputs (never from label words): a sign-in's password, a new password, a
 * code the store sent, or other private details.
 */
export type SecretAsk = "signIn" | "newPassword" | "code" | "details";

/** Crossmint's protected-input descriptor, rebuilt from known keys only. */
export interface ProtectedDescriptor {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly handling: "protected";
  readonly input:
    | {
        readonly kind: "text";
        readonly placeholder?: string;
        readonly display?: string;
        readonly autoComplete?: string;
        readonly inputMode?: string;
      }
    | { readonly kind: "number" | "integer" };
}

export type SecureField =
  | { readonly handling: "protected"; readonly descriptor: ProtectedDescriptor }
  | { readonly handling: "standard"; readonly field: Field };

export type Status =
  | "queued"
  | "running"
  | "awaiting_input"
  | "succeeded"
  | "blocked"
  | "failed"
  | "cancelled";

export interface Checkout {
  readonly runId: string;
  readonly status: Status;
  readonly store: string;
  readonly task: string | null;
  readonly maxCost: Money;
  /** The saved address it ships to, by label and city ("Home", "Miami, FL"). */
  readonly shipsTo: { readonly label: string; readonly place: string } | null;
  readonly pending: Pending | null;
  readonly result: {
    readonly summary: string | null;
    readonly receipt: {
      readonly total: Money;
      readonly merchantOrderId: string | null;
    } | null;
    readonly confirmedWithoutReceipt: boolean;
    readonly blockedCode: string | null;
    readonly failureReason: string | null;
  } | null;
}

/** One tool result, as the card uses it. */
export interface Snapshot {
  readonly checkout: Checkout;
  /** The server's one-line guidance for the model, relayed on card updates. */
  readonly next: string;
  /** When our server read this state (ms); orders cards for the same run. */
  readonly observedAt: number;
  /** The server offers the secure step inside the card (app-only tools). */
  readonly secureStep: boolean;
  /**
   * What this card was drawn for: `start` (the checkout's status) or `step`
   * (a step the user takes); null for any other result.
   */
  readonly role: CardRole | null;
  /** What the checkout is doing, from `_meta` (never model content). */
  readonly progress: Progress | null;
  /** The language for the card's text (`_meta`), if the result carried one. */
  readonly locale: string | null;
  /** `locale` is the one the assistant writes in (it wins over the host's). */
  readonly localeFromAssistant: boolean;
}

export interface ProgressStep {
  readonly text: string;
  readonly running: boolean;
  readonly at: number;
}

export interface Progress {
  /** Crossmint's newest buyer-safe step. */
  readonly now: ProgressStep | null;
}

export const OBSERVED_AT = "oca/observedAt";
export const SECURE_STEP = "oca/secureStep";
export const PROGRESS = "oca/progress";
export const CARD_CREDENTIALS = "oca/credentials";
/** card_checkout's `_meta` flag, when asked about a payment: a spending limit paid it. */
export const CARD_PAID = "oca/paid";
/** Tool-result `_meta` key: which tool drew the card (`start` or `step`). */
export const CARD_STEP = "oca/step";
/** Tool-result `_meta` key: the language for the card's text (src/mcp/card.ts). */
export const LOCALE = "oca/locale";
/** Tool-result `_meta` key: where `oca/locale` came from, `assistant` or `host`. */
export const LOCALE_SOURCE = "oca/localeSource";

/** What a checkout card was drawn for: the start, or one step. */
export type CardRole = "start" | "step";

const statuses: readonly Status[] = [
  "queued",
  "running",
  "awaiting_input",
  "succeeded",
  "blocked",
  "failed",
  "cancelled",
];
const fieldKinds: readonly Field["kind"][] = [
  "text",
  "number",
  "integer",
  "boolean",
  "choice",
];

type Data = Record<string, unknown>;

function record(value: unknown): Data | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : null;
}

function text(value: unknown, max = 2000): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

function money(value: unknown): Money | null {
  const data = record(value);
  const amount = text(data?.amount, 40);
  const currency = text(data?.currency, 10);
  return amount !== null &&
    /^\d+(\.\d+)?$/.test(amount) &&
    currency !== null &&
    /^[A-Z]{3}$/.test(currency)
    ? { amount, currency }
    : null;
}

function field(value: unknown): Field | null {
  const data = record(value);
  const key = text(data?.key, 200);
  const label = text(data?.label, 500);
  const kind = fieldKinds.find((item) => item === data?.kind);
  if (key === null || label === null || !kind) {
    return null;
  }
  const options = Array.isArray(data?.options)
    ? data.options.slice(0, 50).flatMap((item) => {
        const option = record(item);
        const optionValue = text(option?.value, 500);
        const optionLabel = text(option?.label, 500);
        return optionValue !== null && optionLabel !== null
          ? [{ value: optionValue, label: optionLabel }]
          : [];
      })
    : [];
  return {
    key,
    label,
    required: data?.required === true,
    kind,
    multiple: data?.multiple === true,
    options,
    placeholder: text(data?.placeholder, 200),
  };
}

/**
 * Only links to our own pages leave the card: same origin as the server that
 * served it, path /checkouts/<runId>, or for a payment the spending limit
 * request page /spending-limit/<token> (no query).
 */
export function safeActionUrl(
  value: unknown,
  origin: string,
  runId: string,
  payment = false,
): string | null {
  const raw = text(value, 2000);
  if (raw === null) {
    return null;
  }
  try {
    const url = new URL(raw);
    const page =
      url.pathname === `/checkouts/${encodeURIComponent(runId)}` ||
      (payment &&
        /^\/spending-limit\/[\w-]+$/.test(url.pathname) &&
        !url.search);
    return url.origin === origin && page && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function pending(
  value: unknown,
  origin: string,
  runId: string,
): Pending | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  const data = record(value);
  const requestId = text(data?.requestId, 200);
  const question = text(data?.question) ?? "";
  if (!data || requestId === null) {
    return undefined;
  }
  if (data.kind === "question") {
    const fields = Array.isArray(data.fields)
      ? data.fields.slice(0, 20).map(field)
      : [];
    return fields.every((item) => item !== null)
      ? { kind: "question", requestId, question, fields }
      : undefined;
  }
  const actionUrl = safeActionUrl(
    data.actionUrl,
    origin,
    runId,
    data.kind === "payment",
  );
  if (actionUrl === null) {
    return undefined;
  }
  if (data.kind === "protected") {
    return {
      kind: "protected",
      requestId,
      question,
      fields: secureFields(data.fields, data.standard),
      ask: secretAsk(data.fields),
      actionUrl,
    };
  }
  if (data.kind === "payment") {
    const amount = money(data.amount);
    const merchantData = record(data.merchant);
    const merchant = text(merchantData?.name, 200);
    const merchantUrl = text(merchantData?.url, 2000);
    const merchantCountry = text(merchantData?.countryCode, 2);
    return amount && merchant !== null
      ? {
          kind: "payment",
          requestId,
          question,
          amount: { ...amount, exact: record(data.amount)?.exact !== false },
          merchant,
          merchantUrl:
            merchantUrl && /^https?:\/\//.test(merchantUrl)
              ? merchantUrl
              : null,
          merchantCountry:
            merchantCountry && /^[A-Z]{2}$/.test(merchantCountry)
              ? merchantCountry
              : null,
          expiresAt: text(data.expiresAt, 40),
          actionUrl,
        }
      : undefined;
  }
  return undefined;
}

/**
 * What the private fields ask for, from Crossmint's input hints: any
 * `current-password` is a sign-in, `new-password` a new password, and a
 * `one-time-code`, or a single private field typed as a number, a code.
 */
export function secretAsk(raw: unknown): SecretAsk {
  const inputs = (Array.isArray(raw) ? raw.slice(0, 20) : []).flatMap(
    (item) => {
      const data = record(item);
      return data?.handling === "protected" ? [record(data.input) ?? {}] : [];
    },
  );
  const autoComplete = (input: Data) =>
    typeof input.autoComplete === "string"
      ? input.autoComplete.trim().toLowerCase().split(/\s+/)
      : [];
  const has = (token: string) =>
    inputs.some((input) => autoComplete(input).includes(token));
  if (has("current-password")) {
    return "signIn";
  }
  if (has("new-password")) {
    return "newPassword";
  }
  const only = inputs.length === 1 ? inputs[0] : undefined;
  const numeric =
    only?.inputMode === "numeric" ||
    only?.kind === "number" ||
    only?.kind === "integer";
  if (has("one-time-code") || numeric) {
    return "code";
  }
  return "details";
}

/**
 * The card's title over a store's private fields, and the line under it: the
 * store's own question when the details are other kinds.
 */
export function secretTitle(
  ask: SecretAsk,
  store: string,
  question: string,
  ui: Ui = EN,
): { title: string; line: string | null } {
  const { m, f } = ui;
  switch (ask) {
    case "signIn":
      return {
        title: f(m.secure.signInTitle, { store }),
        line: f(m.secure.signInLine, { store }),
      };
    case "newPassword":
      return { title: f(m.secure.newPasswordTitle, { store }), line: null };
    case "code":
      return {
        title: f(m.secure.codeTitle, { store }),
        line: m.secure.codeLine,
      };
    default:
      return {
        title: f(m.secure.detailsTitle, { store }),
        line: question.trim() || null,
      };
  }
}

const descriptorTextKeys = [
  "placeholder",
  "display",
  "autoComplete",
  "inputMode",
] as const;

function descriptor(data: Data): ProtectedDescriptor | null {
  const key = text(data.key, 200);
  const label = text(data.label, 500);
  const input = record(data.input);
  if (key === null || label === null || !input) {
    return null;
  }
  const base = {
    key,
    label,
    required: data.required === true,
    handling: "protected" as const,
  };
  if (input.kind === "number" || input.kind === "integer") {
    return { ...base, input: { kind: input.kind } };
  }
  // Crossmint's protected input takes single-line text only.
  if (input.kind !== "text" || input.multiline === true) {
    return null;
  }
  const extra: Record<string, string> = {};
  for (const name of descriptorTextKeys) {
    const value = text(input[name], 200);
    if (value !== null) {
      extra[name] = value;
    }
  }
  return { ...base, input: { kind: "text", ...extra } };
}

/**
 * A protected request's form for the in-card secure step: Crossmint
 * descriptors for private fields, ordinary fields as the question form shows
 * them. Empty when any field can't be shown here, which keeps the step on the
 * secure page.
 */
function secureFields(raw: unknown, standard: unknown): readonly SecureField[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) {
    return [];
  }
  const ordinary = new Map(
    (Array.isArray(standard) ? standard.slice(0, 20) : [])
      .map(field)
      .filter((item): item is Field => item !== null)
      .map((item) => [item.key, item]),
  );
  const out: SecureField[] = [];
  for (const item of raw) {
    const data = record(item);
    if (!data) {
      return [];
    }
    if (data.handling === "protected") {
      const parsed = descriptor(data);
      if (!parsed) {
        return [];
      }
      out.push({ handling: "protected", descriptor: parsed });
    } else {
      const parsed = ordinary.get(text(data.key, 200) ?? "");
      if (!parsed) {
        return [];
      }
      out.push({ handling: "standard", field: parsed });
    }
  }
  return out;
}

function outcome(value: unknown): Checkout["result"] {
  const data = record(value);
  if (!data) {
    return null;
  }
  const receipt = record(data.receipt);
  const total = money(receipt?.total);
  return {
    summary: text(data.summary),
    receipt: total
      ? { total, merchantOrderId: text(receipt?.merchantOrderId, 200) }
      : null,
    confirmedWithoutReceipt: data.confirmedWithoutReceipt === true,
    blockedCode: text(data.blockedCode, 200),
    failureReason: text(data.failureReason, 200),
  };
}

function shipsTo(value: unknown): Checkout["shipsTo"] {
  const data = record(value);
  const label = text(data?.label, 120);
  const place = text(data?.place, 300);
  return label && place ? { label, place } : null;
}

/** A checkout view from our server, or null when it doesn't have the expected shape. */
export function parseCheckout(value: unknown, origin: string): Checkout | null {
  const data = record(value);
  const runId = text(data?.runId, 200);
  const status = statuses.find((item) => item === data?.status);
  const store = text(data?.store, 300);
  const maxCost = money(data?.maxCost);
  if (!data || !runId || !status || store === null || !maxCost) {
    return null;
  }
  const open = pending(data.pending, origin, runId);
  if (open === undefined) {
    return null;
  }
  return {
    runId,
    status,
    store,
    task: text(data.task, 4000),
    maxCost,
    shipsTo: shipsTo(data.shipsTo),
    pending: open,
    result: outcome(data.result),
  };
}

/** A CallToolResult from start, answer, continue or card_checkout. */
export function parseResult(value: unknown, origin: string): Snapshot | null {
  const result = record(value);
  if (!result || result.isError === true) {
    return null;
  }
  const meta = record(result._meta);
  return snapshotOf(
    record(result.structuredContent),
    meta,
    origin,
    meta?.[PROGRESS],
  );
}

/** One `{ checkout, next }` view with the result's `_meta`, or null. */
function snapshotOf(
  structured: Data | null,
  meta: Data | null,
  origin: string,
  progress: unknown,
): Snapshot | null {
  const checkout = parseCheckout(structured?.checkout, origin);
  if (!checkout) {
    return null;
  }
  const observedAt = meta?.[OBSERVED_AT];
  return {
    checkout,
    next: text(structured?.next) ?? "",
    observedAt:
      typeof observedAt === "number" && Number.isFinite(observedAt)
        ? observedAt
        : 0,
    secureStep: meta?.[SECURE_STEP] === true,
    role:
      meta?.[CARD_STEP] === "start"
        ? "start"
        : meta?.[CARD_STEP] === "step"
          ? "step"
          : null,
    progress: parseProgress(progress),
    locale: localeTag(meta?.[LOCALE]),
    localeFromAssistant:
      localeTag(meta?.[LOCALE]) !== null &&
      meta?.[LOCALE_SOURCE] === "assistant",
  };
}

function parseStep(value: unknown): ProgressStep | null {
  const step = record(value);
  const said = text(step?.text, 240)?.trim();
  const at = Date.parse(text(step?.at, 40) ?? "");
  return said && !Number.isNaN(at)
    ? { text: said, running: step?.status === "running", at }
    : null;
}

/** The progress in a result's `_meta`: its newest step, or null. */
export function parseProgress(value: unknown): Progress | null {
  const data = record(value);
  if (!data) {
    return null;
  }
  return { now: parseStep(data.now) };
}

/** A step this old reads as "Still working…". */
const STALE_MS = 90_000;

/**
 * The line saying what a checkout is doing, or null without one. An old step
 * reads "Still working…", unless the checkout is waiting on the user.
 */
export function progressLine(
  progress: Progress | null,
  now: number,
  waiting = false,
  ui: Ui = EN,
) {
  const step = progress?.now;
  if (!step) {
    return null;
  }
  return !waiting && now - step.at > STALE_MS
    ? { text: ui.m.progress.stillWorking, running: true }
    : { text: step.text, running: step.running };
}

/** Credentials from card_secure_session's `_meta`, or null. */
export function parseCredentials(value: unknown): {
  apiKey: string;
  jwt: string;
  expiresAt: number;
} | null {
  const result = record(value);
  if (!result || result.isError === true) {
    return null;
  }
  const data = record(record(result._meta)?.[CARD_CREDENTIALS]);
  const apiKey = text(data?.apiKey, 500);
  const jwt = text(data?.jwt, 8000);
  const expiresAt = data?.expiresAt;
  return apiKey &&
    /^ck_[A-Za-z0-9_]+$/.test(apiKey) &&
    jwt &&
    /^[\w-]+\.[\w-]+\.[\w-]+$/.test(jwt) &&
    typeof expiresAt === "number" &&
    expiresAt > Date.now()
    ? { apiKey, jwt, expiresAt }
    : null;
}

// ---------------------------------------------------------------------------
// The in-card secure step: Crossmint's components when the host allows them,
// the secure page link whenever anything gets in the way.

export type SecureState =
  /** Not attempted: the step lives on the secure page. */
  | { readonly phase: "link" }
  | { readonly phase: "loading"; readonly requestId: string }
  | { readonly phase: "ready"; readonly requestId: string }
  | { readonly phase: "sending"; readonly requestId: string }
  | { readonly phase: "sent"; readonly requestId: string }
  | { readonly phase: "fallback"; readonly requestId: string };

export type SecureEvent =
  /** Credentials or the component script couldn't be had. */
  | { readonly type: "unavailable" }
  /** The host's CSP refused something the step needs. */
  | { readonly type: "blocked" }
  /** Crossmint's frame didn't answer in time. */
  | { readonly type: "timeout" }
  /** Crossmint's frame posted to us: it loaded and talks. */
  | { readonly type: "alive" }
  /** A component reported an error (origin not allowed, verification, expiry). */
  | { readonly type: "error" }
  | { readonly type: "submit" }
  /** The user has something to fix (a required or invalid field): back to the form. */
  | { readonly type: "invalid" }
  | { readonly type: "submitted" }
  | { readonly type: "submit-failed" }
  | { readonly type: "retry" };

/** Whether this pending step can try Crossmint's components in the card. */
export function canRunSecureStep(
  pending: Pending | null,
  options: { secureStep: boolean; canCallTools: boolean; frozen: boolean },
) {
  if (!options.secureStep || !options.canCallTools || options.frozen) {
    return false;
  }
  return pending?.kind === "protected" && pending.fields.length > 0;
}

/** The step for a newly shown request: try in the card, or link out. */
export function startSecureStep(
  pending: Pending | null,
  options: { secureStep: boolean; canCallTools: boolean; frozen: boolean },
): SecureState {
  return pending && canRunSecureStep(pending, options)
    ? { phase: "loading", requestId: pending.requestId }
    : { phase: "link" };
}

/**
 * The secure step's rules. Anything that gets in the way before the user
 * sends falls back to the secure page link; nothing ever falls back to chat.
 * A failed send returns to the form (a protected value can be collected
 * again) unless the components already failed.
 */
export function secureStep(
  state: SecureState,
  event: SecureEvent,
): SecureState {
  if (state.phase === "link" || state.phase === "sent") {
    return state;
  }
  const { requestId } = state;
  switch (event.type) {
    case "alive":
      return state.phase === "loading" ? { phase: "ready", requestId } : state;
    case "timeout":
      return state.phase === "loading"
        ? { phase: "fallback", requestId }
        : state;
    case "unavailable":
    case "blocked":
    case "error":
      if (state.phase === "fallback" || state.phase === "sending") {
        return state;
      }
      return { phase: "fallback", requestId };
    case "submit":
      return state.phase === "ready" ? { phase: "sending", requestId } : state;
    case "invalid":
      return state.phase === "sending" ? { phase: "ready", requestId } : state;
    case "submitted":
      return state.phase === "sending" ? { phase: "sent", requestId } : state;
    case "submit-failed":
      return state.phase === "sending"
        ? { phase: "fallback", requestId }
        : state;
    case "retry":
      return state.phase === "fallback"
        ? { phase: "loading", requestId }
        : state;
  }
}

/** Model context after the user finished the secure step in the card. No values, ever. */
export function secureDoneContext(
  checkout: Checkout,
  pending: Extract<Pending, { kind: "protected" }>,
) {
  return `In the Menta checkout card, the user entered the private details the store asked for in Crossmint's secure form (runId ${checkout.runId}). You never see those values. ${keepWaiting(checkout, pending.requestId)}`;
}

/** The message of a tool error, kept short; our server writes these for people. */
export function toolError(value: unknown, ui: Ui = EN): string | null {
  const result = record(value);
  if (result?.isError !== true) {
    return null;
  }
  const first = Array.isArray(result.content)
    ? record(result.content[0])
    : null;
  return text(first?.text, 300) ?? ui.m.card.somethingWrong;
}

/** Money as people read it, in `ui`'s language (English, as the model reads it, by default). */
export function formatMoney(amount: Money, ui: Ui = EN) {
  return showMoney(amount, ui);
}

export function isActive(checkout: Checkout) {
  return (
    checkout.status === "queued" ||
    checkout.status === "running" ||
    checkout.status === "awaiting_input"
  );
}

/** Whether a payment fits the run's limit, when both are in one currency. */
export function withinLimit(amount: Money, limit: Money) {
  return (
    amount.currency === limit.currency &&
    Number(amount.amount) <= Number(limit.amount)
  );
}

export type Tone =
  | "idle"
  | "working"
  | "attention"
  | "success"
  | "danger"
  | "muted";

/** Crossmint can't tell whether the order went through: buying again could charge twice. */
export function unconfirmed(checkout: Checkout) {
  return (
    checkout.result?.failureReason === "reconciliation_required" ||
    checkout.result?.blockedCode === "reconciliation_required"
  );
}

/** Status dot and label, matching the web chat's checkout card. */
export function describe(
  checkout: Checkout,
  ui: Ui = EN,
): { tone: Tone; label: string } {
  const s = ui.m.status;
  if (unconfirmed(checkout)) {
    return { tone: "idle", label: s.notConfirmed };
  }
  switch (checkout.status) {
    case "queued":
      return { tone: "idle", label: s.starting };
    case "running":
      return { tone: "working", label: s.working };
    case "awaiting_input":
      if (checkout.pending?.kind === "question") {
        return { tone: "attention", label: s.storeQuestion };
      }
      return checkout.pending
        ? { tone: "attention", label: s.needsYou }
        : { tone: "working", label: s.working };
    case "succeeded":
      return { tone: "success", label: s.orderPlaced };
    case "blocked":
      return {
        tone: "danger",
        label: ui.f(s.couldntBuyBecause, {
          reason: blockedReason(checkout.result?.blockedCode, ui),
        }),
      };
    case "failed":
      return { tone: "danger", label: s.stopped };
    case "cancelled":
      return { tone: "muted", label: s.canceled };
  }
}

/** The one line under the title explaining a settled outcome, or null. */
export function outcomeLine(checkout: Checkout, ui: Ui = EN): string | null {
  if (unconfirmed(checkout)) {
    return ui.m.failures.reconciliation_required;
  }
  const result = checkout.result;
  const quoted = (summary: string) =>
    ui.f(ui.m.common.quoted, { text: summary });
  switch (checkout.status) {
    case "succeeded":
      return result?.receipt ? ui.m.outcome.receipt : ui.m.outcome.noReceipt;
    case "blocked":
      return result?.summary ? quoted(result.summary) : null;
    case "cancelled":
      // "The checkout was cancelled." only repeats the label.
      return result?.summary &&
        !/^the checkout was cancel+ed\.?$/i.test(result.summary.trim())
        ? quoted(result.summary)
        : null;
    case "failed":
      return failureText(result?.failureReason, ui);
    default:
      return null;
  }
}

/** What changed for the model to know about: status, plus which request is open. */
export function stateKey(checkout: Checkout) {
  return `${checkout.status}:${checkout.pending?.requestId ?? ""}`;
}

/** Model context after the user answered in the card. */
export function answeredContext(
  checkout: Checkout,
  question: string,
  answer: string,
  requestId = "",
) {
  return `In the Menta checkout card, the user answered the store's question${question ? ` "${question}"` : ""} with "${answer}" (runId ${checkout.runId}). The answer was sent to the store. Don't ask the question again. ${keepWaiting(checkout, requestId)}`;
}

/** The model's next move once the user finished a step in a card: wait for the next one. */
function keepWaiting(checkout: Checkout, requestId: string) {
  return `Call continue with runId ${checkout.runId}${requestId ? ` and afterRequestId ${requestId}` : ""} to follow it to the next step or the end.`;
}

/** Model context when the live card sees the checkout change. */
export function refreshedContext(snapshot: Snapshot) {
  return `The Menta checkout card refreshed checkout ${snapshot.checkout.runId}; it is now "${describe(snapshot.checkout).label}". Latest state: ${JSON.stringify({ checkout: snapshot.checkout, next: snapshot.next })}`;
}

/** Converts what the user entered into the store's answers; null when incomplete. */
export function answers(
  fields: readonly Field[],
  values: Readonly<Record<string, string | string[] | boolean | null>>,
): Record<string, string | number | boolean | string[]> | null {
  const out: Record<string, string | number | boolean | string[]> = {};
  for (const item of fields) {
    const value = values[item.key];
    const empty =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      if (item.required) {
        return null;
      }
      continue;
    }
    if (item.kind === "boolean") {
      if (typeof value !== "boolean") {
        return null;
      }
      out[item.key] = value;
    } else if (item.kind === "number" || item.kind === "integer") {
      const number = Number(value);
      if (
        typeof value !== "string" ||
        !Number.isFinite(number) ||
        (item.kind === "integer" && !Number.isInteger(number))
      ) {
        return null;
      }
      out[item.key] = number;
    } else if (item.kind === "choice") {
      const allowed = new Set(item.options.map((option) => option.value));
      const picked = Array.isArray(value) ? value : [value];
      if (
        picked.some((entry) => typeof entry !== "string" || !allowed.has(entry))
      ) {
        return null;
      }
      out[item.key] = item.multiple
        ? (picked as string[])
        : (picked[0] as string);
    } else {
      if (typeof value !== "string") {
        return null;
      }
      out[item.key] = value.slice(0, 4000);
    }
  }
  return out;
}

/** A readable summary of answers, using option labels as shown. */
export function answerSummary(
  fields: readonly Field[],
  values: Record<string, string | number | boolean | string[]>,
  ui: Ui = EN,
) {
  return fields
    .filter((item) => item.key in values)
    .map((item) => {
      const value = values[item.key];
      const shown =
        item.kind === "choice"
          ? (Array.isArray(value) ? value : [value])
              .map(
                (entry) =>
                  item.options.find((option) => option.value === entry)
                    ?.label ?? String(entry),
              )
              .join(", ")
          : typeof value === "boolean"
            ? value
              ? ui.m.common.yes
              : ui.m.common.no
            : String(value);
      return fields.length > 1 ? `${item.label}: ${shown}` : shown;
    })
    .join("; ");
}

// ---------------------------------------------------------------------------
// Addresses are settled in chat: a start that stopped for one has no checkout
// to show, only a pointer to the chat.

/**
 * The card's language, best first: the one the assistant writes in (from a
 * show result), the host context's, ChatGPT's own, the one the host sent with
 * a tool call, the browser's; English without any. Unsupported languages read
 * English.
 */
export function cardLocale(sources: {
  readonly assistant: string | null;
  readonly hostContext: unknown;
  readonly openAi: unknown;
  readonly request: string | null;
  /** The frame's `navigator.language`. */
  readonly browser: unknown;
}): UiLocale {
  return pickLocale(
    sources.assistant ??
      localeTag(sources.hostContext) ??
      localeTag(sources.openAi) ??
      sources.request ??
      localeTag(sources.browser),
  );
}

/** A start that stopped to ask which saved address the user means. */
export function asksWhichAddress(value: unknown) {
  return (
    record(record(record(value)?.structuredContent)?.whichAddress) !== null
  );
}

/** A start that stopped for someone's address the model asks for in chat. */
export function asksForAddress(value: unknown) {
  return (
    record(record(record(value)?.structuredContent)?.addressNeeded) !== null
  );
}

// ---------------------------------------------------------------------------
// Display modes. The card asks the host for a mode only when the host lists
// it (MCP Apps: a view MUST check `availableDisplayModes`). ChatGPT has
// inline and fullscreen, never pip; Claude lists what it supports.

export type DisplayMode = "inline" | "fullscreen" | "pip";

const displayModes: readonly DisplayMode[] = ["inline", "fullscreen", "pip"];

/**
 * The modes the host offers. Hosts list them in their context; ChatGPT's own
 * API (`window.openai.requestDisplayMode`) without a list means inline and
 * fullscreen, which is all ChatGPT supports. ChatGPT never gets pip, even if
 * it lists it: "ChatGPT currently supports inline and fullscreen, but not pip".
 */
export function hostModes(
  listed: unknown,
  openAiRequest: boolean,
  chatgpt = false,
): DisplayMode[] {
  const modes: DisplayMode[] = Array.isArray(listed)
    ? displayModes.filter((mode) => listed.includes(mode))
    : openAiRequest
      ? ["inline", "fullscreen"]
      : [];
  return chatgpt ? modes.filter((mode) => mode !== "pip") : modes;
}

// ---------------------------------------------------------------------------
// Live updates. The card follows a checkout by calling our tools through the
// host; when it can't, it must say so rather than promise updates, and tell
// our server why once (card_diagnostics) so the logs show which case it is.

/** Why the card isn't following the checkout, as card_diagnostics takes it. */
export const DIAGNOSTIC_REASONS = [
  /** ui/initialize didn't list serverTools and ChatGPT's callTool is missing. */
  "no-server-tools",
  /** ui/initialize never answered (or failed). */
  "initialize-failed",
  /** serverTools wasn't listed, but a tools/call went through anyway. */
  "tools-unadvertised",
  /** Active, but no read for a while: superseded by a newer card. */
  "stalled-frozen",
  /** Active, but no read for a while: the idle pause. */
  "stalled-paused",
  /** Active, but no read for a while: the card or its page is hidden. */
  "stalled-hidden",
  /** Active, but no read for a while, for no reason the card knows. */
  "stalled-unknown",
  /** The card shrank, but the host kept its frame at the taller height. */
  "frame-kept-height",
] as const;
export type DiagnosticReason = (typeof DIAGNOSTIC_REASONS)[number];

/** No read for this long while active (polls run every 4 s) counts as stalled. */
export const STALL_MS = 30_000;

/** Why an active checkout went unread for too long, or null when it didn't. */
export function stallReason(situation: {
  readonly active: boolean;
  readonly sinceRead: number;
  readonly frozen: boolean;
  readonly paused: boolean;
  readonly hidden: boolean;
}): DiagnosticReason | null {
  if (!situation.active || situation.sinceRead < STALL_MS) {
    return null;
  }
  if (situation.frozen) {
    return "stalled-frozen";
  }
  if (situation.paused) {
    return "stalled-paused";
  }
  return situation.hidden ? "stalled-hidden" : "stalled-unknown";
}

export interface ModeOffers {
  /** "Expand": ask for fullscreen. */
  readonly expand: boolean;
  /** "Keep visible": ask for picture-in-picture. */
  readonly pip: boolean;
  /** "Back to chat": return to inline. */
  readonly back: boolean;
}

/**
 * Which display-mode buttons the card shows. Expand and Keep visible are for
 * an active checkout (its secure step, its question, or a long run worth
 * keeping in view), and only for modes the host lists. Out of inline, the
 * way back is offered when the host lists inline. A superseded card offers
 * nothing.
 */
export function modeOffers(situation: {
  readonly available: readonly DisplayMode[];
  readonly current: DisplayMode;
  readonly active: boolean;
  readonly frozen: boolean;
}): ModeOffers {
  const can = (mode: DisplayMode) => situation.available.includes(mode);
  if (situation.current !== "inline") {
    return { expand: false, pip: false, back: can("inline") };
  }
  const offer = situation.active && !situation.frozen;
  return {
    expand: offer && can("fullscreen"),
    pip: offer && can("pip"),
    back: false,
  };
}

/** Whether the host runs on a phone: its context says so, or ChatGPT's user agent does. */
export function onMobile(platform: unknown, openAiUserAgent: unknown) {
  if (platform === "mobile") {
    return true;
  }
  const device = record(record(openAiUserAgent)?.device);
  return device?.type === "mobile";
}

/**
 * Whether opening the secure step should ask for fullscreen by itself: on a
 * phone (inline height is capped there), from inline, once per request, when
 * the host lists fullscreen.
 */
export function autoFullscreen(situation: {
  readonly available: readonly DisplayMode[];
  readonly current: DisplayMode;
  readonly mobile: boolean;
  readonly alreadyFor: string | null;
  readonly requestId: string;
}) {
  return (
    situation.mobile &&
    situation.current === "inline" &&
    situation.available.includes("fullscreen") &&
    situation.alreadyFor !== situation.requestId
  );
}

/** Safe-area insets from the host context as CSS lengths; zero for anything odd. */
export function safeArea(value: unknown) {
  const data = record(value);
  const side = (key: string) => {
    const length = data?.[key];
    return typeof length === "number" && Number.isFinite(length) && length >= 0
      ? `${Math.min(Math.round(length), 200)}px`
      : "0px";
  };
  return {
    top: side("top"),
    right: side("right"),
    bottom: side("bottom"),
    left: side("left"),
  };
}

/**
 * A model-context block the user doesn't need to see. ChatGPT shows each
 * `ui/update-model-context` block as a removable composer attachment unless
 * it is marked for the assistant only.
 */
export function assistantOnly(text: string) {
  return {
    type: "text" as const,
    text,
    annotations: { audience: ["assistant" as const] },
  };
}

// ---------------------------------------------------------------------------
// Step cards. In ChatGPT and Claude a checkout is a conversation: one new card
// per step the user has to take (a store question, the payment, private
// details) and one for how it ended, each drawn by show_checkout_step (start
// cards are only for results that carry no role). A card is
// pinned to the step it was drawn for: once the user acts in it or the
// checkout moves on it settles, and only the newest card for a step is live.

/** The step a checkout is on: `working`, `ask:<requestId>`, or `end`. */
export function stepKey(checkout: Checkout) {
  if (!isActive(checkout)) {
    return "end";
  }
  return checkout.pending ? `ask:${checkout.pending.requestId}` : "working";
}

/** What a card was drawn for and what the user did in it. */
export interface Pinned {
  readonly role: CardRole;
  /** The step it was drawn for (a start card's is `working`). */
  readonly step: string;
  /** The request it was drawn for, if any. */
  readonly pending: Pending | null;
  /**
   * What the user answered here, as they saw it ("Feather wand"); "" when there
   * is nothing to repeat (private details); null until they act in this card.
   */
  readonly said: string | null;
}

/**
 * Whether a card is the live one for its checkout: a step card while the
 * checkout is still on its request, unless an earlier card already shows that
 * step (two results for the same step). A card drawn while the checkout works
 * (a start card, or a step card with nothing to ask) is never live: it keeps
 * one line, since cards are for what the user does.
 */
export function isCurrent(
  pin: Pinned,
  live: Checkout,
  peers: { readonly earlierSameStep: boolean },
) {
  const now = stepKey(live);
  return (
    pin.role === "step" &&
    !peers.earlierSameStep &&
    now === pin.step &&
    now.startsWith("ask:")
  );
}

/** What happened at a request's step, said in a word or two ("Answered"). */
function doneElsewhere(kind: Pending["kind"], ui: Ui) {
  switch (kind) {
    case "question":
      return ui.m.settled.answered;
    case "payment":
      return ui.m.settled.approved;
    case "protected":
      return ui.m.settled.sentSecurely;
  }
}

/**
 * The one line a settled card keeps: what happened at its step ("Approved",
 * "Waiting on you below", "Canceled"). `moved`:
 * the checkout left the card's step while still running, so the user (or the
 * store) took care of it. The newest card (`leader`) also carries the
 * outcome once the checkout ends.
 */
export function settledLine(
  pin: Pinned,
  live: Checkout,
  {
    moved,
    duplicate,
    leader,
  }: { moved: boolean; duplicate: boolean; leader: boolean },
  ui: Ui = EN,
): { tone: Tone; text: string } {
  const outcome = describe(live, ui);
  const ended = !isActive(live);
  const t = ui.m.settled;
  if (duplicate) {
    return { tone: "muted", text: t.shownAbove };
  }
  if (pin.role === "start" || !pin.pending) {
    if (ended) {
      return { tone: outcome.tone, text: outcome.label };
    }
    if (live.pending) {
      return { tone: "attention", text: t.waitingBelow };
    }
    return {
      tone: "muted",
      text: ui.f(t.started, { amount: formatMoney(live.maxCost, ui) }),
    };
  }
  const done =
    pin.said !== null || moved ? doneElsewhere(pin.pending.kind, ui) : null;
  if (done) {
    return ended && leader
      ? {
          tone: outcome.tone,
          text: ui.f(t.doneThen, { done, outcome: outcome.label }),
        }
      : { tone: "muted", text: done };
  }
  if (ended) {
    return { tone: outcome.tone, text: outcome.label };
  }
  return { tone: "attention", text: t.waitingBelow };
}

/**
 * What a store question or private-details card shows once its step passed:
 * the question and what the user answered (empty when they answered
 * elsewhere), or that the details went securely. Never the store. Null while
 * the step hasn't passed, for a second copy of a step, and for payments and
 * start cards, which keep their one line (`settledLine`).
 */
export function passedStep(
  pin: Pinned,
  live: Checkout,
  { moved, duplicate }: { moved: boolean; duplicate: boolean },
):
  | {
      readonly kind: "question";
      readonly question: string;
      readonly said: string;
    }
  | { readonly kind: "protected" }
  | null {
  const pending = pin.pending;
  if (
    pin.role !== "step" ||
    !pending ||
    pending.kind === "payment" ||
    duplicate
  ) {
    return null;
  }
  if (pin.said === null && !moved && live.status !== "succeeded") {
    return null;
  }
  return pending.kind === "question"
    ? { kind: "question", question: pending.question, said: pin.said ?? "" }
    : { kind: "protected" };
}

/**
 * Whether a step card keeps showing what it showed: the checkout stopped
 * (cancelled, failed, couldn't buy, expired) and the assistant says so in
 * text. Only when one of the card's own reads since it loaded saw the
 * checkout active (`seenActive`): a card replayed after the stop (a reload,
 * an old conversation) settles to its one line. A placed order still
 * settles its cards. A kept card is frozen: nothing in it answers or opens.
 */
export function keepsLastState(
  pin: Pinned,
  live: Checkout,
  seenActive: boolean,
) {
  return (
    seenActive &&
    pin.role === "step" &&
    pin.pending !== null &&
    !isActive(live) &&
    live.status !== "succeeded"
  );
}

/**
 * What the user answered in a card, from ChatGPT's saved widget state:
 * `said`, or a card saved before it was kept as `done`, the whole settled
 * line ("Answered · Feather wand", "Sent securely"). Null when they didn't
 * act in it.
 */
export function savedSaid(state: unknown): string | null {
  const saved = record(state);
  if (typeof saved?.said === "string") {
    return saved.said;
  }
  if (typeof saved?.done !== "string") {
    return null;
  }
  const at = saved.done.indexOf(" · ");
  return at === -1 ? "" : saved.done.slice(at + 3);
}

/**
 * The message the card sends as the user once they answered or approved in
 * it, so the host's model takes a turn, waits for the next step and shows it.
 * Just what the user chose, as if they typed it: the host may show it in the
 * conversation (ChatGPT sometimes hides it again). The model learns which
 * checkout and what to do next from the model-context note sent first.
 * Never a value from a protected field or a card.
 */
export function stepDoneMessage(
  checkout: Pick<Checkout, "store">,
  done:
    | { readonly kind: "answer"; readonly said: string }
    | { readonly kind: "protected" },
) {
  switch (done.kind) {
    case "answer":
      return done.said;
    case "protected":
      return `Sent ${checkout.store} the details securely`;
  }
}

/**
 * Whether a checkout has moved on past the payment request it was waiting on:
 * still going (another step, or working) or done. Not when it was cancelled,
 * failed or blocked, or asks for a payment again (the charge may have
 * failed): then nothing says the payment went through.
 */
export function paidPast(
  checkout: Pick<Checkout, "status" | "pending">,
  requestId: string,
): boolean {
  if (
    checkout.pending?.requestId === requestId ||
    checkout.pending?.kind === "payment"
  ) {
    return false;
  }
  return (
    checkout.status === "running" ||
    checkout.status === "awaiting_input" ||
    checkout.status === "succeeded"
  );
}

/**
 * Whether the server says a spending limit paid the payment the card asked
 * about (card_checkout with `paidFor`): not a decline or the user's other
 * words, which also move a checkout on.
 */
export function paidOf(params: unknown): boolean {
  const result = record(params);
  return (
    !!result &&
    result.isError !== true &&
    record(result._meta)?.[CARD_PAID] === true
  );
}

/** What the card says, as the user, once a payment went through on Menta. */
export function paidOnMentaMessage(checkout: Pick<Checkout, "store">) {
  return `I set up a spending limit on Menta and it paid the ${checkout.store} checkout`;
}

/**
 * How long the newest card waits for the assistant to draw a step the store
 * opened before offering to show it in place.
 */
export const UNSHOWN_STEP_MS = 20_000;

/**
 * Stores with an icon on our site (apps/web/public/stores, the homepage's
 * set), by a label of their domain, with the name people know them by.
 */
export const STORE_ICONS: Readonly<
  Record<string, { readonly file: string; readonly name: string }>
> = {
  allbirds: { file: "allbirds.png", name: "Allbirds" },
  amazon: { file: "amazon.svg", name: "Amazon" },
  audible: { file: "audible.svg", name: "Audible" },
  carrefour: { file: "carrefour.svg", name: "Carrefour" },
  dominos: { file: "dominos.svg", name: "Domino's" },
  doordash: { file: "doordash.svg", name: "DoorDash" },
  etsy: { file: "etsy.svg", name: "Etsy" },
  eventbrite: { file: "eventbrite.svg", name: "Eventbrite" },
  gymshark: { file: "gymshark.png", name: "Gymshark" },
  hellofresh: { file: "hellofresh.svg", name: "HelloFresh" },
  huel: { file: "huel.png", name: "Huel" },
  ikea: { file: "ikea.svg", name: "IKEA" },
  instacart: { file: "instacart.svg", name: "Instacart" },
  kyliecosmetics: { file: "kyliecosmetics.png", name: "Kylie Cosmetics" },
  liquiddeath: { file: "liquiddeath.png", name: "Liquid Death" },
  netflix: { file: "netflix.svg", name: "Netflix" },
  newbalance: { file: "newbalance.svg", name: "New Balance" },
  nike: { file: "nike.svg", name: "Nike" },
  opentable: { file: "opentable.svg", name: "OpenTable" },
  playstation: { file: "playstation.svg", name: "PlayStation" },
  rakuten: { file: "rakuten.svg", name: "Rakuten" },
  shopee: { file: "shopee.svg", name: "Shopee" },
  skims: { file: "skims.png", name: "SKIMS" },
  spotify: { file: "spotify.svg", name: "Spotify" },
  starbucks: { file: "starbucks.svg", name: "Starbucks" },
  steam: { file: "steam.svg", name: "Steam" },
  swiggy: { file: "swiggy.svg", name: "Swiggy" },
  taobao: { file: "taobao.svg", name: "Taobao" },
  target: { file: "target.svg", name: "Target" },
  ubereats: { file: "ubereats.svg", name: "Uber Eats" },
  uniqlo: { file: "uniqlo.svg", name: "UNIQLO" },
  walmart: { file: "walmart.svg", name: "Walmart" },
  youtube: { file: "youtube.svg", name: "YouTube" },
  zalando: { file: "zalando.svg", name: "Zalando" },
};

/** The site a store lives at, as our store routes take it ("www.amazon.com" → "amazon.com"). */
export function storeSite(store: string) {
  return store
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

/**
 * How the card shows a store: the homepage's own icon and name for the stores
 * it knows ("amazon.co.uk" → Amazon), else the icon our server reads from the
 * store's site (`/mcp/card/store/<site>/icon`, the letter if there's none) and
 * the domain until the store's own name arrives (`storeNames`).
 */
export function storeBrand(store: string, origin: string) {
  const host = storeSite(store);
  const known = host
    .split(".")
    .map((label) => STORE_ICONS[label])
    .find(Boolean);
  const letter = (host.match(/[a-z0-9]/)?.[0] ?? "?").toUpperCase();
  return known
    ? { name: known.name, icon: `${origin}/stores/${known.file}`, letter }
    : {
        name: store,
        icon: `${origin}/mcp/card/store/${encodeURIComponent(host)}/icon`,
        letter,
      };
}

/**
 * The host's chat colors the card sits on, read from their apps (October
 * 2026): only grounds, surfaces and lines follow the host; Menta's type,
 * buttons and accents stay its own. A host that passes MCP Apps style
 * variables overrides these.
 */
export const HOST_COLORS = {
  chatgpt: {
    light: {
      ground: "#fcfcfc",
      card: "#ffffff",
      well: "#f3f3f3",
      line: "rgb(0 0 0 / 10%)",
    },
    dark: {
      ground: "#0e0e0e",
      card: "#0e0e0e",
      well: "#303030",
      line: "rgb(255 255 255 / 15%)",
    },
  },
  claude: {
    light: {
      ground: "#ffffff",
      card: "#ffffff",
      well: "#f9f9f9",
      line: "rgb(0 0 0 / 10%)",
    },
    dark: {
      ground: "#191919",
      card: "#191919",
      well: "#1f1f1f",
      line: "rgb(255 255 255 / 12%)",
    },
  },
} as const;

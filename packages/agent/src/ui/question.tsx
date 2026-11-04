"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import {
  type Answer,
  type Draft,
  type FormEntry,
  formAnswers,
  LONG_LIST,
  onePick,
  optionsOf,
  type Said,
  type UiField,
} from "./answers.js";
import { expiryPhrase } from "./format.js";
import { useUi } from "./i18n/context.js";
import { capitalize } from "./i18n/index.js";
import { Check, Chevron, Shield } from "./icons.js";

export function Mark({ on, multiple }: { on: boolean; multiple?: boolean }) {
  return (
    <span
      className={`mt-[1px] inline-flex size-4 flex-none items-center justify-center border-[1.5px] transition-colors ${multiple ? "rounded-[5px]" : "rounded-full"} ${on ? (multiple ? "border-ink bg-ink text-on-ink" : "border-[#10b45e]") : "border-line-strong"}`}
    >
      {on ? (
        multiple ? (
          <Check width={11} height={11} />
        ) : (
          <span className="size-[7px] rounded-full bg-[#10b45e]" />
        )
      ) : null}
    </span>
  );
}

const inputClass =
  "h-10 rounded-[12px] border border-line bg-surface px-3 text-base text-ink outline-none transition-colors placeholder:text-placeholder focus:border-ink disabled:text-muted sm:text-[14px]";

export function Choices({
  field,
  name,
  draft,
  locked,
  onChange,
}: {
  field: UiField;
  name: string;
  draft: Draft;
  locked: boolean;
  onChange: (draft: Draft) => void;
}) {
  const ui = useUi();
  const options = optionsOf(field, ui);
  if (!field.multiple && options.length > LONG_LIST) {
    const value = typeof draft === "string" ? draft : "";
    return (
      <div className="relative">
        <select
          id={name}
          aria-label={field.label}
          value={value}
          disabled={locked}
          onChange={(event) => onChange(event.currentTarget.value)}
          className={`h-10 w-full appearance-none truncate rounded-[12px] border border-line bg-surface pr-9 pl-3 text-base outline-none transition-colors hover:border-line-strong focus:border-ink disabled:text-muted sm:text-[14px] ${value ? "text-ink" : "text-placeholder"}`}
        >
          <option value="" disabled>
            {ui.m.form.choosePlaceholder}
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="text-ink"
            >
              {option.label}
            </option>
          ))}
        </select>
        <Chevron
          width={14}
          height={14}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rotate-90 text-muted"
        />
      </div>
    );
  }
  const isOn = (value: string) =>
    field.kind === "boolean"
      ? draft === (value === "yes")
      : Array.isArray(draft)
        ? draft.includes(value)
        : draft === value;
  return (
    <div
      className={
        field.kind === "boolean"
          ? "flex flex-wrap gap-2"
          : "flex flex-col gap-1.5"
      }
    >
      {options.map((option) => {
        const on = isOn(option.value);
        return (
          <label
            key={option.value}
            className={`option-row relative flex items-start gap-3 rounded-[12px] px-3.5 py-2.5 text-[14px] leading-snug text-ink transition-[background-color,opacity,box-shadow] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30 ${on ? "is-on" : ""} ${locked ? (on ? "" : "opacity-45") : "cursor-pointer"}`}
          >
            <input
              type={field.multiple ? "checkbox" : "radio"}
              name={name}
              value={option.value}
              checked={on}
              disabled={locked}
              onChange={() => {
                if (field.kind === "boolean") {
                  onChange(option.value === "yes");
                } else if (field.multiple) {
                  const current = Array.isArray(draft) ? draft : [];
                  onChange(
                    current.includes(option.value)
                      ? current.filter((value) => value !== option.value)
                      : [...current, option.value],
                  );
                } else {
                  onChange(option.value);
                }
              }}
              className="sr-only"
            />
            <Mark on={on} multiple={field.multiple} />
            <OptionText label={option.label} />
          </label>
        );
      })}
    </div>
  );
}

/**
 * An option's label with a trailing price ("Energizer MAX AA ($5.97)") set
 * apart on the right, the way a store lists it.
 */
export function splitPrice(label: string): {
  name: string;
  price: string | null;
} {
  const match = label.match(/^(.*\S)\s*\(([^()]*\d[^()]*)\)\s*$/);
  const price = match?.[2]?.trim() ?? "";
  return match?.[1] && /[$€£¥₹]|\b[A-Z]{3}\b/.test(price)
    ? { name: match[1], price }
    : { name: label, price: null };
}

/**
 * How much of a row a store's field takes: in a split address form (three or
 * more short fields like Street, City, ZIP) the parts share rows the way an
 * address form lays them out (street and apt, then city, state and ZIP);
 * everything else takes the whole row.
 */
function addressPart(field: UiField) {
  if (field.kind === "choice" || field.kind === "boolean") {
    return null;
  }
  const label = field.label.trim().toLowerCase();
  if (label.length > 24) {
    return null;
  }
  if (/^(apt|suite|unit|address line 2|address 2|line 2)\b/.test(label)) {
    return "col-span-2";
  }
  if (/^(street|address line 1|address 1|line 1|address)\b/.test(label)) {
    return "col-span-4";
  }
  if (/^(city|town|state|province|region|zip|postal|postcode)\b/.test(label)) {
    return "col-span-2";
  }
  return null;
}

export function fieldWidths(fields: readonly UiField[]) {
  const parts = fields.map(addressPart);
  const split = parts.filter(Boolean).length >= 3;
  return new Map(
    fields.map((field, index) => [
      field.key,
      (split && parts[index]) || "col-span-6",
    ]),
  );
}

/** The start of an option's name, for the Choose button. */
function shortName(name: string) {
  const words = name.split(/\s+/);
  let out = "";
  for (const word of words) {
    if ((out ? `${out} ${word}` : word).length > 22) {
      break;
    }
    out = out ? `${out} ${word}` : word;
  }
  return (out || name.slice(0, 22)).replace(/[,;:]$/, "");
}

function OptionText({ label }: { label: string }) {
  const { name, price } = splitPrice(label);
  return (
    <>
      <span className="min-w-0 flex-1 text-pretty [overflow-wrap:anywhere]">
        {name}
      </span>
      {price ? (
        <span className="flex-none text-soft tabular-nums">{price}</span>
      ) : null}
    </>
  );
}

/**
 * One pick answers it: the options as rows to choose from, sent with the
 * Choose button. The chosen row stays marked once sent; the rest fade.
 */
function PickRows({
  field,
  chosen,
  sent,
  sending,
  locked,
  onChoose,
}: {
  field: UiField;
  chosen: string | null;
  sent: boolean;
  sending: boolean;
  locked: boolean;
  onChoose: (value: string) => void;
}) {
  const ui = useUi();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="sr-only">{field.label}</legend>
      {optionsOf(field, ui).map((option) => {
        const on = chosen === option.value;
        return (
          <label
            key={option.value}
            className={`option-row relative flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[14px] leading-snug text-ink transition-[background-color,opacity,box-shadow] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${on ? "is-on" : ""} ${locked ? "" : "cursor-pointer"} ${(sent || sending) && !on ? "opacity-40" : ""}`}
          >
            <input
              type="radio"
              name={`pick-${field.key}`}
              value={option.value}
              checked={on}
              disabled={locked}
              onChange={() => onChoose(option.value)}
              className="sr-only"
            />
            {on && sending ? (
              <span className="spinner flex-none" />
            ) : (
              <Mark on={on} />
            )}
            <OptionText label={option.label} />
          </label>
        );
      })}
    </fieldset>
  );
}

/** The store's question, kept to five lines unless the user opens it up. */
export function Asks({ text }: { text: string }) {
  const { m } = useUi();
  const [whole, setWhole] = useState(false);
  const [long, setLong] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the question changes
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      if (!element.classList.contains("line-clamp-5")) {
        return;
      }
      setLong(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver !== "function") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, whole]);
  if (!text) {
    return null;
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <p
        ref={ref}
        className={`m-0 text-[15px] leading-snug text-pretty text-soft ${whole ? "" : "line-clamp-5"}`}
      >
        {text}
      </p>
      {long || whole ? (
        <button
          type="button"
          onClick={() => setWhole(!whole)}
          aria-expanded={whole}
          className="text-[13px] text-muted underline underline-offset-2 hover:text-ink"
        >
          {whole ? m.form.showLess : m.form.showMore}
        </button>
      ) : null}
    </div>
  );
}

/** What the user sends: the answers (and how they read), or something else instead. */
export type Submission =
  | {
      readonly kind: "answers";
      readonly answers: Record<string, Answer>;
      readonly said: readonly Said[];
      readonly secret: boolean;
    }
  | { readonly kind: "instead"; readonly text: string };

/**
 * One store request answered in place: the question, its fields, "Something
 * else…" for an answer the options don't offer, and the send row. Private
 * fields are drawn by `renderProtected` (Crossmint's protected input, whose
 * values never reach this component) inside `wrapSecret`; the caller collects
 * them in `onSubmit`, which throws to show an error.
 *
 * `pick`: a single pick is a list of rows to choose from and one "Choose …"
 * button, with "Something else" beside it, as the in-host card does.
 * `canSend: false`: the surface can't send (a host that won't let the card
 * call tools), so the form only shows the question and says to answer in chat.
 */
export function RequestForm({
  requestId,
  question,
  expiresAt,
  entries,
  sent,
  onSubmit,
  renderProtected,
  wrapSecret = (content) => content,
  pick = false,
  canSend = true,
  disabled = false,
  secretNote,
  chat = true,
  scrollClassName = "max-h-[min(42dvh,380px)] overflow-y-auto overscroll-contain",
}: {
  requestId: string;
  question: string;
  expiresAt: string | null;
  entries: readonly FormEntry[];
  /** What was sent for this request, if anything: the form shows it locked. */
  sent: Record<string, Draft> | undefined;
  onSubmit: (
    submission: Submission,
    drafts: Record<string, Draft>,
  ) => Promise<void>;
  renderProtected?: (
    field: Extract<FormEntry, { kind: "protected" }>["field"],
    locked: boolean,
  ) => ReactNode;
  wrapSecret?: (content: ReactNode) => ReactNode;
  pick?: boolean;
  canSend?: boolean;
  /**
   * Not ready to send (a secure field still loading), or never (a card
   * frozen on a stopped checkout): every control waits.
   */
  disabled?: boolean;
  secretNote?: ReactNode;
  /** A chat sits beside the form, so the hint offers answering there too. */
  chat?: boolean;
  scrollClassName?: string;
}) {
  const ui = useUi();
  const { m, f } = ui;
  const standard = entries.flatMap((entry) =>
    entry.kind === "standard" ? [entry.field] : [],
  );
  const secret = entries.some((entry) => entry.kind === "protected");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(sent ?? {});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const locked = Boolean(sent) || sending || !canSend || disabled;
  const { answers } = formAnswers(standard, drafts, ui);
  // "Something else": what the user wants when the store's options don't fit,
  // sent to Crossmint as an alternative reply instead of the answers.
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState("");
  const instead = !secret && otherOpen ? other.trim() : "";
  const ready =
    instead !== "" ||
    (answers !== null && (secret || Object.keys(answers).length > 0));
  const labelled = entries.length > 1;
  const quick = pick && canSend ? onePick(entries) : null;
  const picked = quick ? drafts[quick.key] : undefined;
  const [choice, setChoice] = useState<string | null>(null);
  const pickedValue =
    picked === undefined
      ? null
      : typeof picked === "boolean"
        ? picked
          ? "yes"
          : "no"
        : String(picked);

  async function send(next: Record<string, Draft>, text: string) {
    if (sending || sent || !canSend || disabled) {
      return;
    }
    const built = formAnswers(standard, next, ui);
    if (
      !text &&
      (!built.answers || (!secret && Object.keys(built.answers).length === 0))
    ) {
      return;
    }
    setSending(true);
    setError("");
    try {
      await onSubmit(
        text
          ? { kind: "instead", text }
          : {
              kind: "answers",
              answers: built.answers ?? {},
              said: built.said,
              secret,
            },
        next,
      );
    } catch (cause) {
      if (quick) {
        setDrafts({});
      }
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSending(false);
    }
  }

  const widths = fieldWidths(standard);
  const fields = () =>
    entries.map((entry) => {
      const { field } = entry;
      const id = `${requestId}-${field.key}`;
      if (entry.kind === "protected") {
        return (
          <div key={field.key} className="col-span-6 flex flex-col gap-1.5">
            <span className="label text-muted">{field.label}</span>
            {renderProtected?.(entry.field, locked)}
          </div>
        );
      }
      const set = (draft: Draft) =>
        setDrafts((current) => ({ ...current, [field.key]: draft }));
      const standardField = entry.field;
      return (
        <fieldset
          key={field.key}
          className={`m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0 ${widths.get(field.key) ?? "col-span-6"}`}
        >
          <legend className={labelled ? "label mb-1.5 text-muted" : "sr-only"}>
            {field.label}
          </legend>
          {standardField.kind === "choice" ||
          standardField.kind === "boolean" ? (
            <Choices
              field={standardField}
              name={id}
              draft={drafts[field.key]}
              locked={locked}
              onChange={set}
            />
          ) : (
            <input
              id={id}
              aria-label={field.label}
              disabled={locked}
              autoComplete="off"
              inputMode={
                standardField.kind === "integer"
                  ? "numeric"
                  : standardField.kind === "number"
                    ? "decimal"
                    : undefined
              }
              placeholder={standardField.placeholder ?? undefined}
              value={
                typeof drafts[field.key] === "string"
                  ? (drafts[field.key] as string)
                  : ""
              }
              onChange={(event) => set(event.currentTarget.value)}
              className={inputClass}
            />
          )}
        </fieldset>
      );
    });

  const chosen = pickedValue ?? choice;
  const chooseNow = () => {
    if (!quick || chosen === null) {
      return;
    }
    const draft: Draft = quick.kind === "boolean" ? chosen === "yes" : chosen;
    const next = { [quick.key]: draft };
    setDrafts(next);
    void send(next, "");
  };
  const chosenLabel = quick
    ? (optionsOf(quick, ui).find((option) => option.value === chosen)?.label ??
      "")
    : "";
  const body = quick ? (
    <PickRows
      field={quick}
      chosen={chosen}
      sent={Boolean(sent) || pickedValue !== null}
      sending={sending}
      locked={locked || otherOpen || pickedValue !== null}
      onChoose={setChoice}
    />
  ) : secret ? (
    wrapSecret(<div className="grid grid-cols-6 gap-3">{fields()}</div>)
  ) : (
    <div
      className={`grid grid-cols-6 gap-3 transition-opacity duration-150 ${instead ? "opacity-40" : ""}`}
    >
      {fields()}
    </div>
  );

  const showButton = canSend && !sent && (!quick || otherOpen);
  const expiry = expiryPhrase(expiresAt, Date.now(), ui);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !locked) {
          void send(drafts, instead);
        }
      }}
      className="flex flex-col gap-3"
    >
      <div
        className={`-mx-1 -my-0.5 flex flex-col gap-3 px-1 py-0.5 ${scrollClassName}`}
      >
        <Asks text={question} />
        {body}
        {secret ||
        sent ||
        !canSend ||
        (quick && pickedValue !== null) ? null : otherOpen ? (
          <label className="flex animate-[fade-in_150ms_ease-out] flex-col gap-1.5 motion-reduce:animate-none">
            <span className="label text-muted">{m.form.somethingElse}</span>
            <input
              autoFocus
              disabled={locked}
              value={other}
              onChange={(event) => setOther(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOtherOpen(false);
                  setOther("");
                }
              }}
              placeholder={m.form.somethingElsePlaceholder}
              className={inputClass}
            />
          </label>
        ) : null}
      </div>
      {/* A private field: Send securely right under it, full width, and the note under that, its shield at the first line. */}
      <div
        className={
          secret && canSend && !sent
            ? "flex flex-col-reverse gap-2.5"
            : "flex min-h-10 items-center gap-3"
        }
      >
        <span
          role={sent || sending ? "status" : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 text-xs text-muted ${secret && canSend && !sent ? "items-start" : ""}`}
        >
          {sent ? (
            <>
              <span className="spinner flex-none" />
              {m.form.sentWaiting}
            </>
          ) : !canSend ? (
            m.form.answerInChat
          ) : secret ? (
            <>
              <Shield width={13} height={13} className="mt-px flex-none" />
              <span className="text-pretty">
                {secretNote ?? m.form.secretNote}
              </span>
            </>
          ) : otherOpen ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOtherOpen(false);
                setOther("");
              }}
              className="tap relative text-[13px] text-muted underline decoration-line-strong underline-offset-[3px] hover:text-ink"
            >
              {m.form.backToOptions}
            </button>
          ) : quick && pickedValue !== null ? null : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOtherOpen(true)}
              className="tap relative text-[13px] text-muted underline decoration-line-strong underline-offset-[3px] hover:text-ink"
            >
              {m.form.somethingElse}
            </button>
          )}
          {!sent && !secret && canSend && !chat && expiry
            ? ` · ${capitalize(expiry, ui.tag)}`
            : null}
        </span>
        {quick &&
        chosen !== null &&
        !otherOpen &&
        canSend &&
        !sent &&
        pickedValue === null ? (
          <button
            type="button"
            disabled={sending || disabled}
            onClick={chooseNow}
            className="raised-ink h-10 max-w-[60%] flex-none animate-[fade-in_150ms_ease-out] truncate rounded-full bg-ink px-[18px] text-[14px] font-medium text-on-ink transition-opacity hover:bg-ink-hover disabled:opacity-30 motion-reduce:animate-none"
          >
            {f(m.form.choose, {
              name: shortName(splitPrice(chosenLabel).name),
            })}
          </button>
        ) : showButton ? (
          <button
            type="submit"
            disabled={!ready || sending || disabled}
            className={`raised-ink flex-none rounded-full bg-ink px-[18px] text-[14px] font-medium text-on-ink transition-opacity hover:bg-ink-hover disabled:opacity-30 ${secret ? "h-11 w-full" : "h-10"}`}
          >
            {sending
              ? m.form.sending
              : secret
                ? m.form.sendSecurely
                : m.form.send}
          </button>
        ) : null}
      </div>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </form>
  );
}

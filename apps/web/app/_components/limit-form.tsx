"use client";
import type { ApprovalStep, PaymentRequest } from "@oca/agent/approval";
import { menuPanel, useMenu } from "@oca/agent/ui/approval";
import type { Host } from "@oca/client/secure-page";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "../../lib/client/account";
import { useI18n } from "../../lib/i18n/client";
import { rich } from "../../lib/i18n/rich";
import { secondaryButton } from "../(app)/settings/section";
import { ApprovalSkeleton } from "./approval-skeleton";
import { Calendar } from "./calendar";
import { Check, Chevron, Close, Shield } from "./icons";

// Crossmint's SDK loads only for the approval itself.
const CrossmintScope = dynamic(
  () => import("./crossmint").then((m) => m.CrossmintScope),
  { ssr: false, loading: () => <ApprovalSkeleton row /> },
);
const ApprovePayment = dynamic(
  () => import("./crossmint").then((m) => m.ApprovePayment),
  { ssr: false, loading: () => <ApprovalSkeleton row /> },
);

const EXPIRIES = ["week", "month", "custom"] as const;
export type Expiry = (typeof EXPIRIES)[number];

export function expiryOf(expiry: Exclude<Expiry, "custom">) {
  const date = new Date();
  if (expiry === "week") {
    date.setDate(date.getDate() + 7);
    return date;
  }
  // The same day a month on, or that month's last day when it has fewer
  // (Jan 31 → Feb 28, not Mar 3).
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return date;
}

/** Tomorrow, by the calendar: the first day a chosen date can be. */
function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

/** "amazon.es" or "https://www.amazon.es/x" as a URL; null when it isn't one. */
export function storeUrl(store: string | null) {
  const typed = store?.trim();
  if (!typed) {
    return null;
  }
  try {
    const url = new URL(
      /^https?:\/\//i.test(typed) ? typed : `https://${typed}`,
    );
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

const siteOf = (url: URL) => url.hostname.replace(/^www\./, "");

/** One row of the details, as on a spending limit's page: the name, then its value on the right. */
const field =
  "flex min-h-[52px] w-full items-center gap-3.5 px-4.5 py-3 text-left";

/**
 * A details row whose value is a choice: the name on the left, the chosen
 * option on the right, and the options in a menu under it, like the card.
 */
function RowMenu<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; node: ReactNode }[];
  onChange: (value: T) => void;
}) {
  const chosen = options.find((option) => option.value === value);
  const { button, list, open, toggle, close, style } = useMenu();
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className={`${field} disabled:opacity-60 [&:hover>svg]:text-ink`}
      >
        <span className="flex-none text-soft">{label}</span>
        <span className="ml-auto min-w-0 truncate text-ink">
          {chosen?.node}
        </span>
        <Chevron
          width={14}
          height={14}
          aria-hidden="true"
          className={`flex-none text-muted transition-transform ${open ? "-rotate-90" : "rotate-90"}`}
        />
      </button>
      <div
        ref={list}
        popover="auto"
        role="listbox"
        aria-label={label}
        style={style}
        className={menuPanel}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              close();
            }}
            className="flex min-h-11 w-full flex-none items-center gap-3 rounded-[10px] px-2.5 text-left text-[15px] text-ink transition-colors hover:bg-black/[0.04]"
          >
            <span className="min-w-0 flex-1 truncate">{option.node}</span>
            {option.value === value ? (
              <Check width={14} height={14} className="flex-none" />
            ) : null}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * "Limit to a store": the store's address, typed, with its icon showing once
 * typing pauses; Save takes it. As its own native dialog, above a modal.
 */
function StoreDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (url: URL) => void;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const t = m.checkout.limit;
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(initial);
  const url = storeUrl(typed);
  const site = url ? siteOf(url) : null;
  const [shown, setShown] = useState(site);
  useEffect(() => {
    const timer = setTimeout(() => setShown(site), 400);
    return () => clearTimeout(timer);
  }, [site]);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
    }
    input.current?.focus();
    return () => element?.close();
  }, []);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is the mouse's Escape, which onCancel handles
    <dialog
      ref={dialog}
      aria-labelledby="limit-store-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-[24px] bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] text-ink shadow-[0_24px_60px_-20px_rgb(0_0_0/40%)] backdrop:bg-black/30 open:animate-[sheet-up_280ms_cubic-bezier(0.22,1,0.36,1)] sm:m-auto sm:max-w-[400px] sm:rounded-[24px] sm:pb-4"
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (url) {
            onSave(url);
          }
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="limit-store-title"
            className="m-0 text-[17px] font-semibold tracking-[-0.02em]"
          >
            {t.storeTitle}
          </h2>
          <button
            type="button"
            aria-label={m.app.modal.close}
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
          >
            <Close width={14} height={14} />
          </button>
        </div>
        <label
          htmlFor="limit-store"
          className="flex min-h-[52px] items-center gap-3 rounded-[16px] bg-stage px-4"
        >
          <span className="sr-only">{t.website}</span>
          {shown ? <StoreFavicon key={shown} site={shown} /> : null}
          <input
            ref={input}
            id="limit-store"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={m.app.wallet.create.storePlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
          />
        </label>
        <button
          type="submit"
          disabled={!url}
          className="raised-ink flex h-11 w-full items-center justify-center rounded-full bg-ink text-[14px] font-medium text-on-ink disabled:bg-line-strong disabled:shadow-none"
        >
          {t.save}
        </button>
      </form>
    </dialog>
  );
}

/**
 * The calendar for "Pick a date", as its own native dialog: it opens in the
 * browser's top layer, above a modal it may be in, as a sheet on phones.
 */
function DateDialog({
  label,
  closeLabel,
  selected,
  onPick,
  onClose,
}: {
  label: string;
  closeLabel: string;
  selected: Date | undefined;
  onPick: (date: Date) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
    }
    return () => element?.close();
  }, []);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is the mouse's Escape, which onCancel handles
    <dialog
      ref={dialog}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop (the dialog itself, outside its panel) closes it.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-[24px] bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))] text-ink shadow-[0_24px_60px_-20px_rgb(0_0_0/40%)] backdrop:bg-black/30 open:animate-[sheet-up_280ms_cubic-bezier(0.22,1,0.36,1)] sm:m-auto sm:max-w-[360px] sm:rounded-[24px] sm:pb-3"
    >
      <div className="flex items-center justify-between gap-3 pb-1 pl-2">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">
          {label}
        </span>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
        >
          <Close width={14} height={14} />
        </button>
      </div>
      <Calendar
        bare
        mode="single"
        required
        selected={selected}
        defaultMonth={selected ?? tomorrow()}
        onSelect={(date) => {
          if (date) {
            onPick(date);
          }
        }}
        startMonth={tomorrow()}
        disabled={{ before: tomorrow() }}
      />
    </dialog>
  );
}

/** The store's own icon beside its name, only when it has one: no letter in its place. */
function StoreFavicon({ site }: { site: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !site) {
    return null;
  }
  return (
    // biome-ignore lint/performance/noImgElement: served by our own route, any store's size; next/image adds nothing
    <img
      src={`/mcp/card/store/${encodeURIComponent(site)}/icon`}
      alt=""
      width={16}
      height={16}
      className="size-4 self-center rounded-[4px] object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export interface LimitStart {
  readonly name?: string;
  readonly amount?: string;
  readonly currency: string;
  /** A store to offer (a request names one); the user can drop it for any store. */
  readonly store?: URL | null;
  readonly expiry?: Expiry;
  /** With `expiry: "custom"`, the day it ends. */
  readonly day?: Date;
}

/** What was approved, for the caller's own confirmation. */
export interface LimitMade {
  readonly orderIntentId: string;
  readonly name: string;
  readonly amount: { readonly value: string; readonly currency: string };
  readonly ends: Date;
  /** The one store it works at ("amazon.com"), or null for any store. */
  readonly store: string | null;
}

/**
 * A new spending limit, laid out like a spending limit's own page and
 * editable where each detail sits: the amount, large; the name, the store
 * and when it expires as rows; the card as a row with its dropdown; then
 * Crossmint's Approve and Cancel. Only the user's click on Approve makes it.
 *
 * `currencies` adds the currency row (Wallet). "Works for" is any store, or
 * one store: the request's, or one the user names in its own dialog.
 */
export function LimitForm({
  start,
  currencies,
  card,
  onApproved,
  onCancel,
  onStep,
  host = null,
}: {
  start: LimitStart;
  /** The assistant that asked, named in the note under Approve. */
  host?: Host | null;
  currencies?: readonly string[];
  /** The card it starts on; else the default. */
  card?: string;
  onApproved: (made: LimitMade) => void;
  onCancel: () => void;
  onStep?: (step: ApprovalStep["kind"]) => void;
}) {
  const { m, f, tag } = useI18n();
  const t = m.checkout.limit;
  const create = m.app.wallet.create;
  const { country } = useAccount();
  const [currency, setCurrency] = useState(start.currency);
  const [amount, setAmount] = useState(start.amount ?? "");
  const [name, setName] = useState(start.name ?? "");
  /** The store it can be limited to: the one offered, or one the user named. */
  const [known, setKnown] = useState<URL | null>(start.store ?? null);
  const [store, setStore] = useState<URL | null>(start.store ?? null);
  /** The "Limit to a store" dialog is open. */
  const [naming, setNaming] = useState(false);
  const [expiry, setExpiry] = useState<Expiry>(start.expiry ?? "month");
  const [day, setDay] = useState<Date>(start.day ?? expiryOf("month"));
  /** The calendar is open: the user chose to pick a date and hasn't yet. */
  const [picking, setPicking] = useState(false);
  const [step, setStep] = useState<ApprovalStep["kind"]>("select");
  const locked = step !== "select";

  const options = useMemo(() => {
    const names = new Intl.DisplayNames([tag], { type: "currency" });
    return (currencies ?? [])
      .map((code) => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, tag));
  }, [currencies, tag]);

  // The currency's sign and which side of the number it goes in this language.
  const sign = useMemo(() => {
    const parts = new Intl.NumberFormat(tag, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(1);
    const at = parts.findIndex((part) => part.type === "currency");
    const number = parts.findIndex((part) => part.type === "integer");
    return { text: parts[at]?.value ?? currency, before: at < number };
  }, [currency, tag]);

  const value = amount
    .trim()
    .replace(",", ".")
    .replace(/^0+(?=\d)/, "")
    // Trailing zero decimals say nothing: "5000.00" yen is 5000 yen. Only up
    // to two: three digits after the mark are thousands ("5,000"), and stay
    // too many decimals instead of turning into 5.
    .replace(/\.(\d{0,2})$/, (_, decimals: string) => {
      const kept = decimals.replace(/0+$/, "");
      return kept ? `.${kept}` : "";
    });
  // As many decimals as the currency has: none for JPY, two for most.
  const places = useMemo(
    () =>
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2,
    [currency],
  );
  const amountOk =
    new RegExp(places > 0 ? `^\\d+(\\.\\d{1,${places}})?$` : "^\\d+$").test(
      value,
    ) && Number(value) > 0;
  const nameOk = name.trim().length > 0;
  const chosenStore = store;
  /** A chosen date runs to the end of that day, in the user's time zone. */
  const ends = useMemo(() => {
    if (expiry !== "custom") {
      return expiryOf(expiry);
    }
    const end = new Date(day);
    end.setHours(23, 59, 59, 0);
    return end;
  }, [expiry, day]);
  const request: PaymentRequest | null =
    amountOk && nameOk
      ? {
          amount: { value, currency },
          description: name.trim(),
          expiresAt: ends.toISOString(),
          ...(chosenStore
            ? {
                merchant: {
                  name: siteOf(chosenStore),
                  url: chosenStore.origin,
                  countryCode: country ?? "US",
                },
              }
            : {}),
        }
      : null;

  return (
    <>
      <fieldset
        disabled={locked}
        className="m-0 flex flex-col gap-5 border-0 p-0"
      >
        <div className="flex flex-col items-center gap-2">
          <label
            htmlFor="limit-amount"
            className="flex max-w-full items-baseline justify-center gap-1 text-[44px] font-semibold tracking-[-0.04em] tabular-nums sm:text-[52px]"
          >
            <span className="sr-only">{t.amount}</span>
            {sign.before ? (
              <span aria-hidden="true" className="text-muted">
                {sign.text}
              </span>
            ) : null}
            <input
              id="limit-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/[^\d.,]/g, ""))
              }
              style={{ width: `${Math.max(amount.length, 1) + 0.5}ch` }}
              className="min-w-0 bg-transparent p-0 text-center outline-none placeholder:text-faint"
              aria-invalid={!amountOk || undefined}
            />
            {sign.before ? null : (
              <span aria-hidden="true" className="text-muted">
                {sign.text}
              </span>
            )}
          </label>
        </div>

        {/* The details, as a spending limit's own page lists them, each editable where it sits. */}
        {/* Lines between the rows only: each menu's popover sits after its row, so the last row isn't the last child. */}
        <div className="rounded-[20px] bg-stage text-[15px] [&>:not([popover])~:not([popover])]:border-t [&>:not([popover])~:not([popover])]:border-black/[0.04]">
          <label htmlFor="limit-name" className={field}>
            <span className="flex-none text-soft">{t.name}</span>
            <input
              id="limit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoComplete="off"
              data-1p-ignore=""
              data-lpignore="true"
              placeholder={create.namePlaceholder}
              className="ml-auto min-w-0 flex-1 bg-transparent text-right text-ink outline-none placeholder:text-faint"
              aria-invalid={!nameOk || undefined}
            />
          </label>
          {options.length > 0 ? (
            <RowMenu
              label={create.currency}
              value={currency}
              onChange={setCurrency}
              options={options.map((option) => ({
                value: option.code,
                node: (
                  <>
                    {option.name}{" "}
                    <span className="text-muted">{option.code}</span>
                  </>
                ),
              }))}
            />
          ) : null}
          <RowMenu
            label={t.worksFor}
            value={store ? "store" : "any"}
            onChange={(choice) => {
              if (choice === "limit") {
                setNaming(true);
                return;
              }
              setStore(choice === "store" ? known : null);
            }}
            options={[
              ...(known
                ? [
                    {
                      value: "store" as const,
                      node: rich(t.onlyAt, {
                        store: (
                          <span className="inline-flex items-baseline gap-1.5">
                            <StoreFavicon site={siteOf(known)} />
                            {siteOf(known)}
                          </span>
                        ),
                      }),
                    },
                  ]
                : []),
              { value: "any" as const, node: t.anyStore },
              { value: "limit" as const, node: t.storeTitle },
            ]}
          />
          <RowMenu
            label={t.expires}
            value={expiry}
            onChange={(key) => {
              // Choosing a date opens the calendar on top; the choice holds once a day is picked.
              if (key === "custom") {
                setPicking(true);
                return;
              }
              setExpiry(key);
              setDay(expiryOf(key));
            }}
            options={EXPIRIES.map((key) => ({
              value: key,
              node:
                key === "custom" && expiry === "custom"
                  ? day.toLocaleDateString(tag, { dateStyle: "medium" })
                  : create.expiresIn[key],
            }))}
          />
        </div>
      </fieldset>

      {naming ? (
        <StoreDialog
          initial={known ? siteOf(known) : ""}
          onSave={(url) => {
            setKnown(url);
            setStore(url);
            setNaming(false);
          }}
          onClose={() => setNaming(false)}
        />
      ) : null}
      {picking ? (
        <DateDialog
          label={create.expiresIn.custom}
          closeLabel={m.app.modal.close}
          selected={expiry === "custom" ? day : undefined}
          onPick={(date) => {
            setDay(date);
            setExpiry("custom");
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}

      <section aria-label={t.card} className="flex min-w-0 flex-col gap-2.5">
        {/* The card and Approve show from the start; Approve waits for a complete form. */}
        <CrossmintScope
          fallback={
            <ApprovalSkeleton label={m.settings.cardManager.loadingCards} row />
          }
        >
          {() => (
            <ApprovePayment
              request={
                request ?? {
                  amount: { value: amountOk ? value : "0", currency },
                  description: name.trim(),
                  expiresAt: ends.toISOString(),
                }
              }
              card={card}
              compact
              compactLabel={t.card}
              approveLabel={t.setUp}
              cardNote={
                // Like the note under a private store field: who never sees the card.
                <p className="m-0 flex items-start gap-2 px-1 text-xs text-muted">
                  <Shield width={13} height={13} className="mt-px flex-none" />
                  <span className="text-pretty">
                    {host
                      ? f(t.cardNoteNamed, { host: host.name })
                      : t.cardNote}
                  </span>
                </p>
              }
              blocked={request === null}
              onAuthorized={(orderIntentId) =>
                onApproved({
                  orderIntentId,
                  name: name.trim(),
                  amount: { value, currency },
                  ends,
                  store: chosenStore ? siteOf(chosenStore) : null,
                })
              }
              onStep={(next) => {
                setStep(next);
                onStep?.(next);
              }}
            />
          )}
        </CrossmintScope>
        {request === null && (amount.trim() || name.trim()) ? (
          <p className="text-[13px] text-attention-ink">
            {!amountOk ? t.invalidAmount : t.invalidName}
          </p>
        ) : null}
        {locked ? null : (
          <button
            type="button"
            onClick={onCancel}
            className={`${secondaryButton} w-full`}
          >
            {t.cancel}
          </button>
        )}
      </section>
    </>
  );
}

"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../../../lib/i18n/client";
import { AgentIcon } from "../../_components/agent-icon";
import { CloseButton } from "../../_components/modal";
import { DetailPane, usePane } from "../../_components/pane";
import { DetailHeader, ListGroup, ListRow } from "../list";
import { bleed } from "../page-shell";
import type { Purchase } from "./feed";

/** Merchant, date and amount: the same grid for the header and every row. */
export const columns =
  "grid grid-cols-[minmax(0,1fr)_auto_minmax(4.5rem,auto)] items-center gap-4";

/**
 * A store's app icon, from our own origin (the route the checkout card uses,
 * which reads it from the store's site), so no third party learns where the
 * user shops. Its first letter until it loads or when there's none.
 */
export function MerchantIcon({
  site,
  className = "size-7 rounded-[8px] text-[12px]",
}: {
  site: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex flex-none items-center justify-center overflow-hidden bg-chip font-semibold text-soft uppercase ring-1 ring-black/[0.06] ${className}`}
    >
      {site.charAt(0)}
      {failed ? null : (
        // biome-ignore lint/performance/noImgElement: served by our own route, any store's size; next/image adds nothing
        <img
          src={`/mcp/card/store/${encodeURIComponent(site)}/icon`}
          alt=""
          className="absolute inset-0 size-full bg-white object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/** Formats totals and dates in the page's language. */
export function useFormat() {
  const { tag } = useI18n();
  const format = {
    money(amount: string, currency: string) {
      try {
        return new Intl.NumberFormat(tag, {
          style: "currency",
          currency,
        }).format(Number(amount));
      } catch {
        return `${amount} ${currency}`;
      }
    },
    /**
     * How long ago or from now, in words: "now", "5 minutes ago", "yesterday",
     * "in 3 weeks", "in 1 year". Tables show these; details show the moment.
     */
    relative(iso: string | null) {
      if (!iso) {
        return "";
      }
      const when = new Date(iso);
      const seconds = (when.getTime() - Date.now()) / 1000;
      const size = Math.abs(seconds);
      if (size < 22 * 3600 || size >= 6 * 86_400) {
        // Words like "last month" name the calendar; rounded spans only count.
        const words = new Intl.RelativeTimeFormat(tag, {
          numeric: size < 45 ? "auto" : "always",
        });
        const [count, unit]: [number, Intl.RelativeTimeFormatUnit] =
          size < 45
            ? [0, "second"]
            : size < 45 * 60
              ? [seconds / 60, "minute"]
              : size < 22 * 3600
                ? [seconds / 3600, "hour"]
                : size < 26 * 86_400
                  ? [seconds / (7 * 86_400), "week"]
                  : size < 320 * 86_400
                    ? [seconds / (30 * 86_400), "month"]
                    : [seconds / (365 * 86_400), "year"];
        return words.format(Math.round(count), unit);
      }
      // Days count by the calendar, so "yesterday" is the day before today.
      const days = Math.round(
        (new Date(when).setHours(0, 0, 0, 0) -
          new Date().setHours(0, 0, 0, 0)) /
          86_400_000,
      );
      return new Intl.RelativeTimeFormat(tag, { numeric: "auto" }).format(
        days,
        "day",
      );
    },
    /**
     * How long until then, without "in": "1 month", "3 days", "5 hours", for
     * a column headed "Expires in". Past moments fall back to `relative`.
     */
    remaining(iso: string) {
      const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
      if (!(seconds > 0)) {
        return format.relative(iso);
      }
      const [count, unit]: [number, string] =
        seconds < 3600
          ? [Math.max(1, Math.round(seconds / 60)), "minute"]
          : seconds < 22 * 3600
            ? [Math.round(seconds / 3600), "hour"]
            : seconds < 6 * 86_400
              ? [Math.round(seconds / 86_400), "day"]
              : seconds < 26 * 86_400
                ? [Math.round(seconds / (7 * 86_400)), "week"]
                : seconds < 320 * 86_400
                  ? [Math.round(seconds / (30 * 86_400)), "month"]
                  : [Math.round(seconds / (365 * 86_400)), "year"];
      return new Intl.NumberFormat(tag, {
        style: "unit",
        unit,
        unitDisplay: "long",
      }).format(count);
    },
    moment(iso: string | null) {
      return iso
        ? new Intl.DateTimeFormat(tag, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(iso))
        : "";
    },
  };
  return format;
}

/** The table's card: column headings, then rows or an empty state. */
export function Table({ children }: { children: ReactNode }) {
  const { m } = useI18n();
  const t = m.app.transactions.columns;
  return (
    <div className={`${bleed} overflow-hidden`}>
      <div
        aria-hidden="true"
        className={`${columns} h-10 border-b border-black/[0.06] px-5 text-[12px] font-medium text-muted`}
      >
        <span>{t.merchant}</span>
        <span className="text-right">{t.date}</span>
        <span className="text-right">{t.amount}</span>
      </div>
      <div className="divide-y divide-black/[0.05]">{children}</div>
    </div>
  );
}

/** One purchase: merchant, date and amount. Opens its details. */
export function Row({
  run,
  selected,
  onOpen,
}: {
  run: Purchase;
  selected: boolean;
  onOpen: (button: HTMLButtonElement) => void;
}) {
  const { m } = useI18n();
  const { money, relative, moment } = useFormat();
  const receipt = run.result?.receipt;
  // In the pane (wide screens) nothing pops up: the row is the one shown.
  const wide = usePane();
  return (
    <button
      type="button"
      aria-haspopup={wide ? undefined : "dialog"}
      aria-expanded={wide ? undefined : selected}
      aria-current={wide && selected ? true : undefined}
      onClick={(event) => onOpen(event.currentTarget)}
      className={`${columns} min-h-14 w-full px-5 py-2.5 text-left transition-colors hover:bg-black/[0.03] focus-visible:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset ${selected ? "bg-black/[0.04]" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {/* The store is its site ("amazon.com"), as the filter lists it. */}
        <MerchantIcon site={run.store} />
        <span className="truncate font-medium">{run.store}</span>
      </span>
      <span
        className="text-right text-[13px] text-quiet"
        title={moment(run.createdAt)}
      >
        {relative(run.createdAt)}
      </span>
      <span className="text-right font-medium tabular-nums">
        {receipt ? (
          money(receipt.total.amount, receipt.total.currency)
        ) : (
          <span className="text-muted" title={m.app.transactions.noTotal}>
            <span aria-hidden="true">—</span>
            <span className="sr-only">{m.app.transactions.noTotal}</span>
          </span>
        )}
      </span>
    </button>
  );
}

/** A full-width line in the table: loading, empty or a short notice. */
export function TableNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 text-[13px] text-pretty text-quiet">
      {children}
    </div>
  );
}

/**
 * A labelled block of text an agent or store wrote, any length: four lines,
 * then Show more (only when there's more to show) to read it all.
 */
function Expandable({ label, text }: { label: string; text: string }) {
  const { m } = useI18n();
  const t = m.app.transactions.detail;
  const body = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  // Measured while clamped, and again whenever its box changes: the details
  // dialog is still closed (nothing has a height) when this first runs, and
  // the window or a late font can reflow the text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: text is a trigger: measured again for each text
  useLayoutEffect(() => {
    const element = body.current;
    if (!element || open) {
      return;
    }
    let live = true;
    const measure = () => {
      if (live) {
        setLong(element.scrollHeight > element.clientHeight + 1);
      }
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [text, open]);
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="m-0 text-[13px] font-medium text-muted">{label}</h3>
      <div className="flex flex-col items-start gap-1 rounded-[20px] bg-stage px-4.5 py-3.5">
        <p
          ref={body}
          className={`m-0 text-[14px] whitespace-pre-line text-pretty text-soft [overflow-wrap:anywhere] ${open ? "" : "line-clamp-4"}`}
        >
          {text}
        </p>
        {long ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="tap relative text-[13px] font-medium text-ink underline underline-offset-2"
          >
            {open ? t.less : t.more}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * A purchase's details, in the app's modal (a panel from the right; a bottom
 * sheet on phones): the total and request, when, which agent, the order
 * number, where it ships and the store's summary. Nothing to do there: it
 * only shows what happened. Closing returns focus to the row.
 */
export function Detail({
  run,
  onClose,
}: {
  run: Purchase;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const t = m.app.transactions.detail;
  const { money, moment } = useFormat();
  const receipt = run.result?.receipt;

  return (
    <DetailPane labelledBy="transaction-title" onClose={onClose}>
      {(close) => (
        <div className="flex min-h-full flex-col gap-6 p-5 sm:p-6">
          <DetailHeader
            id="transaction-title"
            icon={
              <MerchantIcon
                site={run.store}
                className="size-16 rounded-[18px] text-[24px]"
              />
            }
            title={run.store}
            sub={
              receipt
                ? money(receipt.total.amount, receipt.total.currency)
                : m.app.transactions.noTotal
            }
            close={
              close ? <CloseButton label={t.close} onClick={close} /> : null
            }
          />
          <ListGroup>
            <ListRow label={t.date} value={moment(run.createdAt)} />
            {run.agent ? (
              <ListRow
                label={t.agent}
                value={
                  <span className="inline-flex max-w-full items-center gap-2">
                    <AgentIcon
                      name={run.agent}
                      className="size-5 rounded-[6px] text-[8px]"
                    />
                    <span className="truncate">{run.agent}</span>
                  </span>
                }
              />
            ) : null}
            {receipt?.merchantOrderId ? (
              <ListRow label={t.order} value={receipt.merchantOrderId} wrap />
            ) : null}
            {run.fulfillment === "delivery" && run.shipsTo ? (
              <ListRow label={t.shipsTo} value={run.shipsTo.label} wrap />
            ) : null}
            {run.fulfillment === "pickup" ? (
              <ListRow label={t.shipsTo} value={t.pickup} />
            ) : null}
          </ListGroup>
          {run.task ? <Expandable label={t.request} text={run.task} /> : null}
          {run.result?.summary ? (
            <Expandable label={t.fromStore} text={run.result.summary} />
          ) : null}
        </div>
      )}
    </DetailPane>
  );
}

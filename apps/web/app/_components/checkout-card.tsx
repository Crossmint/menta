"use client";

import { shortTask } from "@oca/agent/task";
import {
  Dot,
  describeCheckout as describe,
  failureText,
  StatusDot,
} from "@oca/agent/ui";
import { useState } from "react";
import {
  type CheckoutView,
  clock,
  isActive,
  isMissing,
  money,
  stepLine,
  useCheckout,
  useNow,
} from "../../lib/client/checkouts";
import { Chevron } from "./icons";

/** The status dot and its tones are the shared checkout UI's (also in the ChatGPT/Claude card). */
export {
  Dot,
  describeCheckout as describe,
  StatusDot,
  type Tone,
  toneText,
} from "@oca/agent/ui";

/** Same footprint as a loaded card, so nothing jumps when the run arrives. */
export function CheckoutCardSkeleton() {
  return (
    <section
      aria-label="Loading checkout"
      aria-busy="true"
      className="panel flex animate-pulse flex-col gap-3 px-[18px] pt-4 pb-[18px]"
    >
      <div className="flex items-center justify-between">
        <span className="h-3 w-20 rounded-full bg-chip" />
        <span className="h-3 w-28 rounded-full bg-chip" />
      </div>
      <span className="h-4 w-4/5 rounded-full bg-chip" />
      <span className="h-3 w-40 rounded-full bg-chip" />
    </section>
  );
}

/**
 * One Crossmint checkout, rendered only from fields the API returns. What
 * needs the user (store questions, payment, secure steps, cancel) lives in the
 * checkout dock above the composer; this card is the record.
 */
export function CheckoutCard({
  runId,
  initial,
}: {
  runId: string;
  initial?: CheckoutView | null;
}) {
  const view = useCheckout(runId, initial);
  const now = useNow(15_000);
  if (!view && isMissing(runId)) {
    return (
      <p className="panel px-[18px] py-4 text-[13px] text-muted">
        This checkout isn't available anymore.
      </p>
    );
  }
  if (!view) {
    return <CheckoutCardSkeleton />;
  }
  const status = describe(view);
  const unconfirmed =
    view.status === "failed" &&
    view.result?.failureReason === "reconciliation_required";
  const quote =
    (view.status === "blocked" || view.status === "cancelled") &&
    view.result?.summary;
  const active = isActive(view);
  const line = active ? stepLine(view, now) : null;
  return (
    <section
      aria-label="Checkout"
      className={`overflow-hidden ${unconfirmed ? "rounded-[20px] border border-dashed border-[#A1A1AA] bg-white" : "panel"}`}
    >
      <div className="flex items-center gap-2.5 px-[18px] pt-3.5">
        <StatusDot {...status} />
        <span className="flex-1" />
        <a
          href={view.startUrl}
          target="_blank"
          rel="noreferrer"
          className="truncate font-mono text-xs text-muted hover:text-ink"
        >
          {view.store}
        </a>
      </div>
      <div className="flex flex-col gap-1 px-[18px] pt-2.5 pb-[18px]">
        <span className="text-[17px] font-semibold tracking-[-0.02em]">
          {view.task ? shortTask(view.task) : view.store}
        </span>
        <span className="text-[13px] text-muted">
          Up to <span className="font-mono">{money(view.maxCost)}</span>
          {isActive(view) && view.pending?.kind !== "payment"
            ? " · paid only from your spending limits"
            : view.createdAt
              ? ` · started ${clock(view.createdAt)}`
              : ""}
        </span>
        {view.shipsTo ? (
          <span className="truncate text-[13px] text-muted">
            Delivery to {view.shipsTo.label} · {view.shipsTo.place}
          </span>
        ) : null}
        {line ? (
          <span
            title={line.text}
            className="line-clamp-2 text-[13px] leading-snug text-pretty text-muted"
          >
            <span
              key={line.text}
              className={`animate-[fade-in_300ms_ease-out] motion-reduce:animate-none ${line.running ? "shimmer" : ""}`}
            >
              {line.text}
            </span>
          </span>
        ) : null}
        {view.status === "succeeded" && view.result?.confirmedWithoutReceipt ? (
          <p className="mt-1.5 text-[13px] text-muted">
            The store confirmed the order. No receipt was captured, so check
            your email for the store's confirmation.
          </p>
        ) : null}
        {quote ? (
          <p className="mt-1.5 text-[13px] text-soft">“{quote}”</p>
        ) : null}
        {view.status === "failed" ? (
          <p className="mt-1.5 text-[13px] text-soft">
            {failureText(view.result?.failureReason)}
          </p>
        ) : null}
      </div>
      {view.status === "succeeded" && view.result?.receipt ? (
        <div className="well mx-2.5 mb-2.5 grid grid-cols-2 gap-3 rounded-[14px] p-4">
          <span className="flex flex-col">
            <span className="label text-muted">Receipt total</span>
            <span className="text-xl font-semibold tracking-[-0.03em]">
              {money(view.result.receipt.total)}
            </span>
          </span>
          {view.result.receipt.merchantOrderId ? (
            <span className="flex min-w-0 flex-col">
              <span className="label text-muted">Store order</span>
              <span className="mt-1 font-mono text-[13px] [overflow-wrap:anywhere]">
                {view.result.receipt.merchantOrderId}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Where a checkout started: one quiet line that opens the full card. While the
 * run is active its live state is in the dock, and when it settles the outcome
 * card appears where the conversation is.
 */
export function CheckoutRow({
  runId,
  initial,
}: {
  runId: string;
  initial?: CheckoutView | null;
}) {
  const live = useCheckout(runId, initial);
  const view = live ?? initial;
  const [open, setOpen] = useState(false);
  // Clip only while it opens or closes, so the card keeps its shadow.
  const [opened, setOpened] = useState(false);
  if (!view) {
    return (
      <span
        role="status"
        aria-label="Loading checkout"
        className="h-9 w-72 max-w-full animate-pulse rounded-full bg-chip"
      />
    );
  }
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setOpened(false);
        }}
        className="tap relative inline-flex h-9 max-w-full items-center gap-2.5 self-start rounded-full border border-line-card bg-white pr-2.5 pl-3.5 text-[13px] text-soft raised-light hover:text-ink"
      >
        <Dot tone={live ? describe(live).tone : "idle"} />
        <span className="truncate">
          Checkout started · {view.store} · up to {money(view.maxCost)}
        </span>
        <Chevron
          width={14}
          height={14}
          className={`flex-none text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>
      <div
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget) {
            setOpened(open);
          }
        }}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div
          className={`min-h-0 ${opened ? "overflow-visible" : "overflow-hidden"}`}
          inert={!open}
        >
          <div className="px-px pt-2.5 pb-4">
            <CheckoutCard runId={runId} initial={initial} />
          </div>
        </div>
      </div>
    </div>
  );
}

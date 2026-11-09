"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { expiresIn, money } from "./format.js";
import { useUi } from "./i18n/context.js";
import { around } from "./i18n/index.js";
import { CrossmintLogo, Lock } from "./icons.js";

/**
 * Holds a loading line until Crossmint's form has its final size, then shows
 * it in one step. On its way in, the form goes from a connecting spinner to
 * nothing to an iframe that grows as it loads; the surface would grow, dip
 * and grow again following it. The form loads underneath, transparent.
 */
export function Settled({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || ready) {
      return;
    }
    let quiet: number | undefined;
    // Settled: something to show (not a spinner), unchanged for a moment.
    const check = () => {
      window.clearTimeout(quiet);
      const frame = element.querySelector("iframe");
      const showing = frame
        ? frame.getBoundingClientRect().height > 0
        : element.offsetHeight > 0 && !element.querySelector(".spinner");
      if (showing) {
        quiet = window.setTimeout(() => setReady(true), 400);
      }
    };
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(check) : null;
    observer?.observe(element);
    const frames = new MutationObserver(() => {
      const frame = element.querySelector("iframe");
      if (frame) {
        observer?.observe(frame);
      }
      check();
    });
    frames.observe(element, { childList: true, subtree: true });
    check();
    const latest = window.setTimeout(() => setReady(true), 10_000);
    return () => {
      observer?.disconnect();
      frames.disconnect();
      window.clearTimeout(quiet);
      window.clearTimeout(latest);
    };
  }, [ready]);
  return (
    <div className={ready ? "" : "relative h-28 overflow-clip"}>
      {ready ? null : (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center gap-2.5 text-[13px] text-muted"
        >
          <span className="spinner" /> {label}
        </div>
      )}
      <div
        ref={ref}
        inert={!ready}
        className={
          ready ? "" : "pointer-events-none absolute inset-x-0 top-0 opacity-0"
        }
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The payment step, as the dock shows it: the amount, whom it goes to, then
 * the approval itself (`children`: our saved-card list and Approve, with
 * Crossmint's card checks) or where it stands once the user approved. The
 * approval is only ever the user's click in Crossmint's flow; nothing here
 * approves anything.
 */
export function PaymentStep({
  amount,
  merchant,
  expiresAt,
  shipsTo,
  phase,
  error,
  onRetry,
  note,
  children,
}: {
  amount: {
    readonly amount: string;
    readonly currency: string;
    readonly exact: boolean;
  };
  merchant: string;
  expiresAt: string | null;
  shipsTo: { readonly label: string; readonly place: string } | null;
  /** `form`: waiting for the user; `sending` and `sent`: they approved. */
  phase: "form" | "sending" | "sent";
  error?: string;
  onRetry?: () => void;
  /** The line under the approval; the dock's "Secured by Crossmint…" by default. */
  note?: ReactNode;
  children?: ReactNode;
}) {
  const ui = useUi();
  const { m, f } = ui;
  const to = `${f(amount.exact ? m.payment.exactTo : m.payment.upToTo, { merchant })}${expiresIn(expiresAt, Date.now(), ui)}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[28px] leading-[1.15] font-semibold tracking-[-0.045em] text-ink">
          {money(amount, ui)}
        </span>
        <span className="min-w-0 truncate text-xs text-muted">{to}</span>
        {shipsTo ? (
          <span className="w-full min-w-0 truncate text-xs text-muted">
            {f(m.payment.deliveryTo, shipsTo)}
          </span>
        ) : null}
      </div>
      {phase !== "form" ? (
        <span
          role="status"
          className="flex items-center gap-2 text-xs text-muted"
        >
          <span className="spinner flex-none" />
          {phase === "sent" ? m.payment.approvedWaiting : m.payment.sending}
        </span>
      ) : (
        children
      )}
      {error ? (
        <span className="text-xs text-danger">
          {error}{" "}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="text-ink underline underline-offset-2"
            >
              {m.common.tryAgain}
            </button>
          ) : null}
        </span>
      ) : phase !== "form" ? null : (
        (note ?? (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Lock width={12} height={12} className="flex-none" />
            {m.payment.securedNote}
          </span>
        ))
      )}
    </div>
  );
}

/** "Powered by" and Crossmint's logo, at the foot of the in-host card's secure steps. */
export function PoweredByCrossmint() {
  const [before, after] = around(useUi().m.common.poweredBy, "logo");
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
      {before.trim() || null}
      <CrossmintLogo
        role="img"
        aria-label="Crossmint"
        aria-hidden={undefined}
        className="h-[11px] w-auto text-ink"
      />
      {after.trim() || null}
    </span>
  );
}

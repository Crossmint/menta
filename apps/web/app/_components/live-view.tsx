"use client";

import type { StepStatus } from "@oca/crossmint-agent-checkouts/checkouts";
import { useEffect, useRef, useState } from "react";
import {
  ago,
  clock,
  isActive,
  money,
  useCheckout,
  useNow,
} from "../../lib/client/checkouts";
import { describe } from "./checkout-card";
import { Check, Close } from "./icons";

/** A spinner while a step runs, a check once it's done, a muted dot otherwise. */
function StepMark({ status }: { status: StepStatus }) {
  return (
    <span
      role="img"
      aria-label={status === "running" ? "In progress" : status}
      className="flex h-[18px] w-3.5 flex-none items-center justify-center"
    >
      {status === "running" ? (
        <span className="spinner" style={{ width: 11, height: 11 }} />
      ) : status === "completed" ? (
        <Check width={13} height={13} className="text-muted" />
      ) : (
        <span className="size-1.5 rounded-full bg-[#A1A1AA]" />
      )}
    </span>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="label pt-0.5 text-muted">{term}</dt>
      <dd className="m-0 min-w-0 break-all">{children}</dd>
    </>
  );
}

const FRAME_SIZE_MESSAGE = "uc-live-view.frame";

/** How long a fresh embed may go without showing a frame before we reconnect it. */
const FIRST_FRAME_MS = 20_000;

/**
 * The embed posts each frame's pixel size (`uc-live-view.frame`); the iframe takes
 * that shape, and the first one tells us a frame is on screen. Only messages from
 * this iframe on the embed's origin are believed. `onStalled` fires when no frame
 * arrives in time (the embed can sit on "Connecting…" or give up for good).
 */
export function LiveFrame({
  src,
  onStalled,
}: {
  src: string;
  onStalled: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [aspectRatio, setAspectRatio] = useState("16 / 10");
  const stalled = useRef(onStalled);
  stalled.current = onStalled;
  useEffect(() => {
    let origin = "";
    const timer = window.setTimeout(() => stalled.current(), FIRST_FRAME_MS);
    try {
      origin = new URL(src).origin;
    } catch {}
    function onMessage(event: MessageEvent) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== origin
      ) {
        return;
      }
      const { type, width, height } = (event.data ?? {}) as {
        type?: unknown;
        width?: unknown;
        height?: unknown;
      };
      if (
        type === FRAME_SIZE_MESSAGE &&
        typeof width === "number" &&
        typeof height === "number" &&
        width > 0 &&
        height > 0
      ) {
        window.clearTimeout(timer);
        setAspectRatio(`${width} / ${height}`);
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [src]);
  return (
    <iframe
      ref={frame}
      title="Checkout browser"
      src={src}
      style={{ aspectRatio }}
      className="mx-auto block max-h-[70dvh] w-full max-w-full border-0 bg-white object-contain"
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
    />
  );
}

/** Crossmint's read-only checkout browser, beside the conversation. */
export function LiveView({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const view = useCheckout(runId);
  const now = useNow(10_000);
  const status = view ? describe(view) : null;
  // Crossmint's embed can sit on "Connecting…" or stop for good ("never started", a
  // failed stream) while the run carries on, and it shows nothing on a page that isn't
  // repainting. Reconnect when no frame shows up in time, a few times with growing
  // gaps, and let the user reconnect by hand. Reconnecting on every run phase made it
  // worse: the new stream attached just as the page went idle, and stayed black.
  const [generation, setGeneration] = useState(0);
  const [retries, setRetries] = useState(0);
  /** Reconnecting by itself failed three times; Reconnect tries again. */
  const [gaveUp, setGaveUp] = useState(false);
  const live = Boolean(view?.liveViewUrl && view && isActive(view));
  return (
    <aside
      aria-label="Live checkout view"
      className="fixed inset-0 z-30 flex animate-[live-in_280ms_cubic-bezier(0.22,1,0.36,1)] flex-col gap-3.5 overflow-y-auto bg-stage p-4 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[min(440px,36vw)] lg:flex-none lg:border-l lg:border-black/[0.06]"
    >
      <div className="flex items-center gap-2.5 pt-1 pr-1 pl-2">
        <span
          className={`size-2 flex-none rounded-full ${view?.status === "running" ? "pulse mascot-fill shadow-[0_0_0_4px_rgb(16_180_94/16%)] [--color-accent-soft:rgb(16_180_94/16%)]" : "bg-[#A1A1AA]"}`}
        />
        <span className="label truncate text-soft">
          {view?.store ? `Live · ${view.store}` : "Live"}
        </span>
        <span className="flex-1" />
        {live ? (
          <button
            type="button"
            aria-label="Reconnect live view"
            title="Reconnect"
            onClick={() => {
              setRetries(0);
              setGaveUp(false);
              setGeneration((current) => current + 1);
            }}
            className="tap relative inline-flex size-9 items-center justify-center rounded-full text-quiet transition-colors hover:bg-black/[0.04] hover:text-ink"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Close live view"
          onClick={onClose}
          className="tap relative inline-flex size-9 items-center justify-center rounded-full text-quiet transition-colors hover:bg-black/[0.04] hover:text-ink"
        >
          <Close />
        </button>
      </div>
      {/* The hairline on top: the frame fills the card and would cover an inset one. */}
      <div className="panel relative overflow-hidden rounded-[16px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(0_0_0/6%)]">
        <div className="flex h-7 items-center gap-1.5 border-b border-black/[0.05] px-3">
          <span className="size-[7px] rounded-full bg-[#E4E4E7]" />
          <span className="size-[7px] rounded-full bg-[#E4E4E7]" />
          <span className="size-[7px] rounded-full bg-[#E4E4E7]" />
        </div>
        {live && view?.liveViewUrl && !gaveUp ? (
          <LiveFrame
            key={generation}
            src={view.liveViewUrl}
            onStalled={() => {
              if (retries >= 3) {
                setGaveUp(true);
              } else if (view.status === "running") {
                window.setTimeout(
                  () => {
                    setRetries((current) => current + 1);
                    setGeneration((current) => current + 1);
                  },
                  2000 * 2 ** retries,
                );
              }
            }}
          />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-well px-8 text-center text-[13px] text-quiet">
            {!view
              ? ""
              : !isActive(view)
                ? "The checkout has finished, so there's nothing live to show."
                : view.status !== "running"
                  ? "The store's browser shows here while the checkout is working."
                  : gaveUp
                    ? "The live view isn't loading. Try Reconnect."
                    : "Connecting to the store's browser…"}
          </div>
        )}
      </div>
      <span className="px-1 text-xs text-muted">
        You can watch, but you can't click inside it.
      </span>
      {view?.progress?.recent.length &&
      (isActive(view) || view.status === "succeeded") ? (
        <section
          aria-label="Recent steps"
          className="panel flex flex-col gap-2.5 rounded-[16px] p-4"
        >
          <span className="label text-muted">Recent</span>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {view.progress.recent.map((step) => (
              <li
                key={`${step.at}-${step.text}`}
                className="flex animate-[fade-in_300ms_ease-out] items-start gap-2.5 text-[13px] leading-snug motion-reduce:animate-none"
              >
                <StepMark status={step.status} />
                <span
                  className={`line-clamp-2 min-w-0 flex-1 text-pretty ${step.status === "running" ? "text-ink" : "text-soft"}`}
                >
                  {step.text}
                </span>
                <span className="flex-none pt-px text-xs text-muted tabular-nums">
                  {ago(step.at, now)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {view ? (
        <dl className="panel m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2.5 rounded-[16px] p-4 text-[13px]">
          <Row term="Status">{status?.label}</Row>
          <Row term="Up to">
            <span className="font-mono">{money(view.maxCost)}</span>
            <span className="text-muted">
              {" "}
              · a ceiling; paid only from your spending limits
            </span>
          </Row>
          {view.createdAt ? (
            <Row term="Started">{clock(view.createdAt)}</Row>
          ) : null}
          <Row term="Store page">
            <a
              href={view.startUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {view.startUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </Row>
        </dl>
      ) : null}
    </aside>
  );
}

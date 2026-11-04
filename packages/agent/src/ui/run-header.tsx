"use client";

import type { ReactNode } from "react";
import { FadeText } from "./fade-text.js";
import { useUi } from "./i18n/context.js";
import { Chevron, Close, Eye } from "./icons.js";
import type { Tone } from "./status.js";
import { Dot, toneText } from "./tone.js";

/**
 * The dock's header row: dot, store, then either what the checkout is doing
 * right now (`line`, crossfading as it changes) or its status. With
 * `expand`, the row is the button that folds the body; `children` are the
 * controls on the right (switch, Watch live, cancel). Lays itself out by its
 * container's width (`@container` on an ancestor).
 */
export function RunHeader({
  tone,
  store,
  status,
  line,
  expand,
  children,
}: {
  tone: Tone;
  store: string;
  status: string;
  line?: { text: string; running: boolean } | null;
  expand?: {
    readonly open: boolean;
    readonly enabled: boolean;
    readonly onToggle: () => void;
  };
  children?: ReactNode;
}) {
  const text = (
    <>
      <Dot tone={tone} />
      <span className="flex min-w-0 leading-4 @max-md:flex-col @md:items-baseline">
        <span
          className={`min-w-[3ch] truncate font-medium text-ink ${line ? "shrink-0 @md:max-w-[14rem]" : ""}`}
        >
          {store}
        </span>
        {line ? (
          <span
            title={line.text}
            className="flex min-w-0 items-baseline whitespace-pre text-soft @max-md:text-xs"
          >
            <span className="flex-none @max-md:hidden">{" · "}</span>
            <FadeText
              text={line.text}
              className={line.running ? "shimmer" : ""}
            />
          </span>
        ) : (
          <span
            className={`shrink-[0.2] truncate whitespace-pre @max-md:text-xs ${toneText[tone]}`}
          >
            <span className="@max-md:hidden">{" · "}</span>
            {status}
          </span>
        )}
      </span>
    </>
  );
  return (
    <div className="flex h-9 items-center gap-1.5">
      {expand ? (
        <button
          type="button"
          disabled={!expand.enabled}
          aria-expanded={expand.enabled ? expand.open : undefined}
          onClick={expand.onToggle}
          className="flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-full pr-2 pl-1 text-left text-[13px]"
        >
          {text}
          {expand.enabled ? (
            <Chevron
              width={14}
              height={14}
              className={`flex-none text-muted transition-transform duration-200 ${expand.open ? "rotate-90" : "-rotate-90"}`}
            />
          ) : null}
        </button>
      ) : (
        <span className="flex h-8 min-w-0 flex-1 items-center gap-2.5 pr-2 pl-1 text-[13px]">
          {text}
        </span>
      )}
      {children}
    </div>
  );
}

/** "+2 more": shows the next checkout. */
export function MoreButton({
  others,
  onClick,
}: {
  others: number;
  onClick: () => void;
}) {
  const { m, f, tag } = useUi();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={f(m.header.moreLabel, { count: others.toLocaleString(tag) })}
      className="h-7 flex-none rounded-full border border-line bg-surface px-2.5 text-xs text-soft hover:border-line-strong hover:text-ink"
    >
      +{others.toLocaleString(tag)}
      <span className="@max-md:hidden"> {m.header.more}</span>
    </button>
  );
}

/** Watch live: the checkout's browser, read-only. */
export function WatchButton({
  open,
  onClick,
  label,
  trailing,
}: {
  open: boolean;
  onClick: () => void;
  label?: string;
  trailing?: ReactNode;
}) {
  const { m } = useUi();
  const shown = label ?? (open ? m.header.watching : m.header.watchLive);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      aria-label={open ? m.header.closeLiveView : shown}
      className="inline-flex h-8 flex-none items-center gap-1.5 rounded-full px-2.5 text-[13px] text-soft hover:bg-surface hover:text-ink aria-pressed:text-accent"
    >
      <Eye width={15} height={15} />
      <span className="@max-md:hidden">{shown}</span>
      {trailing}
    </button>
  );
}

/** The quiet × that asks to cancel the checkout. */
export function CancelButton({ onClick }: { onClick: () => void }) {
  const { m } = useUi();
  return (
    <button
      type="button"
      aria-label={m.header.cancelCheckout}
      onClick={onClick}
      className="inline-flex size-8 flex-none items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
    >
      <Close width={14} height={14} />
    </button>
  );
}

"use client";

/** Quiet text buttons on a row. */
export const rowButton =
  "tap relative inline-flex h-8 flex-none items-center rounded-full px-2.5 text-[13px] text-soft transition-colors hover:bg-black/[0.04] hover:text-ink disabled:opacity-50";

const secondary =
  "raised-light tap relative inline-flex flex-none items-center justify-center rounded-full border border-line-card bg-white font-medium text-soft hover:text-ink disabled:opacity-50";

/** Raised white pills for a row's main action. */
export const pill = `${secondary} h-9 px-3.5 text-[13px]`;

/** A form's secondary button (Cancel), beside `primary`. */
export const secondaryButton = `${secondary} h-10 px-4`;

/** A form's main button: raised ink. */
export const primary =
  "raised tap relative inline-flex h-10 flex-none items-center justify-center gap-2 rounded-full bg-ink px-4.5 font-medium text-white hover:bg-ink-hover disabled:opacity-50";

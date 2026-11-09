"use client";

import { type ComponentProps, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import {
  da,
  de,
  enUS,
  es,
  fi,
  fr,
  hi,
  it,
  ja,
  ko,
  nb,
  nl,
  pl,
  ptBR,
  sv,
  zhCN,
} from "react-day-picker/locale";
import { useI18n } from "../../lib/i18n/client";
import type { Locale } from "../../lib/i18n/locales";
import { Chevron } from "./icons";

/** Month and weekday names, and the week's first day, in each page language. */
const LOCALES: Record<Locale, typeof enUS> = {
  en: enUS,
  es,
  fr,
  de,
  it,
  pt: ptBR,
  nl,
  pl,
  sv,
  nb,
  da,
  fi,
  hi,
  ja,
  ko,
  zh: zhCN,
};

const nav =
  "tap relative inline-flex size-8 items-center justify-center rounded-full text-soft transition-colors hover:bg-black/[0.04] hover:text-ink aria-disabled:pointer-events-none aria-disabled:opacity-30 pointer-coarse:size-10";

/**
 * A month calendar in the app's style (react-day-picker, as shadcn's date
 * picker uses): hairline card, ink for the chosen day, the leaf's green for
 * today, in the page's language. Pass DayPicker's own props (`mode`,
 * `selected`, `onSelect`, `disabled`…).
 */
export function Calendar({
  bare = false,
  ...props
}: ComponentProps<typeof DayPicker> & {
  /** No card of its own: it sits in a sheet or dialog that already frames it. */
  bare?: boolean;
}) {
  const { locale } = useI18n();
  const language = useMemo(() => LOCALES[locale], [locale]);
  return (
    <DayPicker
      locale={language}
      showOutsideDays
      classNames={{
        root: bare ? "relative w-full p-1" : "panel relative w-full p-3",
        months: "flex flex-col",
        month: "flex flex-col gap-2",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-[14px] font-semibold tracking-[-0.01em]",
        nav: bare
          ? "absolute inset-x-1 top-1 flex items-center justify-between"
          : "absolute inset-x-3 top-3 flex items-center justify-between",
        button_previous: nav,
        button_next: nav,
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "flex-1 pb-1 text-center text-[11.5px] font-medium text-muted",
        week: "flex",
        day: "flex flex-1 items-center justify-center p-0.5",
        day_button:
          "tap relative inline-flex size-9 items-center justify-center rounded-full text-[14px] tabular-nums transition-colors hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink pointer-coarse:size-10",
        selected:
          "[&>button]:bg-ink [&>button]:font-medium [&>button]:text-white [&>button]:hover:bg-ink-hover",
        // Today in green, unless it's the chosen day (white on ink).
        today:
          "[&>button]:font-semibold [&:not([aria-selected=true])>button]:text-leaf",
        outside: "[&>button]:text-faint",
        disabled: "[&>button]:pointer-events-none [&>button]:text-faint/60",
        hidden: "invisible",
      }}
      components={{
        Chevron: ({ orientation }) => (
          <Chevron
            width={16}
            height={16}
            aria-hidden="true"
            className={orientation === "left" ? "rotate-180" : ""}
          />
        ),
      }}
      {...props}
    />
  );
}

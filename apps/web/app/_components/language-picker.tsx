"use client";

import { useI18n, useSetLocale } from "../../lib/i18n/client";
import { isLocale, LANGUAGES, LOCALES } from "../../lib/i18n/locales";
import { Chevron, Translate } from "./icons";

/**
 * The language menu: the browser's own select, so it works the same with a
 * mouse, a keyboard, a screen reader and a phone's picker. On the homepage it
 * moves to that language's URL; elsewhere the page re-renders in place.
 */
export function LanguagePicker({
  landing = false,
  compact = false,
  className = "",
}: {
  landing?: boolean;
  /** On phones, just the icon (the homepage header, where space is tight). */
  compact?: boolean;
  className?: string;
}) {
  const { m, locale } = useI18n();
  const setLocale = useSetLocale();
  return (
    <label
      className={`raised-light relative inline-flex h-10 items-center gap-2 rounded-full border border-line-card bg-white pr-9 pl-3.5 text-[13px] font-medium text-soft transition-colors focus-within:border-ink hover:text-ink ${compact ? "max-sm:pr-7 max-sm:pl-3" : ""} ${className}`}
    >
      <Translate
        width={16}
        height={16}
        className="flex-none"
        aria-hidden="true"
      />
      <span className="sr-only">{m.app.language.choose}</span>
      <select
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) {
            setLocale(next, { landing });
          }
        }}
        className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={LANGUAGES[option].tag}>
            {LANGUAGES[option].name}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className={compact ? "max-sm:hidden" : ""}>
        {LANGUAGES[locale].name}
      </span>
      <Chevron
        width={14}
        height={14}
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 rotate-90 text-muted ${compact ? "max-sm:right-2.5" : ""}`}
      />
    </label>
  );
}

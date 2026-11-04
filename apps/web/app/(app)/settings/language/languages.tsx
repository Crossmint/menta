"use client";

import { useI18n, useSetLocale } from "../../../../lib/i18n/client";
import { LANGUAGES, LOCALES } from "../../../../lib/i18n/locales";
import { Check } from "../../../_components/icons";

/** Every language, each in its own words; the current one checked. A tap switches the app in place. */
export function Languages() {
  const { m, locale } = useI18n();
  const setLocale = useSetLocale();
  return (
    <fieldset className="m-0 divide-y divide-black/[0.04] overflow-hidden rounded-[20px] border-0 bg-stage p-0">
      <legend className="sr-only">{m.app.language.choose}</legend>
      {LOCALES.map((option) => (
        <label
          key={option}
          lang={LANGUAGES[option].tag}
          className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4.5 py-3 text-[15px] text-soft transition-colors hover:bg-black/[0.04] hover:text-ink has-[:checked]:text-ink has-[:focus-visible]:bg-black/[0.04] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-inset"
        >
          <input
            type="radio"
            name="language"
            value={option}
            checked={option === locale}
            onChange={() => setLocale(option, { landing: false })}
            className="sr-only"
          />
          {LANGUAGES[option].name}
          {option === locale ? (
            <Check
              width={18}
              height={18}
              aria-hidden="true"
              className="ml-auto text-[#10b45e]"
            />
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}

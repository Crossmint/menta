"use client";

import { usePathname, useRouter } from "next/navigation";
import { rememberLocale, useI18n } from "../../lib/i18n/client";
import {
  LANGUAGES,
  LOCALE_COOKIE,
  LOCALES,
  landingPath,
} from "../../lib/i18n/locales";
import { Globe, Pin } from "../_components/icons";
import { COUNTRIES } from "./markets";

/**
 * For trying the homepage as each visitor sees it: the language (normally
 * the browser's) and the country (normally from the visitor's IP, here
 * `?country=XX`), in the footer's bottom row. Shown locally and on preview
 * deployments, never in production. Picking a language keeps it for this browser, like the
 * settings' picker; "Browser language" forgets it.
 */
export function MarketSwitcher({
  current,
  detected,
}: {
  current: string | null;
  detected: string | null;
}) {
  const { locale, tag } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const names = new Intl.DisplayNames([tag], { type: "region" });
  const label = (code: string) => `${names.of(code) ?? code} (${code})`;
  const query = current ? `?country=${current}` : "";
  return (
    <div className="flex items-center gap-3 rounded-full border border-line py-1 pr-2 pl-2.5 text-[13px] text-quiet">
      <label className="flex items-center gap-1.5">
        <Globe width={15} height={15} className="text-muted" />
        <select
          aria-label="Language"
          value={locale}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "") {
              // biome-ignore lint/suspicious/noDocumentCookie: forgets the test choice so the browser's language decides again
              document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
              router.push(`/${query}`);
              return;
            }
            const chosen = LOCALES.find((code) => code === next);
            if (chosen) {
              rememberLocale(chosen);
              router.push(`${landingPath(chosen)}${query}`);
            }
          }}
          className="cursor-pointer bg-transparent outline-none"
        >
          <option value="">Browser language</option>
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LANGUAGES[code].name}
            </option>
          ))}
        </select>
      </label>
      <span className="h-4 w-px bg-line" />
      <label className="flex items-center gap-1.5">
        <Pin width={15} height={15} className="text-muted" />
        <select
          aria-label="Country"
          value={current ?? ""}
          onChange={(event) => {
            const code = event.target.value;
            router.replace(code ? `${pathname}?country=${code}` : pathname, {
              scroll: false,
            });
          }}
          className="cursor-pointer bg-transparent outline-none"
        >
          <option value="">
            {detected ? `Your location: ${label(detected)}` : "Your location"}
          </option>
          {[...COUNTRIES]
            .sort((a, b) => label(a).localeCompare(label(b), tag))
            .map((code) => (
              <option key={code} value={code}>
                {label(code)}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}

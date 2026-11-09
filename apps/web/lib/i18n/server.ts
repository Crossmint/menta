import { cookies, headers } from "next/headers";
import { format, type Plural, plural, type Vars } from "./format";
import {
  isLocale,
  LANGUAGES,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  type Locale,
  negotiate,
} from "./locales";
import { loadMessages } from "./messages";

/** The request's language, as the proxy decided it (else the cookie, else the browser's). */
export async function getLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  const decided = requestHeaders.get(LOCALE_HEADER);
  if (isLocale(decided)) {
    return decided;
  }
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(chosen)
    ? chosen
    : negotiate(requestHeaders.get("accept-language"));
}

/** Messages and formatters for server components. Pass `locale` where the URL decides it. */
export async function getI18n(locale?: Locale) {
  const current = locale ?? (await getLocale());
  const m = await loadMessages(current);
  const tag = LANGUAGES[current].tag;
  return {
    locale: current,
    tag,
    m,
    f: format,
    p: (count: number, forms: Plural, vars?: Vars) =>
      plural(tag, count, forms, vars),
  };
}

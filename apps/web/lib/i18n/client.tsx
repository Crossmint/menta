"use client";

import { UiLocaleProvider } from "@oca/agent/ui";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, use, useMemo } from "react";
import { format, type Plural, plural, type Vars } from "./format";
import { LANGUAGES, LOCALE_COOKIE, type Locale, landingPath } from "./locales";
import type { Messages } from "./messages";

interface I18n {
  readonly locale: Locale;
  readonly tag: string;
  readonly m: Messages;
  readonly f: typeof format;
  readonly p: (count: number, forms: Plural, vars?: Vars) => string;
}

const Context = createContext<I18n | null>(null);

/** The request's language and messages, from the root layout. */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo<I18n>(() => {
    const tag = LANGUAGES[locale].tag;
    return {
      locale,
      tag,
      m: messages,
      f: format,
      p: (count, forms, vars) => plural(tag, count, forms, vars),
    };
  }, [locale, messages]);
  // The shared checkout components (`@oca/agent/ui`: the dock, the secure page) speak it too.
  return (
    <Context value={value}>
      <UiLocaleProvider locale={locale}>{children}</UiLocaleProvider>
    </Context>
  );
}

export function useI18n() {
  const value = use(Context);
  if (!value) {
    throw new Error("useI18n needs the I18nProvider (app/layout.tsx).");
  }
  return value;
}

/** Keeps a language for this browser: the cookie the proxy reads, which also stops language suggestions. */
export function rememberLocale(locale: Locale) {
  // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie the proxy reads; Cookie Store isn't in every browser
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
}

/**
 * Switches the language for this browser: the cookie the proxy reads, then the
 * same page again in that language (the homepage moves to its URL for it).
 */
export function useSetLocale() {
  const router = useRouter();
  return (locale: Locale, { landing = false } = {}) => {
    rememberLocale(locale);
    if (landing) {
      router.push(landingPath(locale));
    }
    router.refresh();
  };
}

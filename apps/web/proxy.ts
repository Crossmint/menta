import { type NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  type Locale,
  negotiate,
} from "./lib/i18n/locales";

/** The app's pages: signed-out visits go to sign-in before anything renders. */
const PROTECTED = [
  "/chat",
  "/c/",
  "/install",
  "/connections",
  "/wallet",
  "/spending-limits",
  "/spending-limit",
  "/addresses",
  "/transactions",
  "/home",
  "/activity",
  "/settings",
  "/checkouts/",
];

function isProtected(pathname: string) {
  return PROTECTED.some((path) =>
    path.endsWith("/")
      ? pathname.startsWith(path)
      : pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** The public pages with one URL per language: English at these paths, the rest under `/es`, `/ja`… */
const LOCALIZED = ["/", "/help"];

/** The visitor's language: their picker choice, else their browser's. */
function preferred(request: NextRequest): Locale {
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  return isLocale(chosen)
    ? chosen
    : negotiate(request.headers.get("accept-language"));
}

/**
 * Two jobs before a page renders:
 * - Signed-out visits to the app's pages go to sign-in, so nobody sees the app
 *   flash up and then leave. Only the session cookie's presence is checked
 *   here; the pages and APIs still verify the session. The browser keeps the
 *   URL's #anchor across this redirect, and sign-in carries it on.
 * - The page's language. The homepage and help have one URL per language
 *   (`/`, `/es`, `/ja/help`…), and the English URL sends a visitor to theirs;
 *   every other page keeps its URL and reads the language from the header set
 *   here: the one picked in settings, else the browser's.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    isProtected(pathname) &&
    !request.cookies.has("__Host-oca_session") &&
    !request.cookies.has("oca_session")
  ) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const segment = pathname.split("/")[1] ?? "";
  const rest = pathname.slice(segment.length + 1) || "/";
  const localized = isLocale(segment) && LOCALIZED.includes(rest);
  if (localized && segment === DEFAULT_LOCALE) {
    return NextResponse.redirect(new URL(`${rest}${search}`, request.url));
  }
  if (LOCALIZED.includes(pathname)) {
    const locale = preferred(request);
    if (locale !== DEFAULT_LOCALE) {
      const path = pathname === "/" ? "" : pathname;
      return NextResponse.redirect(
        new URL(`/${locale}${path}${search}`, request.url),
      );
    }
  }
  const locale = localized ? segment : preferred(request);
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: not the APIs, the MCP server, Next's own files or anything with an extension.
  matcher: ["/((?!api/|mcp|_next/|\\.well-known/|.*\\.[a-z0-9]+$).*)"],
};

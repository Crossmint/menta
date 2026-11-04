"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  chooseCookies,
  cookieChoice,
  needsCookieChoice,
  onCookieChoiceChanged,
} from "../../lib/client/analytics";
import { useI18n } from "../../lib/i18n/client";
import { LEGAL } from "../../lib/site";
import { Switch } from "./switch";

// Pages where a banner would sit on a payment, an approval or the chat's
// composer and checkout dock; visitors answer it on any other page.
const QUIET = ["/checkouts", "/oauth", "/chat", "/c"];

/** Asks once whether Menta may use an analytics cookie; nothing shows without PostHog. */
export function CookieBanner() {
  const { m } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => setOpen(needsCookieChoice());
    check();
    return onCookieChoiceChanged(check);
  }, []);

  if (
    !open ||
    QUIET.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return null;
  }

  const choose = (accept: boolean) => {
    setOpen(false);
    chooseCookies(accept);
  };

  return (
    <section
      aria-label={m.app.cookies.label}
      className="raised-light fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 rounded-2xl border border-line-card bg-white p-4 text-[14px] text-soft sm:left-auto sm:max-w-sm"
    >
      <p>
        {m.app.cookies.text}{" "}
        <Link href={LEGAL.privacy} className="text-ink underline">
          {m.app.cookies.policy}
        </Link>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => choose(true)}
          className="raised inline-flex h-10 flex-1 items-center justify-center rounded-full bg-ink px-5 font-medium text-white hover:bg-ink-hover"
        >
          {m.app.cookies.accept}
        </button>
        <button
          type="button"
          onClick={() => choose(false)}
          className="raised-light inline-flex h-10 flex-1 items-center justify-center rounded-full border border-line-card bg-white px-5 font-medium text-ink"
        >
          {m.app.cookies.decline}
        </button>
      </div>
    </section>
  );
}

/**
 * The analytics cookie, on or off in this browser, for the privacy policy
 * (in English like it). Off until the visitor accepts; it and the banner
 * follow each other.
 */
export function CookieSwitch() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(cookieChoice() === "granted");
    sync();
    return onCookieChoiceChanged(sync);
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }
  return (
    <div className="well flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
      <span className="font-medium text-ink">Analytics cookies</span>
      <Switch
        checked={on}
        onChange={(next) => {
          setOn(next);
          chooseCookies(next);
        }}
        label="Analytics cookies"
      />
    </div>
  );
}

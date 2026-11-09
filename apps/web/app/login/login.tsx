"use client";

import { returnPath } from "@oca/client/secure-page";
import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n/client";
import type { Messages } from "../../lib/i18n/messages";
import { rich } from "../../lib/i18n/rich";
import {
  domainOf,
  type Inbox,
  inboxFor,
  isProvider,
  providerForDomain,
} from "../../lib/inbox";
import type { Assistant } from "../../lib/server/assistant";
import { LEGAL } from "../../lib/site";
import { CrossmintLogo } from "../_components/brand-marks";
import { ConnectPair } from "../_components/connect-pair";
import { Check, Logo } from "../_components/icons";
import { ASSISTANTS } from "../(home)/assistants";
import { CODE_LENGTH, CodeInput } from "./code-input";

/** How long the code step waits before it offers to send a new code. */
const RESEND_AFTER_SECONDS = 30;

/**
 * Where to go after signing in: a path on this site only, never another one.
 * A server redirect here can't see the original #anchor, but the browser keeps
 * it on this page's URL, so it goes on with the path.
 */
function nextPath() {
  const next =
    returnPath(new URL(window.location.href).searchParams.get("next")) ??
    "/home";
  const hash = window.location.hash;
  return hash && !next.includes("#") && returnPath(next + hash)
    ? next + hash
    : next;
}

/** Google sign-in returns through our callback, which reads this to finish where the user started. */
function rememberNextForGoogle() {
  const secure = window.location.protocol === "https:";
  const name = `${secure ? "__Secure-" : ""}oca_login_next`;
  const next = nextPath();
  const attributes = `Path=/api/auth/google; SameSite=Lax${secure ? "; Secure" : ""}`;
  // biome-ignore lint/suspicious/noDocumentCookie: must be set synchronously before the form navigates; Cookie Store is async and not in every browser.
  document.cookie =
    next === "/install"
      ? `${name}=; ${attributes}; Max-Age=0`
      : `${name}=${encodeURIComponent(next)}; ${attributes}; Max-Age=600`;
}

type Arrivals = Messages["auth"]["login"]["arrivals"];

/**
 * Why the user is signing in, from where they're headed: a secure checkout
 * step or an assistant's connect request get their own words (the Handoff-1
 * board). Otherwise there's none, and the page says what the homepage says.
 */
function arrivalFor(arrivals: Arrivals, next: string | undefined) {
  if (next?.startsWith("/checkouts/")) {
    return arrivals.checkout;
  }
  if (next?.startsWith("/oauth/authorize")) {
    return arrivals.connect;
  }
  return undefined;
}

/** Where the showcase's stores float, in the order of the hero's six (markets.ts). */
const TILES = [
  { at: "left-[12%] top-[14%]", tilt: -12 },
  { at: "right-[14%] top-[10%]", tilt: 14 },
  { at: "left-[7%] top-[46%]", tilt: 8 },
  { at: "right-[8%] top-[52%]", tilt: -9 },
  { at: "left-[18%] bottom-[12%]", tilt: -18 },
  { at: "right-[17%] bottom-[9%]", tilt: 16 },
] as const;

/** A store's app icon: the visitor's market's hero stores, from page.tsx. */
export interface ShowcaseStore {
  readonly id: string;
  readonly logo: string;
}

/**
 * The wide screen's other half: the homepage's promise on its soft grey,
 * the assistants Menta works in, and the hero's stores floating around it.
 */
function Showcase({
  title,
  stores,
}: {
  title: React.ReactNode;
  stores: readonly ShowcaseStore[];
}) {
  return (
    <aside aria-hidden="true" className="hidden flex-1 p-3 lg:block">
      <div className="relative flex h-full flex-col items-center justify-center gap-7 overflow-hidden rounded-[28px] bg-[linear-gradient(#fff,var(--color-stage)_70%)] px-12 text-center ring-1 ring-black/[0.05]">
        {stores.slice(0, TILES.length).map(({ id, logo }, index) => {
          const { at, tilt } = TILES[index] ?? TILES[0];
          return (
            <div key={id} className={`absolute ${at}`}>
              <div
                className="float"
                style={
                  {
                    "--float-duration": `${5 + (index % 3)}s`,
                    "--float-delay": `${-index * 1.3}s`,
                  } as React.CSSProperties
                }
              >
                <span
                  className="block size-16 overflow-hidden rounded-[22%] bg-white shadow-[0_12px_28px_-12px_rgb(0_0_0/45%)] ring-1 ring-black/5"
                  style={{ rotate: `${tilt}deg` }}
                >
                  <Image
                    src={logo}
                    alt=""
                    width={64}
                    height={64}
                    unoptimized
                    className="size-full object-contain"
                  />
                </span>
              </div>
            </div>
          );
        })}
        <p className="m-0 max-w-[480px] text-[44px] leading-[1.04] font-semibold tracking-[-0.05em] text-balance xl:text-[52px]">
          {title}
        </p>
        <div className="flex gap-2.5">
          {ASSISTANTS.map(({ icon }) => (
            <Image
              key={icon}
              src={`/assistants/${icon}.png`}
              alt=""
              width={40}
              height={40}
              unoptimized
              className="size-10 rounded-[11px] ring-1 ring-black/10"
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

export function Login({
  searchParams,
  stores,
  assistant,
}: {
  searchParams: Promise<{
    next?: string | string[];
    password?: string | string[];
  }>;
  stores: readonly ShowcaseStore[];
  assistant: Assistant | null;
}) {
  const { m, f } = useI18n();
  const t = m.auth.login;
  const hero = m.landing.hero;
  const { next, password: withPassword } = use(searchParams);
  const arrival = arrivalFor(
    t.arrivals,
    typeof next === "string" ? next : undefined,
  );
  const inflight = useRef(false);
  /**
   * iOS raises the keyboard only for focus given during a tap, and the code
   * step appears after the code request, so the tap focuses this hidden field
   * to keep the keyboard up; the code field's autoFocus then takes it over.
   */
  const keyboard = useRef<HTMLInputElement>(null);
  /**
   * `/login?password` is the review account's sign-in (docs/CREDENTIALS.md):
   * email and password, linked from nowhere.
   */
  const [stage, setStage] = useState<"email" | "code" | "password">(
    withPassword === undefined ? "email" : "password",
  );
  /** Back from the code step to change the email: the email field takes focus again. */
  const [changing, setChanging] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  /** The code was right: the button turns green with a check on the way out. */
  const [signedIn, setSignedIn] = useState(false);
  /** The webmail the code went to, when we can tell, to open in a new tab. */
  const [inbox, setInbox] = useState<Inbox>();
  /** When a new code can be sent (epoch ms), RESEND_AFTER_SECONDS after the last one went out. */
  const [resendAt, setResendAt] = useState(0);
  /** Seconds left until then, read from the clock so a backgrounded tab (opening the inbox) stays right. */
  const [wait, setWait] = useState(0);
  /** A new code is on its way from the code step; only its own button shows it. */
  const [resending, setResending] = useState(false);
  /** A new code went out from the code step, replacing the first one. */
  const [resent, setResent] = useState(false);
  /** Which message to show under the form, if any. */
  const [error, setError] = useState<
    | ""
    | "googleFailed"
    | "invalidEmail"
    | "sendFailed"
    | "codeFailed"
    | "passwordFailed"
  >("");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("error") === "google_sign_in_failed") {
      setError("googleFailed");
      url.searchParams.delete("error");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
    void fetch("/api/me", { cache: "no-store" }).then((response) => {
      if (response.ok) {
        window.location.replace(nextPath());
      }
    });
  }, []);

  useEffect(() => {
    function tick() {
      const left = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
      setWait(left);
      return left;
    }
    if (tick() === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      if (tick() === 0) {
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  /**
   * A code just went out: hold the resend button for RESEND_AFTER_SECONDS.
   * The count is set here too, not only by the effect, so the render that
   * shows it never paints the button enabled for a frame first.
   */
  function holdResend() {
    setResendAt(Date.now() + RESEND_AFTER_SECONDS * 1000);
    setWait(RESEND_AFTER_SECONDS);
  }

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(String(response.status));
    }
  }

  /** Well-known domains by name; for a custom one, the server reads its mail servers. */
  function findInbox(address: string) {
    setInbox(undefined);
    const domain = domainOf(address);
    const known = providerForDomain(domain);
    if (known) {
      setInbox(inboxFor(known, address));
      return;
    }
    void fetch(`/api/auth/inbox?domain=${encodeURIComponent(domain)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { provider?: unknown } | null) => {
        if (isProvider(body?.provider)) {
          setInbox(inboxFor(body.provider, address));
        }
      })
      .catch(() => {});
  }

  async function submit(entered = code) {
    if (inflight.current) {
      return;
    }
    inflight.current = true;
    let signedInNow = false;
    setBusy(true);
    setError("");
    try {
      if (stage === "email") {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
          throw new Error("email");
        }
        keyboard.current?.focus({ preventScroll: true });
        // Looks up the inbox alongside the request; only the code step shows it.
        findInbox(email.trim());
        await post("/api/auth/request-code", { email: email.trim() });
        setStage("code");
        setResent(false);
        holdResend();
      } else {
        await post(
          stage === "password" ? "/api/auth/password" : "/api/auth/verify-code",
          stage === "password"
            ? { email: email.trim(), password }
            : { code: entered },
        );
        // Stays in flight: the check shows a moment, then the page moves on.
        signedInNow = true;
        setSignedIn(true);
        setTimeout(() => window.location.replace(nextPath()), 600);
      }
    } catch (cause) {
      if (stage === "code") {
        setCode("");
      } else if (stage === "password") {
        setPassword("");
      } else if (document.activeElement === keyboard.current) {
        document.getElementById("credential")?.focus();
      }
      setError(
        cause instanceof Error && cause.message === "email"
          ? "invalidEmail"
          : stage === "email"
            ? "sendFailed"
            : stage === "password"
              ? "passwordFailed"
              : "codeFailed",
      );
    } finally {
      inflight.current = signedInNow;
      setBusy(false);
    }
  }

  /**
   * Sends a new code to the same email; the earlier one stops working, so
   * anything typed meanwhile is cleared. The button it ran from is disabled
   * now, so focus goes back to the code boxes for the new code.
   */
  async function resend() {
    if (inflight.current || wait > 0) {
      return;
    }
    inflight.current = true;
    setResending(true);
    setError("");
    setCode("");
    try {
      await post("/api/auth/request-code", { email: email.trim() });
      setCode("");
      setResent(true);
      holdResend();
    } catch {
      setError("sendFailed");
    } finally {
      inflight.current = false;
      setResending(false);
      document.getElementById("credential")?.focus();
    }
  }

  const field =
    "h-12 w-full rounded-[14px] border border-line-card bg-white px-4 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-placeholder focus:border-ink focus:shadow-[0_0_0_3px_rgb(0_0_0/6%)] sm:text-[15px]";
  const primary =
    "raised flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium text-white disabled:opacity-50";
  const legal = m.help.legal;
  const legalLink =
    "text-quiet underline decoration-black/20 underline-offset-2 hover:text-ink hover:decoration-ink";

  return (
    <div className="flex min-h-dvh bg-white">
      <input
        ref={keyboard}
        aria-hidden="true"
        tabIndex={-1}
        inputMode="numeric"
        autoComplete="off"
        className="pointer-events-none fixed top-0 left-0 size-px text-[16px] opacity-0"
      />
      <div className="flex min-h-dvh w-full flex-col lg:w-1/2 lg:max-w-[680px] lg:flex-none">
        <header className="flex items-center p-4 md:px-6 md:py-[18px]">
          <Link href="/" className="inline-flex">
            <Logo size={24} />
          </Link>
        </header>
        <main className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-6">
          <div
            className={`mx-auto flex w-full max-w-[380px] flex-col ${stage === "email" ? "gap-8" : "gap-5"}`}
          >
            <div className="rise flex flex-col gap-2.5">
              {stage === "email" && arrival === t.arrivals.connect ? (
                <div className="mb-3">
                  <span className="sr-only">{arrival.kicker}</span>
                  {/* Always the pair, as consent shows it: a sparkle for an assistant we can't name. */}
                  <ConnectPair
                    assistant={
                      assistant ?? { name: "", logoUrl: null, icon: null }
                    }
                  />
                </div>
              ) : stage === "email" && arrival ? (
                <span className="label inline-flex items-center gap-1.5 text-attention-ink">
                  <span className="size-1.5 rounded-full bg-attention" />
                  {arrival.kicker}
                </span>
              ) : null}
              <h1 className="m-0 text-[32px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[40px] sm:tracking-[-0.05em]">
                {stage === "code"
                  ? t.checkEmail
                  : (arrival?.title ?? t.heading)}
              </h1>
              <p
                aria-live="polite"
                className="m-0 text-[16px] text-pretty text-quiet"
              >
                {stage === "code"
                  ? f(resent ? t.codeResent : t.codeSent, {
                      email: email.trim(),
                    })
                  : arrival === t.arrivals.connect && assistant?.name
                    ? f(t.arrivals.connect.ledeNamed, {
                        name: assistant.name,
                      })
                    : (arrival?.lede ?? t.lede)}
              </p>
            </div>
            <div className="rise flex flex-col gap-4 [--rise-delay:80ms]">
              {stage === "email" ? (
                <>
                  <form
                    action="/api/auth/google/start"
                    method="post"
                    onSubmit={rememberNextForGoogle}
                  >
                    <button
                      type="submit"
                      disabled={busy}
                      className="raised-light flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line-card bg-white text-[15px] font-medium text-ink disabled:opacity-50"
                    >
                      <Image
                        src="/google-g.png"
                        alt=""
                        width={200}
                        height={204}
                        className="h-[18px] w-auto"
                        unoptimized
                      />
                      {t.google}
                    </button>
                  </form>
                  <div className="flex items-center gap-3 text-[13px] text-muted">
                    <span className="h-px flex-1 bg-black/[0.07]" />
                    {t.or}
                    <span className="h-px flex-1 bg-black/[0.07]" />
                  </div>
                </>
              ) : null}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
                className="flex flex-col gap-2.5"
              >
                {stage === "email" ? (
                  <>
                    <label htmlFor="credential" className="sr-only">
                      {t.email}
                    </label>
                    <input
                      id="credential"
                      autoFocus={changing}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={field}
                    />
                  </>
                ) : stage === "password" ? (
                  <>
                    <label htmlFor="credential" className="sr-only">
                      {t.email}
                    </label>
                    <input
                      id="credential"
                      autoFocus
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                      }}
                      className={field}
                    />
                    <label htmlFor="password" className="sr-only">
                      {t.password}
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder={t.password}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError("");
                      }}
                      className={field}
                    />
                  </>
                ) : (
                  <CodeInput
                    value={code}
                    label={t.code}
                    onChange={(next) => {
                      setCode(next);
                      setError("");
                      // A full code (typed or pasted) signs in without a click.
                      if (next.length === CODE_LENGTH) {
                        void submit(next);
                      }
                    }}
                  />
                )}
                {/* While it works, the label stays for assistive tech under the spinner. */}
                <button
                  type="submit"
                  disabled={
                    !signedIn &&
                    (busy ||
                      resending ||
                      (stage === "code" && code.length < CODE_LENGTH) ||
                      (stage === "password" && (!email.trim() || !password)))
                  }
                  aria-busy={busy}
                  className={`${primary} ${signedIn ? "mascot-fill" : "bg-ink hover:bg-ink-hover"}`}
                >
                  {busy ? (
                    <span
                      aria-hidden="true"
                      className="spinner border-white/40 border-t-white"
                    />
                  ) : signedIn ? (
                    <Check
                      aria-hidden="true"
                      width={20}
                      height={20}
                      className="check-in"
                    />
                  ) : null}
                  <span className={busy || signedIn ? "sr-only" : undefined}>
                    {stage === "email" ? t.continueEmail : t.signIn}
                  </span>
                </button>
              </form>
              {stage === "email" ? (
                <p className="m-0 text-center text-[13px] text-pretty text-muted">
                  {rich(legal.agree, {
                    terms: (
                      <Link href={LEGAL.terms} className={legalLink}>
                        {legal.agreeTerms}
                      </Link>
                    ),
                    privacy: (
                      <Link href={LEGAL.privacy} className={legalLink}>
                        {legal.agreePrivacy}
                      </Link>
                    ),
                  })}
                </p>
              ) : null}
              {stage === "code" ? (
                <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[13px] whitespace-nowrap text-quiet min-[360px]:text-[14px]">
                  {inbox ? (
                    <>
                      <a
                        href={inbox.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tap relative inline-flex items-center gap-1.5 hover:text-ink"
                      >
                        <Image
                          src={`/mail/${inbox.icon}.png`}
                          alt=""
                          width={16}
                          height={16}
                          unoptimized
                          className="size-4 rounded-[4px] object-contain"
                        />
                        {f(t.openInbox, { provider: inbox.name })}
                      </a>
                      <span aria-hidden="true" className="text-muted">
                        ·
                      </span>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setStage("email");
                      setChanging(true);
                      setCode("");
                      setError("");
                      setResent(false);
                      setResendAt(0);
                    }}
                    disabled={resending}
                    className="tap relative enabled:hover:text-ink"
                  >
                    {t.differentEmail}
                  </button>
                  <button
                    type="button"
                    disabled={busy || resending || signedIn || wait > 0}
                    onClick={() => void resend()}
                    className="tap relative basis-full tabular-nums enabled:hover:text-ink disabled:text-muted"
                  >
                    {wait > 0 ? f(t.resendIn, { seconds: wait }) : t.resend}
                  </button>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="text-center text-[13px] text-danger">
                  {t[error]}
                </p>
              ) : null}
            </div>
          </div>
        </main>
        <footer className="flex justify-center px-4 pt-2 pb-6">
          {arrival ? (
            <p className="m-0 max-w-[380px] text-center text-[13px] text-pretty text-muted">
              {arrival.footer}
            </p>
          ) : (
            <a
              href="https://www.crossmint.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] text-quiet hover:text-ink"
            >
              {rich(hero.eyebrow, {
                crossmint: (
                  <CrossmintLogo
                    role="img"
                    aria-label="Crossmint"
                    aria-hidden={undefined}
                    className="h-[13px] w-auto text-ink"
                  />
                ),
              })}
            </a>
          )}
        </footer>
      </div>
      <Showcase
        stores={stores}
        title={rich(hero.title, {
          accent: <span className="mascot-text">{hero.titleAccent}</span>,
        })}
      />
    </div>
  );
}

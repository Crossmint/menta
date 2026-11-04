"use client";

import { shortTask } from "@oca/agent/task";
import {
  backLink,
  type Host,
  hostFrom,
  limitCheck,
  placedOrder,
  returnLine,
  returnPath,
  stageOf,
  unconfirmed,
} from "@oca/client/secure-page";
import Image from "next/image";
import { use, useEffect, useState } from "react";
import {
  type CheckoutView,
  checkoutAction,
  money,
  stepLine,
  useCheckout,
  useNow,
} from "../../../lib/client/checkouts";
import { disableNotifications } from "../../../lib/client/notifications";
import { useI18n } from "../../../lib/i18n/client";
import { rich } from "../../../lib/i18n/rich";
import { AgentIcon } from "../../_components/agent-icon";
import {
  CheckoutCard,
  describe,
  StatusDot,
} from "../../_components/checkout-card";
import { PaymentForm, RequestStep } from "../../_components/checkout-dock";
import { HostName } from "../../_components/host-name";
import { Check, Clock, Close, Search, Warning } from "../../_components/icons";
import { LiveFrame } from "../../_components/live-view";
import { PoweredByCrossmint } from "../../_components/powered-by";
import {
  Outcome,
  primaryAction,
  Standalone,
} from "../../_components/standalone";
import { MerchantIcon } from "../../(app)/activity/table";

/**
 * Every state of this page is a standalone page (the homepage's header over
 * its hero): `head` sits at the header's end, and `bottom` under the content.
 */
function Shell({
  head,
  size,
  children,
  bottom,
}: {
  head?: React.ReactNode;
  size?: "outcome" | "step" | "wide";
  children: React.ReactNode;
  bottom?: React.ReactNode;
}) {
  return (
    <Standalone aside={head} home="/install" size={size}>
      {children}
      {bottom ? <div className="pt-1">{bottom}</div> : null}
    </Standalone>
  );
}

/**
 * The bottom row's way back: a button to the host's home, or, for a host with
 * no link to open it (Grok Bot), a "Return to …" line with its app icon.
 */
function BackTo({
  back,
  host,
}: {
  back: ReturnType<typeof backLink>;
  host: Host | null;
}) {
  const { m, f } = useI18n();
  if (back) {
    return (
      <a href={back.href} className={primaryAction}>
        {back.label}
      </a>
    );
  }
  if (host) {
    return (
      <p className="flex items-center justify-center gap-2 text-[15px] font-medium text-ink">
        <AgentIcon name={host.name} className="size-4 rounded-[4px]" />
        {f(m.checkout.returnTo, { host: host.name })}
      </p>
    );
  }
  return null;
}

function FromHost({ host }: { host: Host }) {
  const { m, f } = useI18n();
  return (
    <span className="raised-light inline-flex flex-none items-center gap-1.5 rounded-full border border-line bg-white/80 py-1.5 pr-3 pl-2 text-[13px] text-quiet">
      <AgentIcon name={host.name} className="size-3.5 rounded-[4px]" />
      {f(m.checkout.from, { host: host.name })}
    </span>
  );
}

function Who({ email }: { email: string | null }) {
  return email ? (
    <span className="min-w-0 truncate text-[13px] text-quiet">{email}</span>
  ) : null;
}

/** What was asked for, under the step's title, and a quieter line after it. */
function Asked({ view, sub }: { view: CheckoutView; sub?: string }) {
  return (
    <p className="flex flex-col gap-1 text-[16px] text-pretty text-quiet">
      <span className="line-clamp-2 [overflow-wrap:anywhere]">
        {view.task ? shortTask(view.task) : view.store}
      </span>
      {sub ? <span className="text-[13px] text-muted">{sub}</span> : null}
    </p>
  );
}

function Pill({
  tone = "plain",
  children,
}: {
  tone?: "plain" | "within" | "over";
  children: React.ReactNode;
}) {
  const style = {
    plain: "bg-chip text-quiet",
    within: "bg-chip text-leaf",
    over: "bg-attention-soft text-attention-ink",
  }[tone];
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs whitespace-nowrap ${style}`}
    >
      {tone === "plain" ? null : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

/** Email on the left, a quiet cancel on the right that asks once. */
function Quiet({
  email,
  busy,
  onCancel,
}: {
  email: string | null;
  busy: boolean;
  onCancel: () => void;
}) {
  const { m } = useI18n();
  const t = m.checkout.cancel;
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 px-1 text-[13px]">
        <span className="text-quiet">{t.confirm}</span>
        <span className="ml-auto flex flex-none gap-1.5">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="raised-light tap relative h-8 rounded-full border border-line-card bg-white px-3.5 font-medium text-soft hover:text-ink disabled:opacity-50"
          >
            {t.keep}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="raised tap relative flex h-8 items-center gap-1.5 rounded-full bg-ink px-3.5 font-medium text-white hover:bg-ink-hover disabled:opacity-60"
          >
            {busy ? (
              <span className="spinner size-3 border-white/40 border-t-white" />
            ) : null}
            {t.cancel}
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2.5 px-1 text-[13px] text-muted">
      <span className="min-w-0 truncate">{email}</span>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="tap relative flex-none underline decoration-[#d4d4d4] underline-offset-[3px] hover:text-ink disabled:opacity-50"
      >
        {t.ask}
      </button>
    </div>
  );
}

/**
 * Under an outcome: the way back to where you came from, and a quiet line.
 * Opened on its own (no assistant or conversation to go back to), the way on
 * is the dashboard (Home).
 */
function WayOn({
  back,
  host,
  stage = "done",
}: {
  back: ReturnType<typeof backLink>;
  host: Host | null;
  stage?: "done" | "working";
}) {
  const { m, tag } = useI18n();
  // The missing page's "go to your dashboard", as a button's label.
  const transactions = m.checkout.missing.home;
  return (
    <div className="flex flex-col items-center gap-3">
      <BackTo back={back} host={host} />
      {back || host ? null : (
        <a
          href="/home"
          className="raised-light inline-flex h-11 items-center rounded-full border border-line-card bg-white px-5 font-medium text-soft hover:text-ink"
        >
          {transactions.charAt(0).toLocaleUpperCase(tag) +
            transactions.slice(1)}
        </a>
      )}
      <span className="text-center text-[13px] text-muted">
        {returnLine(host, back, stage)}
      </span>
    </div>
  );
}

function Done({
  view,
  kind,
  host,
  from,
  email,
}: {
  view: CheckoutView;
  kind: "payment" | "store";
  host: Host | null;
  from: string | null;
  email: string | null;
}) {
  const { m, f } = useI18n();
  const t = m.checkout.done;
  const back = backLink(host, from);
  const pending = view.pending;
  const who = host?.name ?? t.yourAssistant;
  return (
    <Shell head={host ? <FromHost host={host} /> : <Who email={email} />}>
      <Outcome
        tone="done"
        icon={<Check width={28} height={28} />}
        title={kind === "payment" ? t.approved : t.sent}
        lede={
          host && !host.card
            ? f(t.sayDone, {
                step: kind === "payment" ? t.placing : t.continuing,
                host: who,
              })
            : f(kind === "payment" ? t.placingResult : t.continuingResult, {
                host: who,
              })
        }
      >
        <dl className="panel m-0 grid w-full grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2.5 px-5 py-4 text-left text-[14px]">
          {pending?.kind === "payment" ? (
            <>
              <dt className="text-muted">{t.paidUpTo}</dt>
              <dd className="m-0 font-medium tabular-nums">
                {money(pending.amount)}
              </dd>
            </>
          ) : null}
          <dt className="text-muted">{t.item}</dt>
          <dd className="m-0 line-clamp-2 [overflow-wrap:anywhere]">
            {view.task ? shortTask(view.task) : view.store}
          </dd>
          <dt className="text-muted">{t.store}</dt>
          <dd className="m-0 [overflow-wrap:anywhere]">{view.store}</dd>
        </dl>
        <WayOn back={back} host={host} />
      </Outcome>
    </Shell>
  );
}

/**
 * A checkout still working with nothing for the user yet: Crossmint's
 * read-only live view and the newest step. The ChatGPT and Claude cards send
 * people here ("See live progress on Menta").
 * The page follows the run, so it moves on once the store needs the user or
 * the run ends.
 */
function Watching({
  view,
  head,
  host,
  back,
}: {
  view: CheckoutView;
  head: React.ReactNode;
  host: Host | null;
  back: ReturnType<typeof backLink>;
}) {
  const { m, f } = useI18n();
  const t = m.checkout.watching;
  const now = useNow(15_000);
  const line = stepLine(view, now);
  // Crossmint's embed can sit on "Connecting…"; reconnect a few times, as the chat does.
  const [generation, setGeneration] = useState(0);
  const [retries, setRetries] = useState(0);
  return (
    <Shell
      head={head}
      size="wide"
      bottom={<WayOn back={back} host={host} stage="working" />}
    >
      <div className="flex flex-col gap-2.5">
        <StatusDot {...describe(view)} />
        <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] md:text-[40px] md:tracking-[-0.05em]">
          {t.title}
        </h1>
        <Asked view={view} sub={f(t.upTo, { amount: money(view.maxCost) })} />
        {line ? (
          <p
            title={line.text}
            className="line-clamp-2 text-[13px] text-pretty text-soft"
          >
            <span className={line.running ? "shimmer" : ""}>{line.text}</span>
          </p>
        ) : null}
      </div>
      {/* The hairline on top: the frame fills the card and would cover an inset one. */}
      <div className="panel relative overflow-hidden rounded-[16px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(0_0_0/6%)]">
        <div className="flex h-7 items-center gap-1.5 border-b border-black/[0.05] px-3">
          <span className="size-[7px] rounded-full bg-line-card" />
          <span className="size-[7px] rounded-full bg-line-card" />
          <span className="size-[7px] rounded-full bg-line-card" />
        </div>
        {view.liveViewUrl ? (
          <LiveFrame
            key={generation}
            src={view.liveViewUrl}
            onStalled={() => {
              if (retries < 3 && view.status === "running") {
                window.setTimeout(
                  () => {
                    setRetries((current) => current + 1);
                    setGeneration((current) => current + 1);
                  },
                  2000 * 2 ** retries,
                );
              }
            }}
          />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-well px-8 text-center text-[13px] text-quiet">
            {t.noLiveView}
          </div>
        )}
      </div>
      <span className="-mt-2 px-1 text-[13px] text-muted">{t.watchOnly}</span>
    </Shell>
  );
}

/** The step's kicker, heading and what was asked for: who needs the user, and for what. */
function Intro({
  label,
  icon,
  title,
  children,
}: {
  /** A kicker over the title; or, in its place, `icon` (the store's). */
  label?: string;
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {icon ? (
        <span className="mb-1">{icon}</span>
      ) : label ? (
        <span className="label inline-flex items-center gap-1.5 text-attention-ink [overflow-wrap:anywhere]">
          <span className="size-1.5 flex-none rounded-full bg-attention" />
          {label}
        </span>
      ) : null}
      <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance md:text-[40px] md:tracking-[-0.05em]">
        {title}
      </h1>
      {children}
    </div>
  );
}

/** The page's own outline while the checkout loads, so it doesn't jump when it arrives. */
function PageSkeleton() {
  const { m } = useI18n();
  return (
    <div
      role="status"
      aria-label={m.checkout.loading}
      className="flex animate-pulse flex-col gap-[18px] motion-reduce:animate-none"
    >
      <span className="h-3 w-32 rounded-full bg-chip" />
      <span className="h-10 w-72 max-w-full rounded-full bg-chip" />
      <span className="h-64 rounded-[20px] bg-white ring-1 ring-black/[0.06]" />
    </div>
  );
}

/**
 * The tab says what this page is for right now, not always "Approve payment".
 * Set after Next's own title (which a client navigation writes late).
 */
function useTitle(title: string) {
  useEffect(() => {
    const name = `${title} · Menta`;
    document.title = name;
    const timer = window.setTimeout(() => {
      document.title = name;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [title]);
}

/** Back to sign-in, then here again (with the anchor and query). */
function signInAgain() {
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`/login?next=${encodeURIComponent(here)}`);
}

/** A tipped-over cart in Menta's colours: a request that expired or a checkout that was cancelled. */
const cartArt = (
  <Image
    src="/illustrations/cart.png"
    alt=""
    width={768}
    height={512}
    priority
    className="w-[280px] max-w-full rounded-[24px]"
  />
);

export default function SecureStep({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const { m } = useI18n();
  const [initial, setInitial] = useState<CheckoutView | null>(null);
  const [problem, setProblem] = useState<"missing" | "unavailable" | null>(
    null,
  );
  const [email, setEmail] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [host, setHost] = useState<Host | null>(null);

  useEffect(() => {
    const search = new URL(window.location.href).searchParams;
    setFrom(returnPath(search.get("from")));
    setHost(hostFrom(search.get("via")));
    void fetch("/api/me", { cache: "no-store" }).then(async (response) => {
      if (response.ok) {
        setEmail((await response.json()).email);
      }
    });
    void fetch(`/api/checkouts/${encodeURIComponent(runId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          signInAgain();
          return;
        }
        if (!response.ok) {
          setProblem(
            response.status === 404 || response.status === 403
              ? "missing"
              : "unavailable",
          );
          return;
        }
        setInitial(await response.json());
      })
      .catch(() => setProblem("unavailable"));
  }, [runId]);

  async function switchAccount() {
    await disableNotifications().catch(() => {});
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
    signInAgain();
  }

  const head = host ? <FromHost host={host} /> : <Who email={email} />;

  if (problem === "missing") {
    return (
      <Missing
        email={email}
        head={head}
        onSwitch={() => void switchAccount()}
      />
    );
  }
  if (problem === "unavailable") {
    return (
      <Shell head={head}>
        <Outcome
          tone="attention"
          icon={<Warning width={28} height={28} />}
          title={m.checkout.unavailable.title}
          lede={m.checkout.unavailable.body}
        >
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={primaryAction}
          >
            {m.checkout.unavailable.retry}
          </button>
        </Outcome>
      </Shell>
    );
  }
  if (!initial) {
    return (
      <Shell head={head} size="step">
        <PageSkeleton />
      </Shell>
    );
  }
  return (
    <Checkout
      initial={initial}
      head={head}
      host={host}
      from={from}
      email={email}
    />
  );
}

/** The API answers "not found" both for someone else's checkout and for one that doesn't exist. */
function Missing({
  email,
  head,
  onSwitch,
}: {
  email: string | null;
  head: React.ReactNode;
  onSwitch: () => void;
}) {
  const { m, f } = useI18n();
  const t = m.checkout.missing;
  useTitle(m.checkout.titles.missing);
  return (
    <Shell head={head}>
      <Outcome
        icon={<Search width={26} height={26} />}
        title={t.title}
        lede={
          <>
            {email ? f(t.signedInAs, { email }) : ""}
            {rich(t.body, {
              switch: (
                <button
                  type="button"
                  onClick={onSwitch}
                  className="tap relative"
                >
                  {t.switch}
                </button>
              ),
              home: (
                <a href="/home" className="tap relative">
                  {t.home}
                </a>
              ),
            })}
          </>
        }
      />
    </Shell>
  );
}

/**
 * The loaded checkout, followed live: approving in the chat, a cancel from
 * the assistant or an approval running out all move this page on, so it
 * never offers a step that's already gone.
 */
function Checkout({
  initial,
  head,
  host,
  from,
  email,
}: {
  initial: CheckoutView;
  head: React.ReactNode;
  host: Host | null;
  from: string | null;
  email: string | null;
}) {
  const { m, f } = useI18n();
  const view = useCheckout(initial.runId, initial) ?? initial;
  const now = useNow(15_000);
  const [submitted, setSubmitted] = useState<{
    kind: "payment" | "store";
    requestId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stage = stageOf(view, now);
  // "Approved" or "Sent" stands while the checkout works on that step. A new
  // request from the store, or the end of the checkout, takes over.
  const acknowledged =
    submitted &&
    ["queued", "running", "awaiting_input"].includes(view.status) &&
    (!view.pending || view.pending.requestId === submitted.requestId)
      ? submitted.kind
      : null;
  useTitle(
    acknowledged
      ? acknowledged === "payment"
        ? m.checkout.titles.approved
        : m.checkout.titles.sent
      : m.checkout.titles[stage],
  );

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      await checkoutAction(view.runId, { action: "cancel" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (acknowledged) {
    return (
      <Done
        view={view}
        kind={acknowledged}
        host={host}
        from={from}
        email={email}
      />
    );
  }

  const back = backLink(host, from);
  if (stage === "working") {
    return <Watching view={view} head={head} host={host} back={back} />;
  }
  if (stage === "done" || stage === "stopped") {
    const notConfirmed = unconfirmed(view);
    const t = m.checkout.ended;
    const who = host?.name ?? t.yourAssistant;
    return (
      <Shell head={head} size="step">
        <Outcome
          tone={stage === "done" ? "done" : "plain"}
          icon={
            stage === "done" ? (
              <Check width={28} height={28} />
            ) : notConfirmed ? (
              <Clock width={26} height={26} />
            ) : (
              <Close width={26} height={26} />
            )
          }
          title={
            stage === "done"
              ? placedOrder(view)
                ? t.placed
                : t.finished
              : notConfirmed
                ? t.unconfirmed
                : t.stopped
          }
          lede={
            stage === "done"
              ? t.doneNote
              : notConfirmed
                ? t.unconfirmedNote
                : f(t.stoppedNote, { host: who })
          }
        >
          {/* The same card the chat shows: receipt, or why it stopped. */}
          <div className="w-full text-left">
            <CheckoutCard runId={view.runId} initial={view} />
          </div>
          <WayOn back={back} host={host} />
        </Outcome>
      </Shell>
    );
  }
  if (stage === "expired") {
    return (
      <Shell head={head}>
        <Outcome
          // The request ran out of time, nothing more.
          art={cartArt}
          // An expired request is often cleared already: only a payment we can still see says "approval".
          title={
            view.pending?.kind === "payment"
              ? m.checkout.expired.approval
              : m.checkout.expired.request
          }
          lede={m.checkout.expired.body}
        >
          <WayOn back={back} host={host} />
        </Outcome>
      </Shell>
    );
  }
  if (stage === "cancelled") {
    return (
      <Shell head={head}>
        <Outcome
          art={cartArt}
          title={m.checkout.cancelled.title}
          lede={m.checkout.cancelled.body}
        >
          <WayOn back={back} host={host} />
        </Outcome>
      </Shell>
    );
  }

  const pending = view.pending;
  if (!pending) {
    return null;
  }
  const bottom = <Quiet email={email} busy={busy} onCancel={cancel} />;
  const action = host ? <FromHost host={host} /> : null;
  const failed = error ? (
    <p
      role="alert"
      className="text-[13px] text-danger [overflow-wrap:anywhere]"
    >
      {error}
    </p>
  ) : null;

  if (pending.kind === "payment") {
    const limit = limitCheck(pending.amount, view.maxCost);
    return (
      <Shell head={action} size="step" bottom={bottom}>
        <Intro
          label={f(m.checkout.payment.needsYou, { store: view.store })}
          title={m.checkout.payment.title}
        >
          <Asked view={view} />
        </Intro>
        <div className="panel flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={limit.tone}>
              {limit.over
                ? f(m.checkout.payment.over, {
                    limit: money(view.maxCost),
                    over: money(limit.over),
                  })
                : f(
                    limit.tone === "within"
                      ? m.checkout.payment.within
                      : m.checkout.payment.limit,
                    { limit: money(view.maxCost) },
                  )}
            </Pill>
          </div>
          {/* The chat dock's own payment step: saved cards, Approve and Crossmint's checks. */}
          <section aria-label={m.checkout.payment.section} className="min-w-0">
            <PaymentForm
              key={pending.requestId}
              page
              view={view}
              pending={pending}
              sent={false}
              onSent={() =>
                setSubmitted({ kind: "payment", requestId: pending.requestId })
              }
            />
          </section>
          {failed}
        </div>
      </Shell>
    );
  }

  return (
    <Shell head={action} size="step" bottom={bottom}>
      {/* Who's asking is the store's own icon; what was bought and the limit belong to the payment, not here. */}
      <Intro
        icon={
          <>
            <MerchantIcon
              site={view.store}
              className="size-12 rounded-[14px] text-[18px]"
            />
            {/* The icon is decorative; screen readers still hear who's asking, where the title doesn't say. */}
            {pending.kind === "protected" ? (
              <span className="sr-only">{view.store}</span>
            ) : null}
          </>
        }
        title={
          pending.kind === "protected"
            ? f(m.checkout.store.private, { store: view.store })
            : f(m.checkout.store.question, { store: view.store })
        }
      />
      <div className="panel flex flex-col gap-4 p-4 sm:p-5">
        {/* The chat dock's own form: choices, yes/no and Crossmint's protected inputs. */}
        <section aria-label={m.checkout.store.section} className="min-w-0">
          <RequestStep
            key={pending.requestId}
            page
            secretNote={
              host
                ? rich(m.checkout.store.secretNoteNamed, {
                    store: view.store,
                    host: <HostName host={host} />,
                  })
                : undefined
            }
            view={view}
            pending={pending}
            sent={undefined}
            onSent={() =>
              setSubmitted({ kind: "store", requestId: pending.requestId })
            }
          />
        </section>
        {failed}
      </div>
      {pending.kind === "protected" ? <PoweredByCrossmint /> : null}
    </Shell>
  );
}

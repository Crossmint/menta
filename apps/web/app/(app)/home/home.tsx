"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { SavedAddress } from "../../../lib/buyer-details";
import { useAccount } from "../../../lib/client/account";
import {
  type Connection,
  loadConnections,
} from "../../../lib/client/connections";
import { useI18n } from "../../../lib/i18n/client";
import { helpPath } from "../../../lib/i18n/locales";
import { LEGAL } from "../../../lib/site";
import { AddressForm } from "../../_components/address-steps";
import { AgentIcon } from "../../_components/agent-icon";
import {
  Bag,
  Brand,
  Bubble,
  Card as CardIcon,
  Check,
  Chevron,
  Gauge,
  Gear,
  House,
  Plug,
  Receipt,
  Store,
  Wallet,
} from "../../_components/icons";
import { Modal, ModalHeader } from "../../_components/modal";
import { loadPage, type Purchase } from "../activity/feed";
import { MerchantIcon, useFormat } from "../activity/table";
import { ChooseAgent } from "../connect-agent";
import { ListGroup, ListRow, ProfileHeader } from "../list";
import { PageShell } from "../page-shell";
import { NewApproval } from "../wallet/new-approval";

// Crossmint's components load once Home knows a card is still to add (see `preload`).
const loadCrossmint = () => import("../../_components/crossmint");
const NewCard = dynamic(() => loadCrossmint().then((m) => m.NewCard), {
  ssr: false,
  loading: () => null,
});

/** What a new spending limit can be in, and what it starts in. */
interface LimitCurrencies {
  readonly currencies: readonly string[];
  readonly currency: string;
}

/** The sidebar's breakpoint (`md`): below it, phones get the menu instead. */
const WIDE = "(min-width: 48rem)";

function useWide() {
  return useSyncExternalStore(
    (change) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", change);
      return () => query.removeEventListener("change", change);
    },
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
}

/**
 * Home: on phones the app's menu (who you are, each section, help), and from
 * `md` up, where the sidebar is the menu, the overview.
 */
/** A store from the visitor's market: the welcome's floating icons. */
export interface LocalStore {
  readonly name: string;
  readonly logo: string;
}

export function Home({
  serverUrl,
  stores,
  ...limit
}: {
  serverUrl: string;
  stores: readonly LocalStore[];
} & LimitCurrencies) {
  const wide = useWide();
  if (wide === null) {
    // Before the screen is known: the menu, which phones keep and wide screens never show.
    return (
      <div className="md:hidden">
        <Menu />
      </div>
    );
  }
  return wide ? (
    <Overview serverUrl={serverUrl} stores={stores} {...limit} />
  ) : (
    <Menu />
  );
}

const icon = { width: 20, height: 20 };

/** Phones' Home: the user, a row for each section, and help at the foot. */
function Menu() {
  const { m, locale } = useI18n();
  const nav = m.app.nav;
  return (
    <main className="flex min-h-dvh flex-col px-4 pt-4 pb-8 animate-[fade-in_200ms_ease-out] motion-reduce:animate-none">
      <div className="px-1">
        <Brand href="/home" />
      </div>
      <div className="pt-8 pb-6">
        <ProfileHeader />
      </div>
      <nav aria-label={nav.label}>
        <ListGroup>
          <ListRow
            icon={<House {...icon} />}
            label={nav.home}
            href="/home/overview"
          />
          <ListRow
            icon={<Receipt {...icon} />}
            label={nav.transactions}
            href="/activity"
          />
          <ListRow
            icon={<Wallet {...icon} />}
            label={nav.wallet}
            href="/wallet"
          />
          <ListRow
            icon={<Gauge {...icon} />}
            label={nav.limits}
            href="/spending-limits"
          />
          <ListRow icon={<Bubble {...icon} />} label={nav.chat} href="/chat" />
          <ListRow
            icon={<Gear {...icon} />}
            label={nav.settings}
            href="/settings"
          />
        </ListGroup>
      </nav>
      <footer className="mt-auto flex flex-col items-center gap-4 pt-12">
        <a
          href={helpPath(locale)}
          target="_blank"
          rel="noreferrer"
          className="raised-light inline-flex h-12 items-center rounded-full border border-line-card bg-white px-8 text-[15px] font-medium text-ink"
        >
          {nav.help}
        </a>
        <div className="flex gap-5 text-[14px] text-quiet">
          <a
            href={LEGAL.terms}
            target="_blank"
            rel="noreferrer"
            className="tap relative hover:text-ink"
          >
            {nav.terms}
          </a>
          <a
            href={LEGAL.privacy}
            target="_blank"
            rel="noreferrer"
            className="tap relative hover:text-ink"
          >
            {nav.privacy}
          </a>
        </div>
      </footer>
    </main>
  );
}

/** Faded purchase rows: what Recent activity will hold. */
function GhostRows({ stores }: { stores: readonly LocalStore[] }) {
  const bar = "h-2.5 rounded-full bg-black/[0.06]";
  return (
    <div
      aria-hidden="true"
      className="divide-y divide-black/[0.04] [mask-image:linear-gradient(to_bottom,#000_25%,rgb(0_0_0/15%))]"
    >
      {/* The visitor's own stores (their market's, as on the homepage), faded. */}
      {stores.slice(0, 3).map((store, index) => (
        <div key={store.logo} className="flex min-h-14 items-center gap-3 px-5">
          <Image
            src={store.logo}
            alt=""
            width={28}
            height={28}
            unoptimized
            className="size-7 flex-none rounded-[8px] bg-white object-contain opacity-60 ring-1 ring-black/[0.06] grayscale-[35%]"
          />
          <span className={`${bar} ${["w-28", "w-20", "w-24"][index % 3]}`} />
          <span className={`${bar} ml-auto w-12`} />
        </div>
      ))}
    </div>
  );
}

/** A loading Home card: its title, then rows like Recent activity's (icon, name, amount). */
function CardSkeleton({ rows }: { rows: number }) {
  const pulse = "animate-pulse rounded-full bg-chip";
  return (
    <div aria-hidden="true" className="panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className={`${pulse} h-4 w-32`} />
        <span className={`${pulse} h-3 w-12`} />
      </div>
      <div className="divide-y divide-black/[0.05] pb-1.5">
        {["w-28", "w-20", "w-24", "w-32"].slice(0, rows).map((width) => (
          <div
            key={width}
            className="flex min-h-14 items-center gap-3 px-5 py-2.5"
          >
            <span className="size-7 flex-none animate-pulse rounded-[8px] bg-chip" />
            <span className={`${pulse} h-3.5 ${width}`} />
            <span className={`${pulse} ml-auto h-3.5 w-14`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A card on Home: a title, an optional link to the full page, then its rows. */
function Card({
  id,
  title,
  link,
  aside,
  children,
}: {
  id: string;
  title: string;
  link?: { href: string; label: string };
  /** Quiet text at the right of the title (the setup steps' progress). */
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="panel flex flex-col overflow-hidden"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2
          id={`${id}-title`}
          className="m-0 text-[17px] font-semibold tracking-[-0.02em]"
        >
          {title}
        </h2>
        {aside ? (
          <span className="text-[13px] text-quiet tabular-nums">{aside}</span>
        ) : null}
        {link ? (
          <Link
            href={link.href}
            className="tap relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-soft transition-colors hover:bg-black/[0.04] hover:text-ink"
          >
            {link.label}
            <Chevron width={13} height={13} />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

interface SetupStepProps {
  readonly id: string;
  readonly icon: React.ReactNode;
  readonly title: string;
  /** A line under the title, for the one step that needs it (connecting an agent). */
  readonly note?: string;
  readonly done: boolean;
  /** Not yet: an earlier step comes first. */
  readonly disabled?: boolean;
  readonly href?: string;
  readonly onClick?: () => void;
  /** Done right in the step (connecting an agent's button), under its note. */
  readonly action?: React.ReactNode;
  /** The one to do next: its ring turns. */
  readonly current?: boolean;
}

/** One setup step: its icon, what to do, and a ring that becomes a check once it's done. */
function SetupStep({
  icon,
  title,
  note,
  done,
  disabled = false,
  href,
  onClick,
  action,
  current = false,
}: SetupStepProps) {
  const body = (
    <>
      <span className="well inline-flex size-12 flex-none items-center justify-center rounded-[14px] text-ink">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={`font-medium text-[15px] ${done ? "text-quiet line-through decoration-black/20" : ""}`}
        >
          {title}
        </span>
        {note ? (
          <span className="text-[13px] text-pretty text-quiet">{note}</span>
        ) : null}
        {action && !done ? <span className="mt-2.5 flex">{action}</span> : null}
      </span>
      {done ? (
        // The landing's Menta green, the leaf's gradient.
        <span className="mascot-fill inline-flex size-6 flex-none items-center justify-center rounded-full text-white">
          <Check width={14} height={14} strokeWidth={2.5} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={`size-6 flex-none rounded-full border-[1.5px] border-dashed border-black/25 ${current ? "motion-safe:animate-[spin_8s_linear_infinite]" : ""}`}
        />
      )}
    </>
  );
  const row =
    "flex w-full items-center gap-4 px-5 py-3 text-left transition-colors";
  if (done || disabled || action) {
    return (
      <div
        className={`${row} ${action && !done ? "items-start" : ""} ${disabled ? "opacity-50" : ""}`}
      >
        {body}
      </div>
    );
  }
  return href ? (
    <Link href={href} className={`${row} hover:bg-black/[0.02]`}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      className={`${row} hover:bg-black/[0.02]`}
    >
      {body}
    </button>
  );
}

/** Where the welcome's stores float: corners on phones, two more beside the words from `sm` up. */
const FLOATING = [
  { at: "left-[6%] top-[12%]", tilt: -12, size: "size-12" },
  { at: "right-[7%] top-[9%]", tilt: 14, size: "size-14" },
  { at: "left-[3%] top-[52%] hidden sm:block", tilt: 8, size: "size-11" },
  { at: "right-[4%] top-[50%] hidden sm:block", tilt: -9, size: "size-12" },
  { at: "left-[12%] bottom-[8%]", tilt: 16, size: "size-11" },
  { at: "right-[13%] bottom-[10%]", tilt: -18, size: "size-12" },
] as const;

/**
 * The first visit's welcome: the greeting on the leaf's soft gradient, with
 * the visitor's own stores (their market's, as on the homepage) bobbing
 * around it. Still with reduced motion.
 */
function Welcome({
  title,
  lede,
  stores,
}: {
  title: string;
  lede: string;
  stores: readonly LocalStore[];
}) {
  return (
    <section className="relative isolate -mx-4 overflow-hidden px-6 py-20 text-center sm:mx-0 sm:rounded-[28px] sm:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_0%,rgb(16_180_94/22%),transparent_70%),radial-gradient(50%_50%_at_85%_100%,rgb(16_180_94/12%),transparent_70%),linear-gradient(180deg,#f3faf6,#f7f7f6)]"
      />
      {stores.slice(0, FLOATING.length).map((store, index) => {
        const place = FLOATING[index];
        return place ? (
          <span
            key={store.logo}
            aria-hidden="true"
            className={`absolute ${place.at}`}
            style={{ rotate: `${place.tilt}deg` }}
          >
            <span
              className="float block"
              style={
                {
                  "--float-duration": `${5 + (index % 3)}s`,
                  "--float-delay": `${-index * 0.9}s`,
                } as React.CSSProperties
              }
            >
              <Image
                src={store.logo}
                alt=""
                width={56}
                height={56}
                unoptimized
                className={`${place.size} rounded-[14px] bg-white object-contain shadow-[0_10px_24px_-10px_rgb(0_0_0/30%)] ring-1 ring-black/[0.06]`}
              />
            </span>
          </span>
        ) : null;
      })}
      <div className="relative mx-auto flex max-w-[440px] flex-col items-center gap-3">
        <h2 className="m-0 text-[32px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[40px]">
          {title}
        </h2>
        <p className="m-0 text-[15px] text-pretty text-quiet">{lede}</p>
      </div>
    </section>
  );
}

/**
 * The overview. With no purchase and no agent yet: a welcome, and connecting
 * an agent as the first step. Once there is either: the latest purchases,
 * the connected agents and, until there's one, adding a delivery address.
 */
export function Overview({
  serverUrl,
  stores,
  currencies,
  currency,
}: {
  serverUrl: string;
  stores: readonly LocalStore[];
} & LimitCurrencies) {
  const { m, f } = useI18n();
  const t = m.app.home;
  const { me } = useAccount();
  const { money } = useFormat();
  /** Undefined while loading, null when it failed. */
  const [runs, setRuns] = useState<readonly Purchase[] | null>();
  const [agents, setAgents] = useState<Connection[] | null>();
  const [addresses, setAddresses] = useState<SavedAddress[] | null>();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Saved cards and spending limits, for the setup steps; null when unknown. */
  const [cards, setCards] = useState<number | null>();
  const [limits, setLimits] = useState<number | null>();
  /** The setup step whose modal is open: adding a card or making a spending limit. */
  const [opened, setOpened] = useState<"card" | "limit" | null>(null);
  const [loadLimits, setLoadLimits] = useState(0);

  useEffect(() => {
    void loadPage(null)
      .then((page) => setRuns(page.runs.slice(0, 4)))
      .catch(() => setRuns(null));
    void loadConnections().then(setAgents);
    void fetch("/api/addresses", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { addresses: SavedAddress[] } | null) =>
        setAddresses(body?.addresses ?? null),
      )
      .catch(() => setAddresses(null));
    void fetch("/api/crossmint/cards", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { cards?: unknown[] | null } | null) =>
        setCards(body?.cards?.length ?? null),
      )
      .catch(() => setCards(null));
  }, []);
  // With no card yet, fetch the add-card modal's code now, so it opens on the click.
  useEffect(() => {
    if (cards === 0) {
      void loadCrossmint();
    }
  }, [cards]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `loadLimits` asks for a fresh count
  useEffect(() => {
    // Only the latest count lands: an older, slower answer would undo a limit just made.
    let stopped = false;
    const set = (count: number | null) => {
      if (!stopped) {
        setLimits(count);
      }
    };
    void fetch("/api/crossmint/order-intents", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { orderIntents?: unknown[] } | null) =>
        set(body?.orderIntents?.length ?? null),
      )
      .catch(() => set(null));
    return () => {
      stopped = true;
    };
  }, [loadLimits]);

  const loading = runs === undefined || agents === undefined;
  /** What's left to set up, in order; a step shows once what it needs is known. */
  const steps: SetupStepProps[] = [
    ...(agents
      ? [
          {
            id: "agent",
            icon: <Plug width={22} height={22} />,
            title: t.connectAgent,
            note: t.connectAgentNote,
            done: agents.length > 0,
            action: <ChooseAgent serverUrl={serverUrl} />,
          },
        ]
      : []),
    ...(addresses
      ? [
          {
            id: "address",
            icon: <Store width={22} height={22} />,
            title: t.addAddress,
            done: addresses.length > 0,
            onClick: () => setAdding(true),
          },
        ]
      : []),
    ...(typeof cards === "number"
      ? [
          {
            id: "card",
            icon: <CardIcon width={22} height={22} strokeWidth={1.75} />,
            title: t.addCard,
            done: cards > 0,
            onClick: () => setOpened("card"),
          },
        ]
      : []),
    ...(typeof cards === "number" && typeof limits === "number"
      ? [
          {
            id: "limit",
            icon: <Wallet width={22} height={22} />,
            title: t.addLimit,
            done: limits > 0,
            // A spending limit needs a card first.
            disabled: cards === 0,
            onClick: () => setOpened("limit"),
          },
        ]
      : []),
    ...(runs
      ? [
          {
            id: "purchase",
            icon: <Bag width={22} height={22} />,
            title: t.firstPurchase,
            done: runs.length > 0,
            // Tried here, in the web chat, or by asking a connected agent.
            href: "/chat",
          },
        ]
      : []),
  ];
  const first = me?.name?.trim().split(/\s+/)[0];
  // Only a known empty: a list that failed to load shows its card's error instead.
  const starting = runs?.length === 0 && agents?.length === 0;

  const addressModal = (
    <Modal
      labelledBy="home-address-title"
      busy={saving}
      onClose={() => setAdding(false)}
    >
      {(close) => (
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <ModalHeader
            id="home-address-title"
            title={m.settings.addresses.add}
            close={close}
          />
          <AddressForm
            address={null}
            contact={{ email: me?.email ?? null, phone: null }}
            hasDefault={false}
            onBusy={setSaving}
            onSaved={(saved) => {
              setAddresses(saved.addresses);
              setAdding(false);
            }}
            onCancel={close}
          />
        </div>
      )}
    </Modal>
  );

  const setupModal =
    opened === "card" ? (
      <NewCard
        onAdded={() => {
          setCards((current) => (current ?? 0) + 1);
          setOpened(null);
        }}
        onClose={() => setOpened(null)}
      />
    ) : opened === "limit" ? (
      <NewApproval
        currencies={currencies}
        currency={currency}
        // Closed mid-approval, Crossmint may still have made it: count again either way.
        onClose={() => {
          setOpened(null);
          setLoadLimits((current) => current + 1);
        }}
        onMade={() => {
          setOpened(null);
          setLoadLimits((current) => current + 1);
        }}
      />
    ) : null;

  /** The first step left that can be done now. */
  const next = steps.find((step) => !step.done && !step.disabled)?.id;
  const done = steps.filter((step) => step.done).length;
  // Counted once every step's data has answered, so the total doesn't jump.
  const counted =
    addresses !== undefined && cards !== undefined && limits !== undefined;
  const stepsCard = (
    <Card
      id="finish"
      title={t.finish}
      aside={counted ? f(t.progress, { done, total: steps.length }) : undefined}
    >
      <ol className="m-0 flex list-none flex-col p-0 pb-2">
        {steps.map((step) => (
          <li key={step.id}>
            <SetupStep {...step} current={step.id === next} />
          </li>
        ))}
      </ol>
    </Card>
  );

  if (starting) {
    return (
      <PageShell title={t.title} titleHidden>
        <Welcome
          title={first ? f(t.welcome, { name: first }) : t.welcomeNoName}
          lede={t.welcomeLede}
          stores={stores}
        />
        {stepsCard}
        {adding ? addressModal : null}
        {setupModal}
      </PageShell>
    );
  }

  return (
    <PageShell title={t.title}>
      {loading ? (
        <div role="status" className="flex flex-col gap-9 max-md:gap-7">
          <span className="sr-only">{m.settings.loading}</span>
          <CardSkeleton rows={4} />
          <CardSkeleton rows={2} />
        </div>
      ) : (
        <>
          <Card
            id="recent"
            title={t.recent}
            link={
              runs?.length ? { href: "/activity", label: t.seeAll } : undefined
            }
          >
            {/* Four purchases' height, however many there are, so Home doesn't jump. */}
            <div className="min-h-[230px]">
              {runs === null ? (
                <p className="m-0 px-5 pb-5 text-[13px] text-quiet">
                  {t.recentFailed}
                </p>
              ) : runs.length === 0 ? (
                // Like the empty Activity table: faded rows, the line over them.
                <div className="pb-6">
                  <GhostRows stores={stores} />
                  <p className="relative -mt-10 m-0 bg-[radial-gradient(ellipse_65%_75%_at_50%_45%,#fff_55%,rgb(255_255_255/0))] px-6 pt-3 pb-1 text-center text-[15px] text-pretty text-quiet">
                    {t.recentEmpty}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.05] pb-1.5">
                  {runs.map((run) => {
                    const total = run.result?.receipt?.total;
                    return (
                      <Link
                        key={run.runId}
                        href="/activity"
                        className="flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-black/[0.03]"
                      >
                        <MerchantIcon site={run.store} />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {run.store}
                        </span>
                        <span className="flex-none font-medium tabular-nums">
                          {total ? money(total.amount, total.currency) : "—"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
          {/* With none, the setup steps connect one. */}
          {agents === null || agents.length > 0 ? (
            <Card
              id="agents"
              title={t.agents}
              link={
                agents?.length
                  ? { href: "/settings/agents", label: t.manage }
                  : undefined
              }
            >
              {agents === null ? (
                <p className="m-0 px-5 pb-5 text-[13px] text-quiet">
                  {t.agentsFailed}
                </p>
              ) : (
                <div className="divide-y divide-black/[0.05] pb-1.5">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex min-h-14 items-center gap-3.5 px-5 py-2.5"
                    >
                      <AgentIcon name={agent.name} logoUrl={agent.logoUrl} />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {agent.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}
          {steps.some((step) => !step.done) ? stepsCard : null}
        </>
      )}
      {adding ? addressModal : null}
      {setupModal}
    </PageShell>
  );
}

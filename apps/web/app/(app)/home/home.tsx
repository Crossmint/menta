"use client";

import type { SavedCard } from "@oca/agent/approval";
import { cardBrandArt, cardLabel } from "@oca/agent/card-brands";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SavedAddress } from "../../../lib/buyer-details";
import { useAccount } from "../../../lib/client/account";
import {
  type Connection,
  loadConnections,
} from "../../../lib/client/connections";
import { useI18n } from "../../../lib/i18n/client";
import { helpPath } from "../../../lib/i18n/locales";
import { rich } from "../../../lib/i18n/rich";
import { LEGAL } from "../../../lib/site";
import { AddressForm } from "../../_components/address-steps";
import { AgentIcon } from "../../_components/agent-icon";
import {
  Brand,
  Bubble,
  Card as CardIcon,
  Check,
  Chevron,
  Copy,
  Gauge,
  Gear,
  House,
  Plus,
  Receipt,
  Store,
  Wallet,
} from "../../_components/icons";
import { InfoTip } from "../../_components/info-tip";
import { Modal, ModalHeader } from "../../_components/modal";
import { currencyFor } from "../../(home)/currency";
import { loadPage, type Purchase } from "../activity/feed";
import { MerchantIcon, useFormat } from "../activity/table";
import { ChooseAgent } from "../connect-agent";
import { ListGroup, ListRow, ProfileHeader } from "../list";
import { PageShell } from "../page-shell";
import { NewApproval } from "../wallet/new-approval";
import {
  type Approval,
  ApprovalIcon,
  store as limitStore,
  ordered,
  shown,
} from "../wallet/wallet";
import type { Idea, LocalStore } from "./market";

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
export function Home({
  serverUrl,
  stores,
  ideas,
  ...limit
}: {
  serverUrl: string;
  stores: readonly LocalStore[];
  ideas: readonly Idea[];
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
    <Overview serverUrl={serverUrl} stores={stores} ideas={ideas} {...limit} />
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
      {stores.slice(0, 4).map((store, index) => (
        <div key={store.logo} className="flex min-h-14 items-center gap-3 px-5">
          <Image
            src={store.logo}
            alt=""
            width={28}
            height={28}
            unoptimized
            className="size-7 flex-none rounded-[8px] bg-white object-contain opacity-60 ring-1 ring-black/[0.06] grayscale-[35%]"
          />
          <span
            className={`${bar} ${["w-28", "w-20", "w-32", "w-24"][index % 4]}`}
          />
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
      <div className="divide-y divide-black/[0.05]">
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
  className = "",
  title,
  help,
  link,
  children,
}: {
  id: string;
  /** Its place in Home's grid (`lg:col-span-2`). */
  className?: string;
  title: string;
  /** A "?" beside the title that explains the card. */
  help?: { label: string; text: string };
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`panel flex flex-col overflow-hidden ${className}`}
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <h2
            id={`${id}-title`}
            className="m-0 text-[17px] font-semibold tracking-[-0.02em]"
          >
            {title}
          </h2>
          {help ? <InfoTip label={help.label} text={help.text} /> : null}
        </span>
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

/**
 * Where a banner's floating things sit: corners below `lg`, two more beside
 * the words from `lg` up. Corners first, so fewer than six still fill them.
 */
const FLOATING = [
  // Below `lg` (phones, tablets) the corners sit smaller in the bands above and below the words.
  { at: "left-[3%] top-0 lg:left-[6%] lg:top-[12%]", tilt: -12, scale: 1 },
  { at: "right-[3%] top-0 lg:right-[7%] lg:top-[9%]", tilt: 14, scale: 1.15 },
  { at: "left-[12%] bottom-2 lg:bottom-[8%]", tilt: 16, scale: 0.92 },
  { at: "right-[13%] bottom-2 lg:bottom-[10%]", tilt: -18, scale: 1 },
  { at: "left-[3%] top-[52%] hidden lg:block", tilt: 8, scale: 0.92 },
  { at: "right-[4%] top-[50%] hidden lg:block", tilt: -9, scale: 1 },
] as const;

/** A raised white tile, as the floating stores are. */
const floatTile =
  "bg-white shadow-[0_10px_24px_-10px_rgb(0_0_0/30%)] ring-1 ring-black/[0.06]";

/** Stores, as the homepage's: the agent step's. */
function StoreTiles(stores: readonly LocalStore[]) {
  return stores.map((store) => (
    <Image
      key={store.logo}
      src={store.logo}
      alt=""
      width={56}
      height={56}
      unoptimized
      className={`size-12 rounded-[14px] object-contain ${floatTile}`}
    />
  ));
}

/** Card brands, as cards: the save-a-card step's. */
const BRANDS = ["visa", "mastercard", "amex", "discover", "jcb", "diners-club"];
function CardTiles() {
  return BRANDS.map((brand) => (
    <svg
      key={brand}
      aria-hidden="true"
      viewBox="0 0 34 22"
      width="68"
      height="44"
      className="block rounded-[8px] shadow-[0_10px_24px_-10px_rgb(0_0_0/30%)]"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: our own static brand art (card-brands.ts)
      dangerouslySetInnerHTML={{ __html: cardBrandArt(brand) }}
    />
  ));
}

/** Spending limits at the visitor's stores, as chips: the spending limit step's. */
function LimitTiles(
  stores: readonly LocalStore[],
  amount: (value: number) => string,
) {
  return stores.map((store, index) => (
    <span
      key={store.logo}
      className={`flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-[14px] font-semibold tabular-nums ${floatTile}`}
    >
      <Image
        src={store.logo}
        alt=""
        width={24}
        height={24}
        unoptimized
        className="size-6 rounded-full object-contain ring-1 ring-black/5"
      />
      {amount([50, 100, 25, 200, 75, 150][index % 6] ?? 50)}
    </span>
  ));
}

/** A pin in the leaf's green: the address step's. */
function Pin() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 40"
      width="34"
      height="42"
      className="block drop-shadow-[0_8px_10px_rgb(0_0_0/18%)]"
    >
      <path
        d="M16 1C8 1 2 7 2 14.6 2 25 16 39 16 39s14-14 14-24.4C30 7 24 1 16 1Z"
        fill="#10b45e"
      />
      <circle cx="16" cy="14.5" r="5.5" fill="#fff" />
    </svg>
  );
}

/** Quiet streets behind the address step, fading out behind the words. */
function MapStreets() {
  const main = [
    "M-20 70 C160 40 260 120 420 90 S700 30 820 60",
    "M-20 210 C140 240 300 170 470 205 S690 250 820 220",
    "M150 -20 C130 90 190 180 160 300",
    "M620 -20 C650 80 590 190 640 300",
  ];
  const side = [
    "M-20 140 H820",
    "M300 -20 V300",
    "M500 -20 V300",
    "M60 -20 L250 300",
    "M740 -20 L560 300",
  ];
  // Each street twice: a green edge under its white, as on a map.
  const draw = (paths: string[], width: number) => (
    <>
      <g stroke="rgb(16 180 94 / 16%)" strokeWidth={width + 3}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke="#fff" strokeWidth={width}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </>
  );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 280"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 -z-10 size-full [mask-image:radial-gradient(ellipse_40%_46%_at_50%_50%,transparent_40%,#000_100%)]"
      fill="none"
      strokeLinecap="round"
    >
      {draw(side, 5)}
      {draw(main, 12)}
    </svg>
  );
}

/**
 * Home's banner: a heading and a line on the leaf's soft gradient, then what
 * to do. `floating` things bob around it (stores, cards, limits, pins), still
 * with reduced motion, over an optional `backdrop`. Without a title it holds
 * the banner's place while Home loads.
 */
function Banner({
  title,
  lede,
  floating = [],
  backdrop,
  ledeBelowLg = true,
  children,
}: {
  title?: string;
  lede?: string;
  /** False: below `lg` the line gives way (the ideas' two rows need the room). */
  ledeBelowLg?: boolean;
  floating?: readonly React.ReactNode[];
  backdrop?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={title ? "banner-title" : undefined}
      aria-hidden={title ? undefined : true}
      // One fixed, short height for every step at every size, so Home's top never jumps or fills the screen.
      className="relative isolate -mx-4 flex h-[240px] flex-col justify-center overflow-hidden px-6 text-center sm:mx-0 sm:rounded-[28px] sm:px-10 lg:h-[264px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(70%_80%_at_50%_0%,rgb(16_180_94/18%),transparent_70%),radial-gradient(45%_60%_at_90%_100%,rgb(16_180_94/10%),transparent_70%),linear-gradient(180deg,#f3faf6,#f7f7f6)]"
      />
      {backdrop}
      {floating.slice(0, FLOATING.length).map((item, index) => {
        const place = FLOATING[index];
        return place ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed places, one item each
            key={index}
            aria-hidden="true"
            className={`absolute ${place.at}`}
            style={{ rotate: `${place.tilt}deg`, scale: place.scale }}
          >
            <span
              className="float block max-lg:[scale:0.7]"
              style={
                {
                  "--float-duration": `${5 + (index % 3)}s`,
                  "--float-delay": `${-index * 0.9}s`,
                } as React.CSSProperties
              }
            >
              {item}
            </span>
          </span>
        ) : null;
      })}
      {title ? (
        <div className="relative mx-auto flex max-w-[520px] flex-col items-center gap-2">
          <h2
            id="banner-title"
            className="m-0 text-[26px] leading-[1.1] font-semibold tracking-[-0.04em] text-balance lg:text-[32px]"
          >
            {title}
          </h2>
          {lede ? (
            <p
              className={`m-0 text-[15px] text-pretty text-quiet max-lg:text-[14px] ${ledeBelowLg ? "" : "max-lg:hidden"}`}
            >
              {lede}
            </p>
          ) : null}
        </div>
      ) : null}
      {children ? (
        <div className="relative mt-5 flex flex-col items-center gap-3 sm:mt-6 sm:gap-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** The banner's one action: the app's main button (dark, raised). */
function MainAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      className="raised tap relative inline-flex h-12 items-center gap-2.5 rounded-full bg-ink px-6 text-[15px] font-medium text-white transition-colors hover:bg-ink-hover"
    >
      {icon}
      {label}
    </button>
  );
}

/** The ideas' copy confirmation stays this long. */
const COPIED_FOR = 1600;

/**
 * The homepage's asks at the visitor's stores, as ideas for their agent: two
 * rows sliding sideways forever, the second the other way (the homepage's
 * drift), edge to edge, pausing under the pointer and stopping for keyboard
 * focus. Without motion they are rows to swipe. A tap copies an idea, to
 * paste into the assistant where they added Menta.
 */
function IdeaChips({ ideas }: { ideas: readonly Idea[] }) {
  const { m, f } = useI18n();
  const t = m.app.home;
  const [copied, setCopied] = useState<Idea["key"] | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy(key: Idea["key"], text: string) {
    window.clearTimeout(timer.current);
    // Cleared first, so a copy within the last one's time is announced again.
    setCopied(null);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Without clipboard access nothing is copied, and no chip says it was.
      return;
    }
    setCopied(key);
    timer.current = window.setTimeout(() => setCopied(null), COPIED_FOR);
  }
  /** One chip; a `copy` past the first is there only to close the loop. */
  const chip = (idea: Idea, round: number) => {
    const text = f(m.landing.how.examples[idea.key], { store: idea.store });
    const done = copied === idea.key;
    const loop = round > 0;
    return (
      <li
        key={`${idea.key}-${round}`}
        aria-hidden={loop || undefined}
        // Each chip carries its own space (no gap), so the halves match and the loop doesn't jump.
        // Without motion there is no loop, so only the first copy shows.
        className={`flex flex-none pr-2 ${loop ? "motion-reduce:hidden" : ""}`}
      >
        <button
          type="button"
          title={t.copyIdea}
          tabIndex={loop ? -1 : undefined}
          onClick={() => void copy(idea.key, text)}
          className="inline-flex items-center gap-2.5 rounded-[18px] rounded-br-md bg-white py-2 pr-3.5 pl-2.5 text-left text-[14px] leading-snug whitespace-nowrap text-soft shadow-[0_6px_16px_-10px_rgb(0_0_0/25%)] ring-1 ring-black/[0.05] transition-colors ring-inset hover:text-ink"
        >
          <Image
            src={idea.logo}
            alt=""
            width={22}
            height={22}
            unoptimized
            className="size-[22px] flex-none rounded-[6px] bg-white object-contain ring-1 ring-black/5"
          />
          {text}
          <span
            aria-hidden="true"
            className={`inline-flex flex-none ${done ? "text-[#07783f]" : "text-muted"}`}
          >
            {done ? (
              <Check width={14} height={14} strokeWidth={2.5} />
            ) : (
              <Copy width={14} height={14} />
            )}
          </span>
        </button>
      </li>
    );
  };
  // Alternate ideas per row; each row runs four times over, so half a track
  // is always wider than the banner and the slide never shows an end.
  const rows = [
    ideas.filter((_, index) => index % 2 === 0),
    ideas.filter((_, index) => index % 2 === 1),
  ];
  return (
    <>
      <div className="-mx-6 flex flex-col gap-2 self-stretch py-2 [mask-image:linear-gradient(90deg,transparent,#000_32px,#000_calc(100%-32px),transparent)] sm:-mx-10">
        {rows.map((row, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: two fixed rows
            key={index}
            className="overflow-hidden motion-reduce:overflow-x-auto"
          >
            <ul
              className={`drift m-0 flex w-max list-none p-0 hover:[animation-play-state:paused] active:[animation-play-state:paused] ${index === 1 ? "[animation-direction:reverse]" : ""}`}
              style={{ animationDuration: `${row.length * 16}s` }}
            >
              {[0, 1, 2, 3].flatMap((round) =>
                row.map((idea) => chip(idea, round)),
              )}
            </ul>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? m.app.connect.copied : ""}
      </p>
    </>
  );
}

/** A Home card's line when its list is empty or failed, with an optional button under it. */
function CardNote({
  text,
  action,
}: {
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-start gap-3 px-5 pt-1 pb-5">
      <p className="m-0 text-[14px] text-pretty text-quiet">{text}</p>
      {action}
    </div>
  );
}

/** A small raised button inside a Home card (save a card, make a limit). */
function CardButton({
  label,
  disabled = false,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onClick}
      className="raised-light tap relative inline-flex h-9 items-center gap-1.5 rounded-full border border-line-card bg-white px-4 text-[14px] font-medium text-ink disabled:opacity-50"
    >
      <Plus width={15} height={15} />
      {label}
    </button>
  );
}

/** The saved cards, default first: brand, name or last four, and the default's tag. */
function CardRows({ cards }: { cards: readonly SavedCard[] }) {
  const { m } = useI18n();
  const sorted = [...cards].sort(
    (a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)),
  );
  return (
    <div className="divide-y divide-black/[0.05]">
      {sorted.slice(0, 4).map((card) => (
        <Link
          key={card.paymentMethodId}
          href={`/wallet?card=${encodeURIComponent(card.paymentMethodId)}`}
          className="flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-black/[0.03]"
        >
          <svg
            viewBox="0 0 34 22"
            width="34"
            height="22"
            aria-hidden="true"
            className="flex-none"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: our own static brand art (card-brands.ts)
            dangerouslySetInnerHTML={{ __html: cardBrandArt(card.brand) }}
          />
          <span className="min-w-0 flex-1 truncate font-medium">
            {card.name ? `${card.name} ·· ${card.last4}` : cardLabel(card)}
          </span>
          {card.isDefault ? (
            <span className="flex-none rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-soft ring-1 ring-black/[0.08] ring-inset">
              {m.settings.cardManager.default}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

/** Active spending limits: where, what's spent of it, and when it ends. */
function LimitRows({ limits }: { limits: readonly Approval[] }) {
  const { m } = useI18n();
  const t = m.app.wallet;
  const { money, remaining } = useFormat();
  return (
    <div className="divide-y divide-black/[0.05]">
      {limits.slice(0, 4).map((limit) => {
        const { currency } = limit.amount;
        const where = limitStore(limit);
        return (
          <Link
            key={limit.orderIntentId}
            href={`/spending-limits?open=${encodeURIComponent(limit.orderIntentId)}`}
            className="flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-black/[0.03]"
          >
            <ApprovalIcon approval={limit} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">
                {where ?? (limit.description || t.unknownStore)}
              </span>
              {limit.description && where ? (
                <span className="truncate text-[13px] text-quiet">
                  {limit.description}
                </span>
              ) : null}
            </span>
            <span className="flex flex-none flex-col items-end">
              <span className="text-[13px] text-quiet tabular-nums">
                {rich(t.spentOf, {
                  spent: (
                    <span className="font-medium text-ink">
                      {money(limit.amount.spent, currency)}
                    </span>
                  ),
                  total: money(limit.amount.total, currency),
                })}
              </span>
              <span className="text-[12px] text-muted">
                {remaining(limit.expiresAt)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The overview. With no purchase and no agent yet: a welcome, and connecting
 * an agent as the first step. Once there is either: ideas for the agent, then
 * a grid of the latest purchases, saved cards, connected agents and spending
 * limits, and what's left to set up.
 */
export function Overview({
  serverUrl,
  stores,
  ideas,
  currencies,
  currency,
}: {
  serverUrl: string;
  stores: readonly LocalStore[];
  ideas: readonly Idea[];
} & LimitCurrencies) {
  const { m, f, tag } = useI18n();
  const t = m.app.home;
  const { me } = useAccount();
  const { money, relative } = useFormat();
  /** Undefined while loading, null when it failed. */
  const [runs, setRuns] = useState<readonly Purchase[] | null>();
  const [agents, setAgents] = useState<Connection[] | null>();
  const [addresses, setAddresses] = useState<SavedAddress[] | null>();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<readonly SavedCard[] | null>();
  /** Every spending limit Crossmint lists, ended ones too: the setup step counts any. */
  const [limits, setLimits] = useState<readonly Approval[] | null>();
  /** The modal open: adding a card or making a spending limit. */
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
      .then((body: { cards?: SavedCard[] | null } | null) =>
        setCards(body?.cards ?? null),
      )
      .catch(() => setCards(null));
  }, []);
  // With no card yet, fetch the add-card modal's code now, so it opens on the click.
  useEffect(() => {
    if (cards?.length === 0) {
      void loadCrossmint();
    }
  }, [cards]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `loadLimits` asks for a fresh list
  useEffect(() => {
    // Only the latest list lands: an older, slower answer would undo a limit just made.
    let stopped = false;
    const set = (list: readonly Approval[] | null) => {
      if (!stopped) {
        setLimits(list);
      }
    };
    void fetch("/api/crossmint/order-intents", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { orderIntents?: Approval[] } | null) =>
        set(body?.orderIntents ? ordered(body.orderIntents) : null),
      )
      .catch(() => set(null));
    return () => {
      stopped = true;
    };
  }, [loadLimits]);

  const loading = runs === undefined || agents === undefined;
  /** Limits that can still pay. */
  const live = limits?.filter((limit) => shown(limit) === "active") ?? [];
  /**
   * What the banner asks for: the first thing still to do, in order, then
   * ideas once it's all done. A list that failed to load (null) is skipped;
   * undefined while any is still loading.
   */
  const step =
    runs === undefined ||
    agents === undefined ||
    addresses === undefined ||
    cards === undefined ||
    limits === undefined
      ? undefined
      : agents?.length === 0
        ? "agent"
        : addresses?.length === 0
          ? "address"
          : cards?.length === 0
            ? "card"
            : // A spending limit is set on a card: it comes once there is one.
              cards?.length && limits?.length === 0
              ? "limit"
              : runs?.length === 0
                ? "purchase"
                : "done";
  const first = me?.name?.trim().split(/\s+/)[0];
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
        // Listed at once, as the Wallet does: Crossmint's list may not have it yet.
        onAdded={(card) => {
          setCards((current) => [
            card,
            ...(current ?? []).filter(
              (item) => item.paymentMethodId !== card.paymentMethodId,
            ),
          ]);
          setOpened(null);
        }}
        onClose={() => setOpened(null)}
      />
    ) : opened === "limit" ? (
      <NewApproval
        currencies={currencies}
        currency={currency}
        // Closed mid-approval, Crossmint may still have made it: list again either way.
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

  const name = first ? { name: first } : null;
  const banner =
    step === "agent" ? (
      // Before anything happened, or after removing every agent: the same ask.
      <Banner
        title={name ? f(t.welcome, name) : t.welcomeNoName}
        lede={t.welcomeLede}
        floating={StoreTiles(stores)}
      >
        <ChooseAgent serverUrl={serverUrl} />
      </Banner>
    ) : step === "address" ? (
      <Banner
        title={t.addressTitle}
        lede={t.addressLede}
        floating={[
          <Pin key="a" />,
          <Pin key="b" />,
          <Pin key="c" />,
          <Pin key="d" />,
          <Pin key="e" />,
          <Pin key="f" />,
        ]}
        backdrop={<MapStreets />}
      >
        <MainAction
          icon={<Store width={20} height={20} />}
          label={t.addressAction}
          onClick={() => setAdding(true)}
        />
      </Banner>
    ) : step === "card" ? (
      <Banner title={t.cardTitle} lede={t.cardLede} floating={CardTiles()}>
        <MainAction
          icon={<CardIcon width={20} height={20} strokeWidth={1.75} />}
          label={t.addCard}
          onClick={() => setOpened("card")}
        />
      </Banner>
    ) : step === "limit" ? (
      <Banner
        title={t.limitTitle}
        lede={t.limitLede}
        // Dollar-sized amounts, scaled to the currency's size (¥5,000, not ¥50).
        floating={LimitTiles(stores, (value) =>
          new Intl.NumberFormat(tag, {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          }).format(
            value *
              10 ** Math.round(Math.log10(currencyFor(tag, currency).rate)),
          ),
        )}
      >
        <MainAction
          icon={<Gauge width={20} height={20} />}
          label={m.app.wallet.create.open}
          onClick={() => setOpened("limit")}
        />
      </Banner>
    ) : step === "purchase" ? (
      <Banner title={t.firstPurchase} lede={t.purchaseLede} ledeBelowLg={false}>
        <IdeaChips ideas={ideas} />
      </Banner>
    ) : step === "done" ? (
      <Banner
        title={name ? f(t.ideasTitle, name) : t.ideasTitleNoName}
        lede={t.ideasLede}
        ledeBelowLg={false}
      >
        <IdeaChips ideas={ideas} />
      </Banner>
    ) : (
      <Banner />
    );

  return (
    <PageShell title={t.title} titleHidden wide>
      {banner}
      {loading ? (
        <div role="status" className="grid gap-6 lg:grid-cols-3">
          <span className="sr-only">{m.settings.loading}</span>
          <div className="lg:col-span-2">
            <CardSkeleton rows={4} />
          </div>
          <CardSkeleton rows={2} />
          <CardSkeleton rows={2} />
          <div className="lg:col-span-2">
            <CardSkeleton rows={2} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            id="recent"
            className="lg:col-span-2"
            title={t.recent}
            link={
              runs?.length ? { href: "/activity", label: t.seeAll } : undefined
            }
          >
            {/* Four purchases' height (four 56px rows), however many there are, so Home doesn't jump. */}
            <div className="min-h-[224px]">
              {runs === null ? (
                <p className="m-0 px-5 pb-5 text-[13px] text-quiet">
                  {t.recentFailed}
                </p>
              ) : runs.length === 0 ? (
                // Like the empty Activity table: faded rows, the line over them.
                <div className="relative">
                  <GhostRows stores={stores} />
                  {/* Centered over the rows, on a white glow so it reads over them. */}
                  <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_50%_55%_at_50%_50%,#fff_50%,rgb(255_255_255/0))] px-6">
                    <p className="m-0 max-w-[340px] text-center text-[15px] font-medium text-pretty text-soft">
                      {t.recentEmpty}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.05]">
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
          <Card
            id="cards"
            title={t.cards}
            link={
              cards?.length ? { href: "/wallet", label: t.manage } : undefined
            }
          >
            {cards === undefined ? (
              <CardNote text={m.settings.loading} />
            ) : cards === null ? (
              <CardNote text={t.cardsFailed} />
            ) : cards.length === 0 ? (
              <CardNote
                text={t.cardsEmpty}
                action={
                  <CardButton
                    label={t.addCard}
                    onClick={() => setOpened("card")}
                  />
                }
              />
            ) : (
              <CardRows cards={cards} />
            )}
          </Card>
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
              <CardNote text={t.agentsFailed} />
            ) : agents.length === 0 ? (
              <CardNote text={t.agentsEmpty} />
            ) : (
              <div className="divide-y divide-black/[0.05]">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex min-h-14 items-center gap-3.5 px-5 py-2.5"
                  >
                    <AgentIcon name={agent.name} logoUrl={agent.logoUrl} />
                    {/* When it was last used, not what it calls itself: that's on Agents. */}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{agent.name}</span>
                      <span className="truncate text-[13px] text-quiet">
                        {agent.lastUsedAt
                          ? f(m.settings.connections.lastUsed, {
                              when: relative(agent.lastUsedAt),
                            })
                          : m.settings.connections.notUsed}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card
            id="limits"
            className="lg:col-span-2"
            title={t.limits}
            // Its rows show what's used of each limit.
            help={{
              label: m.app.wallet.detail.usedHelpLabel,
              text: m.app.wallet.detail.usedHelp,
            }}
            link={
              limits?.length
                ? { href: "/spending-limits", label: t.seeAll }
                : undefined
            }
          >
            {limits === undefined ? (
              <CardNote text={m.settings.loading} />
            ) : limits === null ? (
              <CardNote text={m.app.wallet.approvalsFailed} />
            ) : live.length === 0 ? (
              <CardNote
                text={cards?.length === 0 ? t.limitsNeedCard : t.limitsEmpty}
                action={
                  <CardButton
                    label={m.app.wallet.create.open}
                    // A spending limit needs a card first.
                    disabled={cards?.length === 0}
                    onClick={() => setOpened("limit")}
                  />
                }
              />
            ) : (
              <LimitRows limits={live} />
            )}
          </Card>
        </div>
      )}
      {adding ? addressModal : null}
      {setupModal}
    </PageShell>
  );
}

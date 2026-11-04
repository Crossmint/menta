"use client";

import Image from "next/image";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import { useI18n } from "../../lib/i18n/client";
import { format } from "../../lib/i18n/format";
import { rich } from "../../lib/i18n/rich";
import { CrossmintLogo } from "../_components/brand-marks";
import {
  Bubble,
  Check,
  Chevron,
  Clock,
  Lock,
  Mic,
  Plus,
  Search,
} from "../_components/icons";
import { currencyFor, localPrice } from "./currency";
import { HOSTS, type Host } from "./hosts";
import { useMarket } from "./market";
import { type Merchant, merchant, type Role } from "./markets";
import { useReducedMotion } from "./motion";

/**
 * The hero: the same ask-and-approve moment at stores people know, inside the
 * assistants Menta plugs into, written in the reader's language and priced in
 * their currency. Each order plays in the next assistant, and the window morphs
 * into it. The orders are made up; the flow is the real one (the store's total,
 * your card, your OK), and the receipt is our in-host card, the same everywhere.
 *
 * On wide screens it then flies into the use cases below (use-cases.tsx):
 * while it's `leaving`, the order pauses and clears and the window turns into
 * the first use case's, and the flight sizes the parts marked `data-flight`.
 */

/**
 * Each order's store (the visitor's, by its part in markets.ts, or one
 * that's the same everywhere), its price in US dollars and the assistant it
 * plays in; the words are in the messages.
 */
const ORDERS: readonly {
  store: Role | Merchant;
  usd: number;
  host: Host;
}[] = [
  { store: "marketplace", usd: 79.99, host: "chatgpt" },
  { store: "delivery", usd: 38.5, host: "claude" },
  { store: "tables", usd: 40, host: "grok" },
  { store: "tickets", usd: 60, host: "chatgpt" },
  { store: merchant("netflix"), usd: 24.99, host: "claude" },
  { store: "fashion", usd: 89, host: "grok" },
];

/** How long each beat holds: the ask, the reply, the receipt. */
const BEATS = [900, 1000, 3400];

export const rise =
  "animate-[landing-rise_420ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none";
/** The chrome that stays on screen eases from one assistant's look to the next. */
export const morph =
  "transition-[background-color,border-color,color,border-radius,height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
/** What's drawn differently per assistant fades in when it changes. */
const swap =
  "animate-[host-in_520ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none";

const USER = "Alex";

/** The person's message, drawn the way each assistant draws it. */
export const ASK: Record<Host, string> = {
  chatgpt: "rounded-[20px] bg-[#f4f4f4] px-4 py-2.5",
  claude: "rounded-[14px] bg-[#f0eee6] px-4 py-2.5",
  grok: "rounded-[20px] bg-[#111] px-4 py-2 text-white",
};

/** The assistant's reply, the same. */
export const REPLY: Record<Host, string> = {
  chatgpt: "px-1 text-[15px]",
  claude: "px-1 font-[Georgia,ui-serif,serif] text-[15.5px]",
  grok: "self-start rounded-[18px] bg-[#f0f0f0] px-4 py-2.5 text-[14.5px]",
};

export function WorldDemo({
  ref,
  leaving = null,
}: {
  ref?: Ref<HTMLElement>;
  /** The use case the window is turning into as it flies down, if it is. */
  leaving?: { host: Host; title: string } | null;
}) {
  const { m, tag } = useI18n();
  const t = m.landing.demo;
  const market = useMarket();
  const reduced = useReducedMotion();
  const [order, setOrder] = useState(0);
  const [beat, setBeat] = useState(0);

  // Back from the flight it stays in the assistant it flew as, at that
  // assistant's next order, so nothing has to turn back as it lands home.
  // Set while rendering, so it never shows a frame of the order it left.
  const [flewAs, setFlewAs] = useState<Host | null>(null);
  if (leaving && flewAs !== leaving.host) {
    setFlewAs(leaving.host);
  }
  if (!leaving && flewAs) {
    const next = ORDERS.findIndex(
      (_, index) =>
        ORDERS[(order + 1 + index) % ORDERS.length]?.host === flewAs,
    );
    setFlewAs(null);
    setOrder(next < 0 ? order : (order + 1 + next) % ORDERS.length);
    setBeat(0);
  }

  useEffect(() => {
    if (reduced || leaving) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (beat < BEATS.length - 1) {
        setBeat(beat + 1);
      } else {
        setBeat(0);
        setOrder((order + 1) % ORDERS.length);
      }
    }, BEATS[beat]);
    return () => window.clearTimeout(timer);
  }, [reduced, leaving, beat, order]);

  // Without motion, the first order is shown complete.
  const shown = reduced ? BEATS.length - 1 : beat;
  const data = ORDERS[order];
  const host = leaving?.host ?? data.host;
  const storeOf = (item: (typeof ORDERS)[number]) =>
    typeof item.store === "string" ? market.roles[item.store] : item.store;
  const store = storeOf(data);
  const words = t.orders[order] ?? t.orders[0];
  // The sidebar's chats: this one on top, then the other orders, each naming its own store.
  const chats = ORDERS.flatMap((_, index) => {
    const at = (order + index) % ORDERS.length;
    const chat = t.orders[at];
    return chat
      ? [
          {
            title: chat.title,
            reply: format(chat.reply, {
              store: storeOf(ORDERS[at]).name,
            }),
          },
        ]
      : [];
  });

  return (
    <figure
      ref={ref}
      aria-label={t.label}
      className="bezel relative mx-auto w-full max-w-[1000px] rounded-[30px] border border-white/80 p-2.5 backdrop-blur"
    >
      {/* The deeper shadow it casts while it's in the air. */}
      <div
        aria-hidden="true"
        data-flight="lift"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[30px] opacity-0 shadow-[0_70px_120px_-30px_rgb(0_0_0/30%)]"
      />
      <div
        data-flight="screen"
        style={HOSTS[host].vars}
        className={`bezel-screen flex h-[540px] overflow-hidden rounded-[22px] bg-(--host-bg) text-(--host-ink) md:h-[580px] ${morph}`}
      >
        <aside
          aria-hidden="true"
          data-flight="side"
          className={`hidden w-[244px] flex-none flex-col overflow-hidden border-r border-(--host-line) bg-(--host-side) md:flex ${morph}`}
        >
          <div className="flex h-12 flex-none items-center gap-2 px-4">
            <TrafficLights />
            {host === "grok" ? (
              <span key={host} className={`ml-auto flex gap-1.5 ${swap}`}>
                <RoundButton>
                  <Search width={14} height={14} />
                </RoundButton>
                <RoundButton>
                  <Plus width={14} height={14} />
                </RoundButton>
              </span>
            ) : null}
          </div>
          <div key={host} className={`flex min-h-0 flex-1 flex-col ${swap}`}>
            {host === "chatgpt" ? (
              <ChatGPTSide t={t.host} chats={chats.map((chat) => chat.title)} />
            ) : host === "claude" ? (
              <ClaudeSide t={t.host} chats={chats.map((chat) => chat.title)} />
            ) : (
              <GrokSide t={t.host} chats={chats} />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            aria-hidden="true"
            className="flex h-12 flex-none items-center gap-3 px-4"
          >
            <span className={leaving ? undefined : "md:hidden"}>
              <TrafficLights />
            </span>
            <Header host={host} title={leaving?.title ?? words.title} />
          </div>

          <div
            key={order}
            aria-hidden="true"
            className={`min-h-0 flex-1 overflow-hidden px-4 pt-3 transition-opacity duration-300 sm:px-8 ${leaving ? "opacity-0" : ""}`}
          >
            <div className="mx-auto flex max-w-[560px] flex-col gap-3">
              <div className="flex justify-end">
                <p
                  className={`max-w-[82%] text-[14.5px] text-pretty ${ASK[host]} ${rise}`}
                >
                  {words.ask}
                </p>
              </div>
              {shown >= 1 ? (
                <p className={`text-pretty ${REPLY[host]} ${rise}`}>
                  {format(words.reply, { store: store.name })}
                </p>
              ) : null}
              {shown >= 2 ? (
                <Receipt
                  store={store}
                  item={words.item}
                  usd={data.usd}
                  tag={tag}
                  t={t}
                />
              ) : null}
            </div>
          </div>

          {/* Laid out like the use cases' window as it leaves, so it lands without a jump. */}
          <div
            aria-hidden="true"
            className={`flex-none px-4 transition-[padding] duration-500 ${leaving ? "pt-2" : "sm:px-8"}`}
          >
            <Composer host={host} t={t.host} />
            <p
              key={host}
              className={`truncate pt-1.5 text-center text-[11px] text-(--host-soft) transition-[height,opacity] duration-500 ${leaving ? "h-4 opacity-0" : `h-7 ${swap}`}`}
            >
              {host === "grok"
                ? null
                : format(t.host.mistakes, { name: HOSTS[host].name })}
            </p>
          </div>
        </div>
      </div>
    </figure>
  );
}

export type Words = ReturnType<typeof useI18n>["m"]["landing"]["demo"];

/** Menta's in-host card: the same in every assistant, and in the use cases (use-cases.tsx). */
export function Receipt({
  store,
  item,
  usd,
  tag,
  t,
}: {
  store: Merchant;
  item: string;
  usd: number;
  tag: string;
  t: Words;
}) {
  const market = useMarket();
  const currency = currencyFor(tag, market.currency);
  return (
    <div
      className={`raised-light mt-1 flex w-full max-w-[400px] flex-col gap-3.5 rounded-[22px] border border-line bg-white p-4 text-ink ${rise}`}
    >
      <div className="flex items-center gap-2">
        <span className="mascot-fill inline-flex size-5 flex-none items-center justify-center rounded-full text-white">
          <Check width={12} height={12} />
        </span>
        <span className="text-[13.5px] font-medium">{t.placed}</span>
        <span className="ml-auto rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-soft">
          {currency.code}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Image
          src={store.logo}
          alt=""
          width={44}
          height={44}
          unoptimized
          className="raised-light size-11 flex-none rounded-[14px] object-contain ring-1 ring-black/5"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{store.name}</span>
          <span className="truncate text-[12.5px] text-muted">{item}</span>
        </span>
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-dashed border-line-strong pt-3.5">
        <span className="label text-[10.5px] text-muted">{t.total}</span>
        <span className="text-[26px] leading-none font-light tracking-[-0.03em] tabular-nums">
          {localPrice(tag, usd, market)}
        </span>
      </div>
      <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-t border-dashed border-line-strong pt-3 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Lock width={11} height={11} />
          {t.card} ·
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {rich(t.poweredBy, {
            crossmint: (
              <CrossmintLogo
                role="img"
                aria-label="Crossmint"
                aria-hidden={undefined}
                className="h-[11px] w-auto text-ink"
              />
            ),
          })}
        </span>
      </span>
    </div>
  );
}

/** The window's close, minimize and zoom buttons. */
export function TrafficLights() {
  return (
    <span className="flex flex-none gap-2">
      {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
        <span
          key={color}
          style={{ backgroundColor: color }}
          className="size-3 rounded-full ring-1 ring-black/10 ring-inset"
        />
      ))}
    </span>
  );
}

function RoundButton({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-white text-(--host-ink) ring-1 ring-black/5">
      {children}
    </span>
  );
}

/** Grok Bot's bots: a soft blob with two eyes. */
function Blob({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="flex-none"
    >
      <path
        d="M21 3c6.5 0 10.5 2.6 13 7.2 2.6 4.6 3.4 10.2 1.3 15.3C33 31 28 36.5 20.5 37 13 37.4 6.6 34 4.3 27.7 2 21.4 3.4 13.8 8 8.8 11.4 5 15.8 3 21 3z"
        fill={color}
      />
      <rect
        x="20.5"
        y="11"
        width="3.6"
        height="8"
        rx="1.8"
        transform="rotate(-20 22.3 15)"
        fill="#fff"
      />
      <rect
        x="27.5"
        y="12"
        width="3.6"
        height="8"
        rx="1.8"
        transform="rotate(-20 29.3 16)"
        fill="#fff"
      />
    </svg>
  );
}

const Pencil = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

const Waveform = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M2.5 6.5v3M5.5 4v8M8 2.5v11M10.5 4.5v7M13.5 6.5v3" />
  </svg>
);

function Row({
  icon,
  active,
  children,
}: {
  icon?: ReactNode;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[13.5px] ${
        active ? "bg-(--host-active)" : ""
      }`}
    >
      {icon ? (
        <span className="flex flex-none text-(--host-ink)">{icon}</span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Section({ children }: { children: ReactNode }) {
  return (
    <span className="mt-3 px-2.5 pb-1 text-[12.5px] text-(--host-soft)">
      {children}
    </span>
  );
}

function UserRow() {
  return (
    <span className="mt-auto flex items-center gap-2.5 px-4 py-3 text-[13.5px]">
      <span className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-[#2b2b2b] text-[12px] font-medium text-white">
        {USER[0]}
      </span>
      {USER}
    </span>
  );
}

type HostWords = Words["host"];

/** ChatGPT: an icon rail, then the wordmark, new chat, search and recents. */
function ChatGPTSide({ t, chats }: { t: HostWords; chats: string[] }) {
  return (
    <div className="flex min-h-0 flex-1">
      <span className="flex w-11 flex-none flex-col items-center gap-4 pt-1 text-(--host-soft)">
        <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-(--host-active) text-(--host-ink)">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"
              fill="currentColor"
            />
          </svg>
        </span>
        <Bubble width={16} height={16} />
        <Clock width={16} height={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-2">
        <span className="flex items-center justify-between px-2.5 pb-2">
          <span className="text-[16px] font-semibold tracking-[-0.01em]">
            ChatGPT
          </span>
          <Search width={16} height={16} className="text-(--host-soft)" />
        </span>
        <Row icon={<Pencil />}>{t.newChat}</Row>
        <Row icon={<Search width={16} height={16} />}>{t.search}</Row>
        <Section>{t.recents}</Section>
        {chats.map((chat, index) => (
          <Row key={chat} active={index === 0}>
            {chat}
          </Row>
        ))}
      </span>
    </div>
  );
}

/** Claude: the serif wordmark, its nav, recents and the account. */
function ClaudeSide({ t, chats }: { t: HostWords; chats: string[] }) {
  return (
    <span className="flex min-h-0 flex-1 flex-col gap-0.5 px-2">
      <span className="px-2.5 pb-2 font-[Georgia,ui-serif,serif] text-[21px] tracking-[-0.01em]">
        Claude
      </span>
      <Row
        icon={
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#e8e6dc]">
            <Plus width={12} height={12} />
          </span>
        }
      >
        {t.newChat}
      </Row>
      <Row icon={<Search width={16} height={16} />}>{t.search}</Row>
      <Row icon={<Bubble width={16} height={16} />}>{t.chats}</Row>
      <Row
        icon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        }
      >
        {t.projects}
      </Row>
      <Section>{t.recents}</Section>
      {chats.slice(0, 5).map((chat, index) => (
        <Row key={chat} active={index === 0}>
          {chat}
        </Row>
      ))}
      <UserRow />
    </span>
  );
}

const BLOBS = [
  "#3b82f6",
  "#8b5cf6",
  "#4cc77a",
  "#ef4444",
  "#9ca3af",
  "#a16207",
];

/** Grok Bot: pinned bots up top, then the assistants' chats with a preview line. */
function GrokSide({
  t,
  chats,
}: {
  t: HostWords;
  chats: { title: string; reply: string }[];
}) {
  return (
    <span className="flex min-h-0 flex-1 flex-col">
      <span className="grid grid-cols-3 gap-1 px-2 pb-1">
        {[
          { name: "Grok Bot", color: "#111" },
          { name: "Menta", color: "#10b45e" },
        ].map((bot, index) => (
          <span
            key={bot.name}
            className={`flex flex-col items-center gap-1 rounded-[14px] py-2 text-[11.5px] ${
              index === 0 ? "bg-(--host-active)" : ""
            }`}
          >
            <Blob color={bot.color} size={40} />
            <span className="max-w-full truncate px-1">{bot.name}</span>
          </span>
        ))}
      </span>
      <Section>{t.assistants}</Section>
      <span className="flex flex-col gap-0.5 px-2">
        {chats.slice(0, 4).map((chat, index) => (
          <span
            key={chat.title}
            className={`flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 ${
              index === 0 ? "bg-(--host-active)" : ""
            }`}
          >
            <Blob color={index === 0 ? "#111" : BLOBS[index % BLOBS.length]} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium">
                {chat.title}
              </span>
              <span className="truncate text-[12px] text-(--host-soft)">
                {chat.reply}
              </span>
            </span>
          </span>
        ))}
      </span>
      <UserRow />
    </span>
  );
}

/** The chat's title, where each assistant puts it. */
export function Header({ host, title }: { host: Host; title: string }) {
  if (host === "grok") {
    return (
      <span key={host} className={`flex min-w-0 flex-1 justify-center ${swap}`}>
        <span className="flex min-w-0 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13.5px] shadow-[0_1px_3px_rgb(0_0_0/8%),0_0_0_1px_rgb(0_0_0/6%)]">
          <Blob color="#111" size={20} />
          <span className="truncate">{title}</span>
        </span>
      </span>
    );
  }
  return (
    <span
      key={host}
      className={`flex min-w-0 flex-1 items-center gap-1.5 ${swap}`}
    >
      <span
        className={`truncate ${host === "claude" ? "text-[14px]" : "text-[15px]"}`}
      >
        {title}
      </span>
      {host === "claude" ? (
        <Chevron width={14} height={14} className="flex-none rotate-90" />
      ) : null}
      {host === "chatgpt" ? (
        <span className="ml-auto flex-none text-(--host-soft)">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="3" cy="8" r="1.3" />
            <circle cx="8" cy="8" r="1.3" />
            <circle cx="13" cy="8" r="1.3" />
          </svg>
        </span>
      ) : null}
    </span>
  );
}

/** The message box: its shape morphs, its contents fade in. */
export function Composer({ host, t }: { host: Host; t: HostWords }) {
  const tall = host !== "grok";
  return (
    <div
      style={{ height: tall ? 96 : 50 }}
      className={`mx-auto max-w-[600px] overflow-hidden rounded-(--host-composer-radius) border border-(--host-line) bg-(--host-composer) shadow-[0_2px_10px_rgb(0_0_0/4%)] ${morph}`}
    >
      {tall ? (
        <div key={host} className={`flex h-full flex-col p-3 pl-4 ${swap}`}>
          <span className="truncate pt-1 text-[14.5px] text-(--host-soft)">
            {host === "claude" ? t.reply : t.ask}
          </span>
          <span className="mt-auto flex items-center gap-3">
            <Plus width={18} height={18} />
            <span className="ml-auto flex items-center gap-1 text-[13px]">
              {HOSTS[host].model}
              <Chevron width={12} height={12} className="rotate-90" />
            </span>
            {host === "chatgpt" ? (
              <>
                <Mic />
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#3b82f6] text-white">
                  <Waveform />
                </span>
              </>
            ) : (
              <Waveform />
            )}
          </span>
        </div>
      ) : (
        <div
          key={host}
          className={`flex h-full items-center gap-2.5 px-2 ${swap}`}
        >
          <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-[#f2f2f2]">
            <Plus width={16} height={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] text-(--host-soft)">
            {format(t.message, { name: HOSTS[host].name })}
          </span>
          <Mic className="flex-none text-(--host-soft)" />
          <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-[#111] text-white">
            <Waveform />
          </span>
        </div>
      )}
    </div>
  );
}

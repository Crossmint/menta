import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import type { Messages } from "../../lib/i18n/messages";
import { rich } from "../../lib/i18n/rich";
import {
  Card,
  Check,
  Clock,
  Globe,
  Lock,
  Mascot,
  Shield,
  Sparkle,
  Store,
} from "../_components/icons";
import type { Merchant } from "./markets";
import { PAYMENTS, type PaymentId } from "./payments";
import { AGENT, MENTA } from "./speed";
import { duration } from "./time";

/**
 * The little loops on the homepage's benefit cards (animated in style.css,
 * `.art-*`). They're decoration: the card's title and text say the same thing.
 */

/**
 * The trust cards' loops start halfway, on the frame that makes their point,
 * because they wait there, paused, until the card is hovered (landing.tsx).
 */
const halfway = (seconds: number): CSSProperties => ({
  animationDelay: `${-seconds / 2}s`,
});

function Track({ children }: { children: ReactNode }) {
  return (
    <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-black/[0.06]">
      {children}
    </span>
  );
}

function Done({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`mascot-fill inline-flex size-6 flex-none items-center justify-center rounded-full text-white ${className}`}
      style={style}
    >
      <Check width={13} height={13} />
    </span>
  );
}

/**
 * A race in small: "9× faster" over the same order in an agent's own
 * browser, its bar crawling, and with Menta, done nine times as fast, each
 * with how long it takes.
 */
export function FasterArt({
  t,
  tag,
}: {
  t: Messages["landing"]["how"]["items"]["faster"]["race"];
  tag: string;
}) {
  const rows = [
    {
      key: "alone",
      label: t.alone,
      seconds: AGENT.seconds,
      icon: (
        <span className="inline-flex size-8 flex-none items-center justify-center rounded-[10px] bg-white text-muted ring-1 ring-black/[0.06]">
          <Globe width={16} height={16} />
        </span>
      ),
      bar: "art-slow bg-line-strong",
      done: <span className="size-6 flex-none" />,
    },
    {
      key: "menta",
      label: t.with,
      seconds: MENTA.seconds,
      icon: <Mascot size={32} />,
      bar: "art-fast mascot-fill",
      done: <Done className="art-done-fast" />,
    },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-4 px-5 lg:px-6">
      <span className="text-[22px] leading-none font-semibold tracking-[-0.04em]">
        {rich(t.title, {
          times: <span className="mascot-text">{t.times}</span>,
        })}
      </span>
      {rows.map(({ key, label, seconds, icon, bar, done }) => (
        <div key={key} className="flex items-center gap-3">
          {icon}
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="truncate text-quiet">{label}</span>
              <span
                className={`flex-none font-semibold tabular-nums ${key === "menta" ? "mascot-text" : ""}`}
              >
                {duration(tag, seconds)}
              </span>
            </span>
            <span className="flex">
              <Track>
                <span
                  className={`absolute inset-0 origin-left rounded-full ${bar}`}
                />
              </Track>
            </span>
          </span>
          {done}
        </div>
      ))}
    </div>
  );
}

/**
 * A payment method's official logo, `height` tall at its own proportions;
 * `alt` names it where it stands in a line of text.
 */
function PaymentLogo({
  name,
  width,
  height,
  className,
  alt = "",
}: {
  name: string;
  width: number;
  height: number;
  className: string;
  alt?: string;
}) {
  return (
    <Image
      src={`/payments/${name}.svg`}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={className}
    />
  );
}

/**
 * The card networks; `inline` sizes them to sit in a line of text and names
 * them, so a heading they finish still reads whole.
 */
export function CardNetworks({ inline = false }: { inline?: boolean }) {
  return (
    // Inline, the row sits on the Visa mark's foot; lifted a hair, the logos
    // center on the capitals beside them.
    <span
      className={
        inline
          ? "mx-0.5 inline-flex items-center gap-1.5 align-[0.05em]"
          : "flex items-center gap-2"
      }
    >
      <PaymentLogo
        name="visa"
        alt={inline ? "Visa" : ""}
        width={1000}
        height={325}
        className={`${inline ? "h-[0.6em]" : "h-3"} w-auto`}
      />
      <PaymentLogo
        name="mastercard"
        alt={inline ? "Mastercard" : ""}
        width={1000}
        height={618}
        className={`${inline ? "h-[1em]" : "h-5"} w-auto`}
      />
      <PaymentLogo
        name="amex"
        alt={inline ? "American Express" : ""}
        width={1000}
        height={998}
        className={`${inline ? "h-[1.15em]" : "h-6"} w-auto`}
      />
      <PaymentLogo
        name="unionpay"
        alt={inline ? "UnionPay" : ""}
        width={256}
        height={160}
        className={`${inline ? "h-[1em]" : "h-5"} w-auto`}
      />
    </span>
  );
}

/** Your card on any network. */
const CARDS = <CardNetworks />;

/** A way to pay: its wordmark, or its app icon beside its name. */
function Method({ id }: { id: PaymentId }) {
  const method = PAYMENTS[id];
  if ("icon" in method) {
    return (
      <span className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em]">
        <Image
          src={`/payments/${method.icon}`}
          alt=""
          width={28}
          height={28}
          unoptimized
          className="size-7 rounded-[8px] ring-1 ring-black/[0.06]"
        />
        {method.name}
      </span>
    );
  }
  return (
    <Image
      src={`/payments/${method.logo}`}
      alt=""
      width={method.width}
      height={method.height}
      unoptimized
      className={`${method.size} w-auto`}
    />
  );
}

/** Your card, then other ways to pay, one after another: `methods` are the visitor's (payments.ts). */
export function PayArt({ methods }: { methods: readonly PaymentId[] }) {
  const stops = [
    CARDS,
    ...methods.map((id) => <Method key={id} id={id} />),
    CARDS,
  ];
  return (
    <div className="flex h-full items-center justify-center px-4 lg:px-6">
      <div className="h-14 w-full max-w-[220px] overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/4%)] ring-1 ring-black/[0.06]">
        <div className="art-pay flex flex-col">
          {stops.map((method, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, with the first repeated to loop
              key={index}
              className="flex h-14 flex-none items-center justify-center"
            >
              {method}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Your card goes into the vault: its number masked, kept to PCI DSS. */
export function VaultArt() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 lg:px-6">
      <div className="flex w-full max-w-[230px] flex-col gap-3 rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/4%)] ring-1 ring-black/[0.06] px-4 py-3.5">
        <span className="flex items-center justify-between">
          <PaymentLogo
            name="visa"
            width={1000}
            height={325}
            className="h-3 w-auto"
          />
          <Lock width={14} height={14} className="text-[#10b45e]" />
        </span>
        <span className="flex gap-2 font-mono text-[13px] tracking-widest whitespace-nowrap text-soft">
          {[0, 1, 2].map((group) => (
            <span key={group} className="relative">
              4242
              <span
                className="art-mask absolute inset-0 bg-white"
                style={{ animationDelay: `${group * 0.15 - 2.25}s` }}
              >
                ••••
              </span>
            </span>
          ))}
          <span>4242</span>
        </span>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/4%)] ring-1 ring-black/[0.06] py-1 pr-2.5 pl-2 text-[11px] font-semibold tracking-wide text-soft">
        <Shield width={12} height={12} className="text-[#10b45e]" />
        PCI DSS
      </span>
    </div>
  );
}

/** A purchase draws down the budget you set, and goes through within it. */
export function GuardrailsArt({ budget }: { budget: string }) {
  return (
    <div className="flex h-full flex-col justify-center gap-4 px-4 lg:px-6">
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-medium text-soft">{budget}</span>
        <div className="flex">
          <Track>
            <span
              className="art-budget mascot-fill absolute inset-0 origin-left rounded-full"
              style={halfway(4.5)}
            />
          </Track>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/4%)] ring-1 ring-black/[0.06] py-3 pr-3 pl-4">
        <span className="flex min-w-0 items-center gap-2 font-mono text-[13px] tracking-widest whitespace-nowrap text-soft">
          <Lock width={14} height={14} />
          •••• 4242
        </span>
        <Done className="art-done-late" style={halfway(4.5)} />
      </div>
    </div>
  );
}

/** An order in your name at the store: you start the return, it's refunded. */
export function ReturnsArt({
  store,
  item,
  started,
  refunded,
}: {
  store: Merchant;
  item: string;
  started: string;
  refunded: string;
}) {
  const states = [
    <span
      key="started"
      className="inline-flex items-center gap-1 rounded-full bg-chip px-2 py-0.5 text-[12px] font-medium text-soft"
    >
      <Clock width={12} height={12} />
      {started}
    </span>,
    <span
      key="refunded"
      className="mascot-fill inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold text-white"
    >
      <Check width={12} height={12} />
      {refunded}
    </span>,
  ];
  return (
    <div className="flex h-full items-center justify-center px-4 lg:px-6">
      <div className="flex w-full max-w-[250px] flex-col gap-2.5 rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/4%)] ring-1 ring-black/[0.06] p-3">
        <span className="flex items-center gap-2.5">
          <StoreIcon store={store} className="size-9 rounded-[10px]" />
          <span className="min-w-0 flex-1 text-[13px] leading-snug font-medium">
            {item}
          </span>
        </span>
        <span className="h-7 overflow-hidden">
          <span className="art-statement flex flex-col" style={halfway(5)}>
            {[...states, states[0]].map((state, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: two states, with the first repeated to loop
                key={index}
                className="flex h-7 flex-none items-center"
              >
                {state}
              </span>
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Assistants that take turns paying through the one signed-in account. */
const AGENTS = ["chatgpt", "grokbot", "claude", "muse"] as const;

/** A store you're signed in to, with the card saved there; `null` for any other store. */
interface Account {
  store: Merchant | null;
  name: string;
}

/**
 * The visitor's stores (markets.ts `accountsFor`) as `brand` words them
 * ("{name} account" in English), then any other store.
 */
function accounts(
  stores: readonly Merchant[],
  any: string,
  brand = "{name}",
): readonly Account[] {
  return [
    ...stores.map((store) => ({
      store,
      name: brand.replace("{name}", store.name),
    })),
    { store: null, name: any },
  ];
}

/** A store's app icon (or logo). */
function StoreIcon({
  store,
  className,
}: {
  store: Merchant;
  className: string;
}) {
  return (
    <Image
      src={store.logo}
      alt=""
      width={36}
      height={36}
      unoptimized
      className={`flex-none object-contain ring-1 ring-black/5 ${className}`}
    />
  );
}

/**
 * The stores one at a time, 1.5s each (art-store), so each assistant's turn
 * (art-agent) and tick (art-tick) gets the next one.
 */
function AccountCycle({
  items,
  render,
}: {
  items: readonly Account[];
  render: (account: Account) => ReactNode;
}) {
  return items.map((account, index) => (
    <span
      key={account.store?.id ?? "any"}
      className="art-store inline-block"
      style={{
        animationDelay: `-${((items.length - index) % items.length) * 1.5}s`,
      }}
    >
      {render(account)}
    </span>
  ));
}

/** A store in the title: its icon in a tile, then its name as part of the text. */
function TitleStore({ store, name }: Account) {
  const [first, ...rest] = name.split(" ");
  return (
    <>
      <span className="whitespace-nowrap">
        {/* Clipped, so its baseline is its bottom edge in every browser; then
            centered on the capitals. */}
        <span className="mr-[0.25em] inline-block size-[1.2em] overflow-hidden rounded-[0.3em] bg-white align-[-0.25em] ring-1 ring-black/10 ring-inset">
          <span className="flex size-full items-center justify-center">
            {store ? (
              <StoreIcon store={store} className="size-full" />
            ) : (
              <Store className="size-[0.75em] text-soft" />
            )}
          </span>
        </span>
        {first}
      </span>
      {rest.length > 0 && ` ${rest.join(" ")}`}
    </>
  );
}

/**
 * "Use your {store}", the store ("Amazon account" in `brand`'s words, or
 * `any`) changing with AccountsArt's. Hidden copies with each store hold the
 * title at its tallest, so the card doesn't jump when a longer name wraps.
 */
export function AccountsTitle({
  stores,
  title,
  brand,
  any,
}: {
  stores: readonly Merchant[];
  title: string;
  brand: string;
  any: string;
}) {
  const items = accounts(stores, any, brand);
  return (
    <span className="grid">
      {items.map((account) => (
        <span
          key={account.store?.id ?? "any"}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1"
        >
          {rich(title, {
            store: (
              <span className="inline-block">
                <TitleStore {...account} />
              </span>
            ),
          })}
        </span>
      ))}
      <span className="col-start-1 row-start-1">
        {rich(title, {
          store: (
            <span
              role="img"
              aria-label={items.map(({ name }) => name).join(", ")}
            >
              <AccountCycle
                items={items}
                render={(account) => <TitleStore {...account} />}
              />
            </span>
          ),
        })}
      </span>
    </span>
  );
}

/** Your store accounts, one after another, each paying with its saved card. */
export function AccountsArt({ stores }: { stores: readonly Merchant[] }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-4 lg:px-6">
      <div className="flex w-full max-w-[230px] items-center gap-3 rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/4%)] ring-1 ring-black/[0.06] py-2.5 pr-3 pl-2.5">
        <span className="flex size-9 flex-none items-center justify-center overflow-hidden rounded-[10px] bg-chip">
          <AccountCycle
            items={accounts(stores, "")}
            render={({ store }) =>
              store ? (
                <StoreIcon store={store} className="size-9" />
              ) : (
                <Store className="size-5 text-soft" />
              )
            }
          />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[13px] tracking-widest whitespace-nowrap text-soft">
          <PaymentLogo
            name="visa"
            width={1000}
            height={325}
            className="h-2.5 w-auto"
          />
          4242
        </span>
        <Done className="art-tick" />
      </div>
      <div className="flex items-center gap-3">
        {AGENTS.map((agent, index) => (
          <Image
            key={agent}
            src={`/assistants/${agent}.png`}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="art-agent size-8 rounded-[9px]"
            style={{
              animationDelay: `-${((AGENTS.length - index) % AGENTS.length) * 1.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** A faint statement line around the one that matters. */
function StatementFiller() {
  return (
    <span className="flex h-7 items-center gap-2.5 opacity-60">
      <span className="size-5 flex-none rounded-md bg-chip" />
      <span className="h-1.5 w-24 rounded-full bg-line" />
      <span className="ml-auto h-1.5 w-10 rounded-full bg-line" />
    </span>
  );
}

/** One line of a card statement: who it says you paid, and what it earned. */
function StatementLine({
  logo,
  name,
  price,
  points,
  earned,
}: {
  logo: ReactNode;
  name: string;
  price: string;
  points: string;
  earned: boolean;
}) {
  return (
    <span className="flex h-12 flex-none items-center gap-2.5">
      <span className="inline-flex size-8 flex-none items-center justify-center rounded-[9px] bg-chip text-muted">
        {logo}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wide text-soft">
        {name}
      </span>
      <span className="flex flex-none flex-col items-end gap-0.5">
        <span className="font-mono text-[12px] text-ink">{price}</span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 text-[11px] font-semibold ${earned ? "mascot-fill text-white" : "bg-chip text-faint"}`}
        >
          <Sparkle width={10} height={10} />
          {points}
        </span>
      </span>
    </span>
  );
}

/**
 * Your card statement after an agent's purchase: with a one-time virtual
 * card it names the card's provider (Link) and earns nothing; with Menta it names the
 * store and earns your card's points.
 */
export function PointsArt({
  store,
  price,
}: {
  store: Merchant;
  price: string;
}) {
  const lines = [
    <StatementLine
      key="virtual"
      logo={<Card width={16} height={16} />}
      name="LINK"
      price={price}
      points="0"
      earned={false}
    />,
    <StatementLine
      key="menta"
      logo={<StoreIcon store={store} className="size-8 rounded-[9px]" />}
      name={store.name.toUpperCase()}
      price={price}
      points="+267"
      earned
    />,
  ];
  return (
    <div className="flex h-full items-center justify-center px-4 lg:px-6">
      <div className="flex w-full max-w-[260px] flex-col divide-y divide-line rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/4%)] ring-1 ring-black/[0.06] px-3 py-1">
        <StatementFiller />
        <div className="h-12 overflow-hidden">
          <div className="art-statement flex flex-col" style={halfway(5)}>
            {[...lines, lines[0]].map((line, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: two lines, with the first repeated to loop
                key={index}
                className="flex"
              >
                {line}
              </span>
            ))}
          </div>
        </div>
        <StatementFiller />
      </div>
    </div>
  );
}

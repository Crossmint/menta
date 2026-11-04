import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { format } from "../../lib/i18n/format";
import { helpPath, type Locale } from "../../lib/i18n/locales";
import { rich } from "../../lib/i18n/rich";
import { getI18n } from "../../lib/i18n/server";
import { origin } from "../../lib/server/user";
import { CROSSMINT_DOCS, LEGAL, REPO_URL, SUPPORT } from "../../lib/site";
import { CrossmintLogo, GitHubMark, XMark } from "../_components/brand-marks";
import {
  Card,
  Chevron,
  Globe,
  InlineLogo,
  Logo,
  Sparkle,
} from "../_components/icons";
import { ASSISTANTS, assistantButton, OTHER_ASSISTANTS } from "./assistants";
import {
  AccountsArt,
  AccountsTitle,
  CardNetworks,
  FasterArt,
  GuardrailsArt,
  PayArt,
  PointsArt,
  ReturnsArt,
  VaultArt,
} from "./benefit-art";
import { localPrice } from "./currency";
import { ExampleTicker } from "./example-ticker";
import { FloatingStores } from "./floating-stores";
import { FooterLeaf } from "./footer-leaf";
import { SiteHeader } from "./header";
import { MarketProvider } from "./market";
import { MarketSwitcher } from "./market-switcher";
import {
  accountsFor,
  type Market,
  type Merchant,
  marketFor,
  merchant,
} from "./markets";
import { paymentsFor } from "./payments";
import { PromptButton } from "./prompt-button";
import { Reveal } from "./reveal";
import { TryMenu } from "./try-menu";
import { UseCases } from "./use-cases";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/** A white card with only a hairline ring, after transitions.dev's gallery (the app's `panel`). */
const hairlineCard = "panel";

/**
 * What you might tell your agent in step 2, at the visitor's own stores;
 * the asks without one (a trip, flowers, a bill) show an icon instead.
 */
const EXAMPLES: readonly {
  key:
    | "reorder"
    | "table"
    | "usual"
    | "dogFood"
    | "cart"
    | "tickets"
    | "sneakers"
    | "dinner"
    | "bill"
    | "trip"
    | "flowers";
  store: (market: Market) => Merchant | null;
  icon?: typeof Globe;
}[] = [
  { key: "reorder", store: (market) => market.roles.marketplace },
  { key: "table", store: (market) => market.roles.tables },
  { key: "usual", store: (market) => market.roles.restaurant },
  { key: "dogFood", store: (market) => market.roles.marketplace },
  { key: "cart", store: (market) => market.roles.grocery },
  { key: "tickets", store: (market) => market.roles.tickets },
  { key: "sneakers", store: () => merchant("newbalance") },
  { key: "dinner", store: (market) => market.roles.delivery },
  { key: "bill", store: () => null, icon: Card },
  { key: "trip", store: () => null, icon: Globe },
  { key: "flowers", store: () => null, icon: Sparkle },
];

/** A step's number, quiet above its title. */
function Step({ number }: { number: number }) {
  return (
    <span className="text-[13px] font-medium text-muted tabular-nums">
      {String(number).padStart(2, "0")}
    </span>
  );
}

/** A step's number and title. */
function StepHeading({ number, title }: { number: number; title: ReactNode }) {
  return (
    <div data-reveal className="flex flex-col gap-1.5">
      <Step number={number} />
      <h3 className="m-0 text-[22px] font-semibold tracking-[-0.03em]">
        {title}
      </h3>
    </div>
  );
}

/** "Add to" and the assistants Menta plugs into, the same as "Get started" offers. */
function AddTo({
  label,
  serverUrl,
  className = "",
}: {
  label: string;
  serverUrl: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <span className="text-[15px] text-quiet">{label}</span>
      <div className="flex gap-2.5">
        {ASSISTANTS.map(({ icon, name }) => (
          <PromptButton
            key={icon}
            serverUrl={serverUrl}
            label={name}
            className="rounded-[12px] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Image
              src={`/assistants/${icon}.png`}
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-[11px] ring-1 ring-black/10"
            />
          </PromptButton>
        ))}
      </div>
    </div>
  );
}

/**
 * A card with a looping picture (benefit-art.tsx) above its title and text.
 * A wide one spans two columns of the bento, with its text beside the picture.
 * One that plays on hover waits, paused, until pointed at, and pauses where it
 * is when left (its art starts on a frame that makes the point); where there's
 * no hover (touch), it plays on its own.
 */
function Feature({
  art,
  heading: Heading,
  title,
  text,
  wide = false,
  playOnHover = false,
}: {
  art: ReactNode;
  heading: "h3" | "h4";
  title: ReactNode;
  /** A line under the title, where the title and picture don't say it all. */
  text?: string;
  wide?: boolean;
  playOnHover?: boolean;
}) {
  return (
    <div
      data-reveal
      className={`flex flex-col gap-4 p-3 pb-5 ${hairlineCard} ${wide ? "md:col-span-2 lg:grid lg:grid-cols-[2fr_3fr] lg:gap-8 lg:pb-3" : ""} ${playOnHover ? "[@media(hover:hover)]:[&:not(:hover)_*]:[animation-play-state:paused]!" : ""}`}
    >
      <div
        aria-hidden="true"
        className={`h-44 overflow-hidden rounded-[14px] bg-[#f9f9f9] ring-1 ring-black/[0.04] ring-inset ${wide ? "lg:order-2 lg:h-full lg:min-h-60" : ""}`}
      >
        {art}
      </div>
      <div
        className={`flex flex-col gap-1.5 px-2 ${wide ? "lg:order-1 lg:justify-end lg:pb-3" : ""}`}
      >
        <Heading className="m-0 text-[17px] font-semibold tracking-[-0.02em]">
          {title}
        </Heading>
        {text ? (
          <p className="m-0 text-[15px] text-pretty text-quiet">{text}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The public homepage, one URL per language (`/`, `/es`, `/ja`…). It sells
 * Menta as a plugin for the assistant you already use, and leads with the
 * reason to add it: it works worldwide.
 */
export async function Landing({
  locale,
  country,
}: {
  locale: Locale;
  /** `?country=XX`, standing in for the visitor's location (to try each market). */
  country?: string | null;
}) {
  const { m, tag } = await getI18n(locale);
  const t = m.landing;
  const detected = (await headers()).get("x-vercel-ip-country");
  const chosen =
    country && /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : null;
  const market = marketFor(chosen ?? detected);
  // The setup prompt the assistants open names this deployment's MCP server.
  const serverUrl = `${origin()}/mcp`;
  const asks: Readonly<Record<string, string>> = t.worldwide.stores;
  const featured = market.featured.map((store) => ({
    ...store,
    ask:
      asks[store.id] ??
      format(t.markets.asks[store.kind], { store: store.name }),
  }));
  const price = localPrice(tag, 89, market);
  const accounts = accountsFor(market);
  const methods = paymentsFor(market.country);
  const trust = [
    { key: "vault", art: <VaultArt /> },
    {
      key: "guardrails",
      art: <GuardrailsArt budget={t.trust.items.guardrails.budget} />,
    },
    {
      key: "returns",
      art: (
        <ReturnsArt
          store={market.roles.marketplace}
          item={t.demo.orders[0].item}
          started={t.trust.items.returns.started}
          refunded={t.trust.items.returns.refunded}
        />
      ),
    },
    {
      key: "points",
      art: <PointsArt store={market.roles.marketplace} price={price} />,
    },
  ] as const;

  return (
    <div
      data-landing
      className="relative overflow-clip bg-white text-[15px] leading-normal text-ink"
    >
      <SiteHeader locale={locale} />

      <MarketProvider market={market}>
        <main>
          {/* White from the very top: it runs up under the header, which is clear until the page scrolls. */}
          <section className="relative z-10 -mt-20 bg-[linear-gradient(#fff_75%,#f7f7f6)] pt-20">
            <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-4 pt-24 pb-28 text-center md:min-h-[620px] md:justify-center md:px-6 md:py-28">
              <a
                href="https://www.crossmint.com"
                {...EXTERNAL}
                className="raised-light rise inline-flex items-center gap-1.5 rounded-full border border-line bg-white/80 px-3 py-1.5 text-[13px] text-quiet hover:text-ink"
              >
                {rich(t.hero.eyebrow, {
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
              <h1 className="rise m-0 max-w-[780px] text-[40px] [--rise-delay:80ms] leading-[1.04] font-semibold tracking-[-0.05em] text-balance md:text-[60px] md:tracking-[-0.055em] lg:text-[72px]">
                {rich(t.hero.title, {
                  accent: (
                    <span className="mascot-text">{t.hero.titleAccent}</span>
                  ),
                })}
              </h1>
              <p className="rise m-0 max-w-[600px] text-base [--rise-delay:120ms] text-pretty text-quiet md:text-lg">
                {t.hero.lede}
              </p>
              <AddTo
                serverUrl={serverUrl}
                label={t.hero.addTo}
                className="rise [--rise-delay:160ms]"
              />
              <div className="rise mt-1 grid w-full max-w-[320px] grid-cols-1 gap-2.5 [--rise-delay:240ms] sm:flex sm:w-auto sm:max-w-none">
                <TryMenu
                  serverUrl={serverUrl}
                  label={t.hero.primary}
                  more={t.hero.more}
                  other={t.how.other}
                  live={t.hero.live}
                />
              </div>
              <FloatingStores featured={featured} ghosts={market.ghosts} />
            </div>
          </section>

          <UseCases />

          {/* Out of the use cases' grey, the way the hero fades into it. */}
          <div className="bg-[linear-gradient(#f7f7f6,#fff_240px)]">
            <section
              id="how"
              className="mx-auto flex max-w-[1200px] scroll-mt-24 flex-col gap-8 px-4 py-16 md:gap-12 md:px-6 md:py-[104px]"
            >
              <h2
                data-reveal
                className="m-0 text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance whitespace-pre-line md:text-[48px] md:tracking-[-0.05em] lg:text-[56px]"
              >
                {rich(t.how.title, {
                  accent: (
                    <span className="mascot-text">{t.how.titleAccent}</span>
                  ),
                })}
              </h2>
              <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
                <li
                  data-reveal
                  className={`flex flex-col gap-6 p-6 md:p-8 ${hairlineCard}`}
                >
                  <StepHeading number={1} title={t.how.add} />
                  <div className="flex flex-wrap gap-2">
                    {ASSISTANTS.map(({ icon, name }) => (
                      <PromptButton
                        key={icon}
                        serverUrl={serverUrl}
                        className={assistantButton}
                      >
                        <Image
                          src={`/assistants/${icon}.png`}
                          alt=""
                          width={32}
                          height={32}
                          className="size-8 rounded-[9px]"
                        />
                        {name}
                        <Chevron
                          width={16}
                          height={16}
                          className="text-muted"
                        />
                      </PromptButton>
                    ))}
                    <PromptButton
                      serverUrl={serverUrl}
                      className={assistantButton}
                    >
                      <span className="flex flex-none -space-x-1.5">
                        {OTHER_ASSISTANTS.map((icon, index) => (
                          <Image
                            key={icon}
                            src={`/assistants/${icon}.png`}
                            alt=""
                            width={24}
                            height={24}
                            className={`size-6 flex-none rounded-[7px] shadow-[0_0_0_2px_#fff,0_0_0_3px_rgb(0_0_0/14%)] ${index >= 1 ? "max-sm:hidden" : ""}`}
                          />
                        ))}
                        <span className="inline-flex h-6 flex-none items-center rounded-[7px] bg-chip px-1.5 text-[12px] leading-none font-semibold text-soft ring-2 ring-white">
                          {t.how.more}
                        </span>
                      </span>
                      {t.how.other}
                      <Chevron width={16} height={16} className="text-muted" />
                    </PromptButton>
                  </div>
                </li>
                <li
                  data-reveal
                  className={`flex flex-col gap-6 p-6 md:p-8 ${hairlineCard}`}
                >
                  <StepHeading number={2} title={t.how.ask} />
                  <ExampleTicker
                    items={[
                      ...EXAMPLES.map(
                        ({ key, store: pick, icon: Icon = Globe }) => {
                          const store = pick(market);
                          return (
                            <p
                              key={key}
                              className="m-0 inline-flex max-w-full min-w-0 items-center gap-2.5 rounded-[18px] rounded-br-md py-2 pr-3.5 pl-2.5 text-[14px] leading-snug whitespace-nowrap sm:text-[15px] bg-[#f9f9f9] ring-1 ring-black/[0.04] ring-inset"
                            >
                              {store ? (
                                <Image
                                  src={store.logo}
                                  alt=""
                                  width={22}
                                  height={22}
                                  unoptimized
                                  className="size-[22px] flex-none rounded-[6px] bg-white object-contain ring-1 ring-black/5"
                                />
                              ) : (
                                <Icon
                                  width={20}
                                  height={20}
                                  className="flex-none text-[#10b45e]"
                                />
                              )}
                              <span className="truncate">
                                {format(t.how.examples[key], {
                                  store: store?.name ?? "",
                                })}
                              </span>
                            </p>
                          );
                        },
                      ),
                    ]}
                  />
                </li>
                <li className="flex flex-col gap-6 pt-6 md:col-span-2 md:pt-10">
                  <StepHeading
                    number={3}
                    title={rich(t.how.handle, { menta: <InlineLogo /> })}
                  />
                  {/* One row only where the race's labels fit, in every language; stacked below. */}
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <Feature
                      art={<FasterArt t={t.how.items.faster.race} tag={tag} />}
                      heading="h4"
                      title={t.how.items.faster.title}
                    />
                    <Feature
                      art={<PayArt methods={methods} />}
                      heading="h4"
                      title={t.how.items.methods.title}
                    />
                    <Feature
                      art={<AccountsArt stores={accounts} />}
                      heading="h4"
                      title={
                        <AccountsTitle
                          stores={accounts}
                          title={t.how.items.accounts.title}
                          brand={t.how.items.accounts.brand}
                          any={t.how.items.accounts.any}
                        />
                      }
                    />
                  </div>
                </li>
              </ol>
            </section>
          </div>

          <section className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-16 md:gap-12 md:px-6 md:pb-[104px]">
            <h2
              data-reveal
              className="m-0 max-w-[820px] text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance md:text-[48px] md:tracking-[-0.05em] lg:text-[56px]"
            >
              {rich(t.trust.title, { menta: <InlineLogo /> })}
            </h2>
            {/* A bento: the vault and the points take two columns, the other two one. */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {trust.map(({ key, art }) => (
                <Feature
                  key={key}
                  art={art}
                  heading="h3"
                  wide={key === "vault" || key === "points"}
                  playOnHover
                  title={rich(t.trust.items[key].title, {
                    networks: <CardNetworks inline />,
                  })}
                  text={t.trust.items[key].text}
                />
              ))}
            </div>
          </section>

          {/* In the hero's grey, solid. */}
          <section className="mx-auto max-w-[1200px] px-4 md:px-6">
            <div className="grid grid-cols-1 gap-6 rounded-[28px] bg-stage p-6 md:grid-cols-2 md:items-end md:gap-10 md:p-10 lg:p-12">
              <div data-reveal className="flex flex-col gap-4">
                <a
                  href="https://www.crossmint.com"
                  {...EXTERNAL}
                  className="inline-flex items-center gap-1.5 self-start text-[13px] text-quiet hover:text-ink"
                >
                  {rich(t.hero.eyebrow, {
                    crossmint: (
                      <CrossmintLogo
                        role="img"
                        aria-label="Crossmint"
                        aria-hidden={undefined}
                        className="h-[15px] w-auto text-ink"
                      />
                    ),
                  })}
                </a>
                <h2 className="m-0 text-[32px] leading-[1.05] font-semibold tracking-[-0.045em] md:text-[44px] md:tracking-[-0.05em] md:whitespace-pre-line">
                  {t.crossmint.title}
                </h2>
              </div>
              <div data-reveal className="flex flex-col gap-5">
                <p className="m-0 text-pretty text-quiet md:text-[17px]">
                  {rich(t.crossmint.text, {
                    menta: (
                      <span className="mx-0.5 inline-block align-[-3px]">
                        <Logo size={17} />
                      </span>
                    ),
                  })}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <a
                    href={REPO_URL}
                    {...EXTERNAL}
                    className="raised-light inline-flex h-11 items-center gap-2 rounded-full border border-line-card bg-white pr-5 pl-4 font-medium transition-colors hover:border-line-strong"
                  >
                    <GitHubMark width={18} height={18} />
                    {t.crossmint.github}
                  </a>
                  <a
                    href={CROSSMINT_DOCS.agents}
                    {...EXTERNAL}
                    className="inline-flex h-11 items-center rounded-full px-3 text-quiet transition-colors hover:text-ink"
                  >
                    {t.crossmint.docs}
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>
      </MarketProvider>

      {/* The last ask, over Menta's leaf rising behind it from the page's end. */}
      <footer className="relative overflow-hidden">
        <FooterLeaf className="pointer-events-none absolute top-20 left-1/2 w-[min(400px,76vw)] -translate-x-[85%] md:top-24" />
        <div
          data-reveal
          className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-4 pt-40 pb-32 text-center md:px-6 md:pt-48 md:pb-40"
        >
          <h2 className="m-0 text-[30px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance md:text-[40px] md:tracking-[-0.05em]">
            {t.footer.title}
          </h2>
          <p className="m-0 max-w-[520px] text-base text-pretty text-quiet">
            {t.footer.text}
          </p>
          <AddTo label={t.hero.addTo} serverUrl={serverUrl} className="mt-3" />
          <div className="mt-3 grid w-full max-w-[320px] grid-cols-1 sm:flex sm:w-auto sm:max-w-none">
            <TryMenu
              serverUrl={serverUrl}
              label={t.hero.primary}
              more={t.hero.more}
              other={t.how.other}
              live={t.hero.live}
              up
            />
          </div>
        </div>
        <div className="relative border-t border-line bg-white">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-[13px] text-quiet md:px-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>
                {format(t.footer.rights, {
                  year: String(new Date().getFullYear()),
                })}
              </span>
              <Link
                href={LEGAL.terms}
                className="transition-colors hover:text-ink"
              >
                {m.help.legal.terms}
              </Link>
              <Link
                href={LEGAL.privacy}
                className="transition-colors hover:text-ink"
              >
                {m.help.legal.privacy}
              </Link>
              {process.env.VERCEL_ENV === "production" ? null : (
                <MarketSwitcher current={chosen} detected={detected} />
              )}
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <a
                href={SUPPORT.x}
                {...EXTERNAL}
                aria-label={`X ${SUPPORT.handle}`}
                className="inline-flex items-center transition-colors hover:text-ink"
              >
                <XMark width={13} height={13} />
              </a>
              <a
                href={REPO_URL}
                {...EXTERNAL}
                className="transition-colors hover:text-ink"
              >
                GitHub
              </a>
              <a
                href={CROSSMINT_DOCS.agents}
                {...EXTERNAL}
                className="transition-colors hover:text-ink"
              >
                {t.footer.docs}
              </a>
              <Link
                href={helpPath(locale)}
                className="transition-colors hover:text-ink"
              >
                {t.nav.help}
              </Link>
              <a
                href="https://www.crossmint.com"
                {...EXTERNAL}
                className="transition-colors hover:text-ink"
              >
                Crossmint
              </a>
            </nav>
          </div>
        </div>
      </footer>
      <Reveal />
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { format } from "../../lib/i18n/format";
import type { Locale } from "../../lib/i18n/locales";
import { rich } from "../../lib/i18n/rich";
import { getI18n } from "../../lib/i18n/server";
import { LEGAL, SUPPORT, siteOrigin } from "../../lib/site";
import { ClaudeMark, OpenAIMark } from "../_components/brand-marks";
import { Plug } from "../_components/icons";
import { DocLink, DocSection, DocumentPage, DocumentTitle } from "./document";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

const inlineLink =
  "font-medium text-leaf underline decoration-leaf/30 underline-offset-2 hover:decoration-leaf";

/** A place in an assistant's own UI, linked when it has a URL (as on Install). */
function Path({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) {
    return <span className="font-medium text-ink">{children}</span>;
  }
  return (
    <a
      href={href}
      {...EXTERNAL}
      className="font-medium text-ink underline decoration-neutral-300 underline-offset-2 hover:decoration-ink"
    >
      {children}
    </a>
  );
}

/** An assistant's mark on a white tile, its name, and how to add Menta there. */
function App({
  mark,
  name,
  children,
}: {
  mark: ReactNode;
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em] text-ink">
        <span className="flex size-8 flex-none items-center justify-center rounded-[9px] bg-white ring-1 ring-black/[0.08] [&_svg]:size-[18px]">
          {mark}
        </span>
        {name}
      </h3>
      {children}
    </div>
  );
}

function Steps({ steps }: { steps: readonly ReactNode[] }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {steps.map((step, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one app's fixed steps, in order
        <li key={index} className="flex gap-3">
          <span className="w-4 flex-none text-[13px] leading-[1.6] font-medium text-muted tabular-nums">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The public help page, one URL per language (`/help`, `/es/help`…): what
 * Menta is, how to add it, how a purchase works, and where cards, addresses
 * and orders live. It's the documentation the assistant directories link to,
 * so it needs no account.
 */
export async function Help({ locale }: { locale: Locale }) {
  const { m } = await getI18n(locale);
  const t = m.help;
  const install = t.install;
  const signIn = install.signIn;
  const serverUrl = `${siteOrigin()}/mcp`;

  const chatgpt = install.apps.chatgpt.map((step) =>
    rich(step, {
      plugins: (
        <Path href="https://chatgpt.com/plugins">
          {install.apps.chatgptPaths.plugins}
        </Path>
      ),
      add: <Path>{install.apps.chatgptPaths.add}</Path>,
      oauth: <Path>{install.apps.chatgptPaths.oauth}</Path>,
      create: <Path>{install.apps.chatgptPaths.create}</Path>,
      signIn,
    }),
  );
  const claude = install.apps.claude.map((step) =>
    rich(step, {
      connectors: (
        <Path href="https://claude.ai/customize/connectors">
          {install.apps.claudePaths.connectors}
        </Path>
      ),
      add: <Path>{install.apps.claudePaths.add}</Path>,
      confirm: <Path>{install.apps.claudePaths.confirm}</Path>,
      signIn,
    }),
  );
  return (
    <DocumentPage locale={locale}>
      <DocumentTitle
        title={t.title}
        after={
          <p className="m-0 max-w-[620px] text-base text-pretty text-quiet md:text-lg">
            {t.lede}
          </p>
        }
      />

      <DocSection id="install" title={t.install.title}>
        <p>{t.install.lede}</p>
        <div className="well flex flex-col gap-1 rounded-[14px] px-4 py-3">
          <span className="text-[13px] text-muted">{t.install.server}</span>
          <code className="font-mono text-[14px] break-all text-ink select-all">
            {serverUrl}
          </code>
        </div>
        <div className="flex flex-col gap-6 pt-3">
          <App mark={<OpenAIMark className="text-ink" />} name="ChatGPT">
            <p>
              {format(t.install.listed, {
                directory: t.install.chatgptDirectory,
              })}
            </p>
            <Steps steps={chatgpt} />
          </App>
          <App mark={<ClaudeMark />} name="Claude">
            <p>
              {format(t.install.listed, {
                directory: t.install.claudeDirectory,
              })}
            </p>
            <Steps steps={claude} />
          </App>
          <App
            mark={
              <Image
                src="/assistants/grokbot.png"
                alt=""
                width={32}
                height={32}
                className="size-full rounded-[9px]"
              />
            }
            name="Grok Bot"
          >
            <p>{t.install.grokBot}</p>
          </App>
          <App
            mark={<Plug strokeWidth={1.8} className="text-soft" />}
            name={install.otherApp}
          >
            <p>{install.apps.other[1]}</p>
          </App>
        </div>
      </DocSection>

      <DocSection id="purchase" title={t.purchase.title}>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {t.purchase.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="w-5 flex-none pt-0.5 text-[13px] font-medium text-muted tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-0.5">
                <h3 className="m-0 text-[16px] font-semibold text-ink">
                  {step.title}
                </h3>
                <p>
                  {format(step.text, {
                    example: install.example,
                  })}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p>
          <strong>{t.purchase.never}</strong>
        </p>
      </DocSection>

      <DocSection id="cards" title={t.saved.title}>
        <p>
          {rich(t.saved.cards, {
            wallet: (
              <Link href="/wallet" className={inlineLink}>
                {m.app.nav.wallet}
              </Link>
            ),
          })}
        </p>
        <p>
          {rich(t.saved.addresses, {
            addresses: (
              <Link href="/settings/delivery-addresses" className={inlineLink}>
                {m.app.nav.addresses}
              </Link>
            ),
          })}
        </p>
        <p className="text-[14px] text-muted">{t.saved.signIn}</p>
      </DocSection>

      <DocSection id="orders" title={t.orders.title}>
        <p>
          {rich(t.orders.text, {
            transactions: (
              <Link href="/activity" className={inlineLink}>
                {m.app.nav.transactions}
              </Link>
            ),
          })}
        </p>
        <p>{t.orders.store}</p>
      </DocSection>

      <DocSection id="limits" title={t.limits.title}>
        <ul>
          {t.limits.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DocSection>

      <DocSection id="contact" title={t.contact.title}>
        <p>
          {rich(t.contact.text, {
            email: (
              <DocLink href={`mailto:${SUPPORT.email}`}>
                {SUPPORT.email}
              </DocLink>
            ),
            x: <DocLink href={SUPPORT.x}>{SUPPORT.handle}</DocLink>,
          })}
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href={LEGAL.terms} className={inlineLink}>
            {t.legal.terms}
          </Link>
          <Link href={LEGAL.privacy} className={inlineLink}>
            {t.legal.privacy}
          </Link>
        </p>
      </DocSection>
    </DocumentPage>
  );
}

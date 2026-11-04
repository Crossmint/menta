import type { ReactNode } from "react";
import type { Locale } from "../../lib/i18n/locales";
import { SiteHeader } from "./header";

/**
 * A page that reads like a document (help, the terms, the privacy policy):
 * the site's header, then one white column of headings and text.
 */
export function DocumentPage({
  locale,
  lang,
  children,
}: {
  /** The header's language. */
  locale: Locale;
  /** The document's own language, when it differs from the header's. */
  lang?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-landing
      className="relative overflow-clip bg-white text-[15px] leading-normal text-ink"
    >
      <SiteHeader locale={locale} />
      <main className="-mt-20 pt-20">
        <article
          lang={lang}
          className="mx-auto flex max-w-[760px] flex-col gap-10 px-4 pt-12 pb-20 md:px-6 md:pt-20 md:pb-28"
        >
          {children}
        </article>
      </main>
    </div>
  );
}

/** A document's title, with what goes above and under it. */
export function DocumentTitle({
  title,
  before,
  after,
}: {
  title: string;
  before?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {before}
      <h1 className="m-0 text-[40px] leading-[1.04] font-semibold tracking-[-0.05em] text-balance md:text-[56px] md:tracking-[-0.055em]">
        {title}
      </h1>
      {after}
    </header>
  );
}

/** A document's text: paragraphs, lists and emphasis in its quiet body type. */
export const prose =
  "flex flex-col gap-3 text-[16px] leading-relaxed text-pretty text-quiet [&_p]:m-0 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5";

/** A part of a document, with its heading (numbered in the legal ones). */
export function DocSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number?: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-24 flex-col gap-3"
    >
      <h2
        id={`${id}-title`}
        className="m-0 text-[22px] font-semibold tracking-[-0.03em]"
      >
        {number === undefined ? title : `${number}. ${title}`}
      </h2>
      <div className={prose}>{children}</div>
    </section>
  );
}

/** A link in a document's text. */
export function DocLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="font-medium text-leaf underline decoration-leaf/30 underline-offset-2 hover:decoration-leaf"
    >
      {children}
    </a>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "../../lib/i18n/client";
import { ArrowLeft } from "../_components/icons";
import { PANE_ID } from "../_components/pane";

/**
 * A table's card that runs edge to edge on phones (square, hairlines above
 * and below), where its rounded inset would only cost width; a hairline card
 * from `sm` up.
 */
export const bleed =
  "panel max-sm:-mx-4 max-sm:rounded-none max-sm:shadow-[inset_0_1px_0_rgb(0_0_0/6%),inset_0_-1px_0_rgb(0_0_0/6%)]";

export const pageTitle =
  "text-[32px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[40px] sm:tracking-[-0.05em]";

/**
 * A back arrow and the page's name, centered: phones' header on every page,
 * and every width's on a settings section. The arrow is a 48px target.
 */
export function BackHeader({
  href,
  title,
  heading = true,
  tool,
  className = "",
}: {
  href: string;
  title: string;
  /** A control at the right (Activity's search). */
  tool?: ReactNode;
  /** The page's heading; false when the page shows its own. */
  heading?: boolean;
  className?: string;
}) {
  const Title = heading ? "h1" : "p";
  const { m } = useI18n();
  return (
    <header
      // Sticky, so the way back and the section's name stay while it scrolls.
      className={`sticky top-0 z-20 flex h-14 flex-none items-center justify-center bg-white/90 px-14 backdrop-blur ${className}`}
    >
      <Link
        href={href}
        aria-label={m.app.nav.back}
        className="tap absolute left-1 inline-flex size-12 items-center justify-center rounded-full text-ink transition-colors hover:bg-black/[0.04]"
      >
        <ArrowLeft width={22} height={22} strokeWidth={2} />
      </Link>
      <Title className="m-0 truncate text-[17px] font-semibold tracking-[-0.02em]">
        {title}
      </Title>
      {tool ? <div className="absolute right-1 flex">{tool}</div> : null}
    </header>
  );
}

/**
 * A signed-in page: on phones a back arrow to Home and the page's name, from
 * `md` up a large title; then a line about it, and the page.
 */
export function PageShell({
  title,
  lede,
  heading,
  titleHidden = false,
  action,
  tool,
  back = "/home",
  pane = false,
  children,
}: {
  /** A details pane at the right on wide screens (pane.tsx's DetailPane fills it). */
  pane?: boolean;
  /** The page shows its own heading (Home's welcome): the title is for screen readers only. */
  titleHidden?: boolean;
  /** A control beside the title: phones' header's right, wider screens' title row. */
  tool?: ReactNode;
  title: string;
  /** A large heading at every width in place of the title (a welcome); phones' header keeps the title. */
  heading?: string;
  lede?: ReactNode;
  action?: ReactNode;
  /** Where phones' back arrow goes. */
  back?: string;
  children: ReactNode;
}) {
  const page = (
    <main className="flex min-h-dvh min-w-0 flex-1 flex-col">
      <BackHeader
        href={back}
        title={title}
        heading={!heading && !titleHidden}
        tool={tool}
        className="px-2 md:hidden"
      />
      <div className="px-4 pt-2 pb-16 sm:px-8 md:pt-14">
        {/* A page with a pane (a list and its details) fills the width beside the sidebar, up to the pane; others are a centered column. */}
        <div
          className={`flex w-full flex-col gap-9 animate-[fade-in_200ms_ease-out] max-md:gap-7 motion-reduce:animate-none ${pane ? "" : "mx-auto max-w-[720px]"}`}
        >
          {lede || action ? (
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex max-w-[560px] flex-col gap-2">
                <h1
                  className={heading ? pageTitle : `${pageTitle} max-md:hidden`}
                >
                  {heading ?? title}
                </h1>
                {lede ? (
                  <p className="text-[15px] text-pretty text-quiet">{lede}</p>
                ) : null}
              </div>
              {action}
            </header>
          ) : (
            <div className="flex items-center justify-between gap-4 max-md:contents">
              <h1
                className={
                  titleHidden
                    ? "sr-only"
                    : heading
                      ? pageTitle
                      : `${pageTitle} max-md:hidden`
                }
              >
                {heading ?? title}
              </h1>
              {tool ? <div className="max-md:hidden">{tool}</div> : null}
            </div>
          )}
          {children}
        </div>
      </div>
    </main>
  );
  if (!pane) {
    return page;
  }
  return (
    <div className="flex min-h-dvh">
      {page}
      {/* Sticky to the window, so the details stay in view while the list scrolls. Kept
          even while empty (no border then), so the list never moves to the center. */}
      <aside
        id={PANE_ID}
        className="sticky top-0 hidden h-dvh w-[400px] flex-none overflow-y-auto overscroll-contain border-l border-black/[0.06] bg-white empty:border-transparent min-[72rem]:block"
      />
    </div>
  );
}

/**
 * A settings section on its own page: the back arrow and its name on top at
 * every width, the content centered under it. It slides in from the right,
 * like a step forward.
 */
export function SubPage({
  title,
  back = "/settings",
  children,
}: {
  title: string;
  back?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col px-2 sm:px-8">
      <div className="mx-auto flex w-full max-w-[560px] flex-col pb-16 md:pt-8">
        <BackHeader href={back} title={title} />
        <div className="flex flex-col gap-6 px-2 pt-4 motion-safe:animate-[step-in_240ms_cubic-bezier(0.22,1,0.36,1)] sm:px-0">
          {children}
        </div>
      </div>
    </main>
  );
}

/** A titled block on a page. */
export function PageSection({
  id,
  title,
  lede,
  action,
  children,
}: {
  id: string;
  title: string;
  lede?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id={`${id}-title`}
          className="text-[20px] font-semibold tracking-[-0.03em]"
        >
          {title}
        </h2>
        {action}
        {lede ? (
          <p className="basis-full text-[13px] text-pretty text-muted">
            {lede}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

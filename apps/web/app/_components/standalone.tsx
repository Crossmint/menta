import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./icons";

const COLUMN = {
  outcome: "max-w-[480px]",
  step: "max-w-[520px]",
  wide: "max-w-[640px]",
} as const;

/**
 * A page outside the signed-in app (the secure checkout, an assistant asking
 * for access, a 404): the homepage's header over its hero, white fading into
 * the soft grey, with the content centered. `aside` sits at the header's end:
 * who's signed in, or which assistant sent you here.
 */
export function Standalone({
  aside,
  home = "/",
  size = "outcome",
  children,
}: {
  aside?: ReactNode;
  /** Where the logo goes: the homepage, or the app's Install for a page only signed-in people reach. */
  home?: string;
  /** An outcome; a step with a form (approving a payment); a two-column choice (an assistant asking for access). */
  size?: keyof typeof COLUMN;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[linear-gradient(#fff_45%,var(--color-stage))]">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 p-4 md:px-6 md:py-[18px]">
        <Link href={home} className="inline-flex flex-none">
          <Logo size={24} />
        </Link>
        {aside}
      </header>
      <main
        className={`mx-auto flex w-full flex-1 flex-col justify-center gap-6 px-4 pt-6 pb-16 md:pb-24 ${COLUMN[size]}`}
      >
        {children}
      </main>
    </div>
  );
}

const TILE = {
  done: "mascot-fill text-white",
  plain: "bg-white text-ink ring-1 ring-black/[0.06]",
  attention: "bg-white text-attention ring-1 ring-black/[0.06]",
} as const;

/**
 * How something ended, said once and big: an icon tile like the homepage's
 * store icons, a title, a line, then what there is to do next.
 */
export function Outcome({
  icon,
  art,
  tone = "plain",
  title,
  lede,
  children,
}: {
  icon?: ReactNode;
  /** An illustration in place of the icon tile (the tipped cart of an expired request or a cancelled checkout). */
  art?: ReactNode;
  tone?: keyof typeof TILE;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {art ? (
        <span className="rise">{art}</span>
      ) : (
        <span
          className={`rise inline-flex size-16 items-center justify-center rounded-[22%] shadow-[0_12px_28px_-12px_rgb(0_0_0/35%)] ${TILE[tone]}`}
        >
          {icon}
        </span>
      )}
      <div className="rise flex flex-col items-center gap-2.5 [--rise-delay:60ms]">
        <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance md:text-[40px] md:tracking-[-0.05em]">
          {title}
        </h1>
        {lede ? (
          <p className="max-w-[38ch] text-[16px] text-pretty text-quiet [&_a,&_button]:text-ink [&_a,&_button]:underline [&_a,&_button]:decoration-line-strong [&_a,&_button]:underline-offset-[3px] [&_a:hover,&_button:hover]:decoration-ink">
            {lede}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="rise flex w-full flex-col items-center gap-4 [--rise-delay:120ms]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** The one thing to do next on a standalone page: the homepage's raised black pill. */
export const primaryAction =
  "raised inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-white hover:bg-ink-hover disabled:opacity-50";

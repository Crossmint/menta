"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAccount } from "../../lib/client/account";
import { ArrowOut, Chevron } from "../_components/icons";
import { Avatar } from "../_components/sidebar";

/**
 * A grey card of rows, like iOS settings: Settings' groups and phones' Home.
 * As quiet as the sidebar: its grey, regular weight, soft text.
 */
export function ListGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-black/[0.04] overflow-hidden rounded-[20px] bg-stage">
      {children}
    </div>
  );
}

const row =
  "flex min-h-[52px] w-full items-center gap-3.5 px-4.5 py-3 text-left text-[15px]";

/**
 * One row: an icon, a name and, on the right, its value. A link goes to a
 * page (chevron) or out (arrow); a button acts here; neither only shows.
 */
export function ListRow({
  icon,
  label,
  value,
  href,
  external = false,
  onClick,
  disabled = false,
  danger = false,
  dialog = false,
  wrap = false,
}: {
  icon?: ReactNode;
  label: string;
  value?: ReactNode;
  href?: string;
  /** Opens another site or a document in a new tab. */
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** The button opens a dialog. */
  dialog?: boolean;
  /** The value wraps rather than truncates: a detail to read in full (an order number). */
  wrap?: boolean;
}) {
  const body = (
    <>
      {icon ? (
        <span
          aria-hidden="true"
          className={`flex-none ${danger ? "text-danger" : "text-muted"}`}
        >
          {icon}
        </span>
      ) : null}
      <span className={`flex-none ${danger ? "text-danger" : "text-soft"}`}>
        {label}
      </span>
      <span
        className={`ml-auto min-w-0 text-right text-muted tabular-nums ${wrap ? "[overflow-wrap:anywhere]" : "truncate"}`}
      >
        {value}
      </span>
      {href ? (
        external ? (
          <ArrowOut width={18} height={18} className="flex-none text-muted" />
        ) : (
          <Chevron width={16} height={16} className="flex-none text-muted" />
        )
      ) : null}
    </>
  );
  const interactive =
    "transition-colors hover:bg-black/[0.04] hover:text-ink focus-visible:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset";
  if (href) {
    return external ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={`${row} ${interactive}`}
      >
        {body}
      </a>
    ) : (
      <Link href={href} className={`${row} ${interactive}`}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-haspopup={dialog ? "dialog" : undefined}
        className={`${row} ${interactive} disabled:opacity-50`}
      >
        {body}
      </button>
    );
  }
  return <div className={row}>{body}</div>;
}

/** Who is signed in, large and centered: Settings' and phones' Home's top. Placeholders hold its size while the account loads. */
export function ProfileHeader() {
  const { me } = useAccount();
  return (
    <header className="flex flex-col items-center gap-1 pb-3 text-center">
      {me ? (
        <>
          <Avatar me={me} className="mb-3 size-20 text-[28px]" />
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.035em] [overflow-wrap:anywhere]">
            {me.name ?? me.email}
          </h1>
          {me.name && me.email ? (
            <p className="m-0 text-[15px] text-quiet [overflow-wrap:anywhere]">
              {me.email}
            </p>
          ) : null}
        </>
      ) : (
        <div aria-hidden="true" className="flex flex-col items-center gap-1">
          <span className="mb-3 size-20 animate-pulse rounded-full bg-chip" />
          <span className="my-1 h-6 w-48 animate-pulse rounded-full bg-chip" />
          <span className="my-1 h-4 w-36 animate-pulse rounded-full bg-chip" />
        </div>
      )}
    </header>
  );
}

/**
 * The top of a details panel, like a card's: Close at the right, then a large
 * icon, the name and one quiet line, centered.
 */
export function DetailHeader({
  id,
  icon,
  title,
  sub,
  close,
}: {
  /** The title's id, which the panel is labelled by. */
  id: string;
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  close: ReactNode;
}) {
  return (
    <>
      {close ? <div className="flex justify-end">{close}</div> : null}
      <header
        className={`flex flex-col items-center gap-1 text-center ${close ? "-mt-4" : "pt-4"}`}
      >
        <span className="mb-3">{icon}</span>
        <h2
          id={id}
          className="m-0 max-w-full text-[22px] font-semibold tracking-[-0.03em] [overflow-wrap:anywhere]"
        >
          {title}
        </h2>
        {sub ? (
          <p className="m-0 text-[15px] text-pretty text-quiet tabular-nums">
            {sub}
          </p>
        ) : null}
      </header>
    </>
  );
}

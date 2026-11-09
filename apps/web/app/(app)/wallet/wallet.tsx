"use client";

import type { SavedCard } from "@oca/agent/approval";
import { cardBrandArt, cardLabel } from "@oca/agent/card-brands";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useI18n } from "../../../lib/i18n/client";
import { rich } from "../../../lib/i18n/rich";
import { Bag, Chevron, Plus, Trash } from "../../_components/icons";
import { InfoTip } from "../../_components/info-tip";
import { CloseButton, ConfirmModal } from "../../_components/modal";
import { DetailPane, usePanePick } from "../../_components/pane";
import { PoweredByCrossmint } from "../../_components/powered-by";
import {
  CardRowSkeleton,
  LimitSkeleton,
  RowSkeleton,
} from "../../_components/row-skeleton";
import { MerchantIcon, useFormat } from "../activity/table";
import { DetailHeader, ListGroup, ListRow } from "../list";
import { bleed, PageShell } from "../page-shell";
import { ApprovalTile, NewApproval } from "./new-approval";

// Every loading stage (the chunk, Crossmint's credentials, the list) shows the
// same skeleton row, so the card list fills in without jumping.
const CrossmintScope = dynamic(
  () => import("../../_components/crossmint").then((m) => m.CrossmintScope),
  { ssr: false, loading: () => <ListSkeleton /> },
);
const CardManager = dynamic(
  () => import("../../_components/crossmint").then((m) => m.CardManager),
  { ssr: false, loading: () => <ListSkeleton /> },
);

function ListSkeleton() {
  return (
    <div className={`${bleed} overflow-hidden`}>
      <CardRowSkeleton />
    </div>
  );
}

/** What GET /api/crossmint/order-intents returns per approval (OrderIntentView). */
export interface Approval {
  readonly orderIntentId: string;
  /** The saved card it's on. */
  readonly paymentMethodId: string;
  readonly description: string;
  readonly merchant: {
    readonly name: string | null;
    readonly url: string | null;
  } | null;
  readonly amount: {
    readonly total: string;
    readonly spent: string;
    readonly available: string;
    readonly currency: string;
  };
  readonly status: "active" | "cancelled" | "expired";
  readonly expiresAt: string;
}

type Shown = "active" | "used" | "cancelled" | "expired";

/**
 * An active limit with nothing left to spend reads as used, and one past its
 * expiry as expired, even before Crossmint's status catches up.
 */
export function shown(approval: Approval): Shown {
  if (approval.status !== "active") {
    return approval.status;
  }
  if (Date.parse(approval.expiresAt) <= Date.now()) {
    return "expired";
  }
  if (
    Number(approval.amount.available) <= 0 &&
    Number(approval.amount.spent) > 0
  ) {
    return "used";
  }
  return "active";
}

/** Active limits first, then used, then expired and revoked; otherwise as Crossmint lists them. */
const RANK: Record<Shown, number> = {
  active: 0,
  used: 1,
  expired: 2,
  cancelled: 3,
};
export function ordered(list: readonly Approval[]) {
  return [...list].sort((a, b) => RANK[shown(a)] - RANK[shown(b)]);
}

const tone: Record<Shown, string> = {
  // The landing's green (the leaf gradient's #10b45e), deep enough for the
  // small text to read at 4.5:1 on its tint. Only the details show it, on
  // white: an active row shows its expiry instead.
  active: "bg-[#10b45e]/[0.12] text-[#07783f]",
  // White with a hairline, so they show on a selected row's grey too.
  used: "bg-white text-soft ring-1 ring-black/[0.08] ring-inset",
  cancelled: "bg-white text-muted ring-1 ring-black/[0.08] ring-inset",
  expired: "bg-white text-muted ring-1 ring-black/[0.08] ring-inset",
};

/** The store's site ("amazon.com"), when the approval names one. */
function site(approval: Approval) {
  try {
    return approval.merchant?.url
      ? new URL(approval.merchant.url).hostname.replace(/^www\./, "")
      : null;
  } catch {
    return null;
  }
}

export function store(approval: Approval) {
  return approval.merchant?.name || site(approval);
}

/**
 * Spending limit, used and expires; the same grid for the header and every
 * row. Phones fold used under the name, as a card's details do, and keep the
 * expiry at the right. Revoking is in its details.
 */
const approvalColumns =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(72px,auto)] sm:gap-4";

/** A store's icon for an approval at one store, else a quiet bag. */
export function ApprovalIcon({
  approval,
  hero = false,
}: {
  approval: Approval;
  /** The details panel's large icon. */
  hero?: boolean;
}) {
  const where = site(approval);
  if (where) {
    return (
      <MerchantIcon
        site={where}
        className={
          hero
            ? "size-16 rounded-[18px] text-[24px]"
            : "size-9 rounded-[10px] text-[14px]"
        }
      />
    );
  }
  return hero ? (
    <span
      aria-hidden="true"
      className="inline-flex size-16 items-center justify-center rounded-[18px] bg-chip text-muted ring-1 ring-black/[0.04]"
    >
      <Bag width={26} height={26} />
    </span>
  ) : (
    <ApprovalTile />
  );
}

/**
 * An approval's details, in the app's side panel (a sheet on phones): what's
 * used and left, the card it's on, its store, its status and the exact time
 * it expires; Cancel while it's active. Crossmint doesn't say when it was made.
 */
function ApprovalDetail({
  approval,
  card,
  onCancel,
  onClose,
}: {
  approval: Approval;
  card: SavedCard | null;
  onCancel: () => void;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const t = m.app.wallet;
  const { money, moment } = useFormat();
  const state = shown(approval);
  const { currency } = approval.amount;
  const name = store(approval) ?? (approval.description || t.unknownStore);
  const expired = Date.parse(approval.expiresAt) < Date.now();
  return (
    <DetailPane labelledBy="approval-title" onClose={onClose}>
      {(close) => (
        <div className="flex min-h-full flex-col gap-6 p-5 sm:p-6">
          <DetailHeader
            id="approval-title"
            icon={<ApprovalIcon approval={approval} hero />}
            title={name}
            sub={money(approval.amount.total, currency)}
            close={
              close ? (
                <CloseButton label={t.detail.close} onClick={close} />
              ) : null
            }
          />
          <ListGroup>
            <ListRow
              label={
                // Used counts every payment a checkout made, even one that
                // didn't go through: people read that as money taken.
                <span className="inline-flex items-center gap-1.5">
                  {t.detail.used}
                  <InfoTip
                    label={t.detail.usedHelpLabel}
                    text={t.detail.usedHelp}
                  />
                </span>
              }
              value={money(approval.amount.spent, currency)}
            />
            <ListRow
              label={t.detail.left}
              value={money(approval.amount.available, currency)}
            />
            <ListRow
              label={t.detail.store}
              value={store(approval) ?? t.detail.anyStore}
              wrap
            />
            <ListRow
              label={t.detail.status}
              value={
                <span
                  className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${tone[state]}`}
                >
                  {t.status[state]}
                </span>
              }
            />
            <ListRow
              label={expired ? t.detail.expired : t.detail.expires}
              value={moment(approval.expiresAt)}
            />
          </ListGroup>
          {/* With a store as the title, its name (agents can write long ones) in full here. */}
          {approval.description && store(approval) ? (
            <section className="flex flex-col gap-1.5">
              <h3 className="m-0 px-1 text-[13px] font-medium text-muted">
                {t.create.name}
              </h3>
              <p className="m-0 rounded-[20px] bg-stage px-4.5 py-3.5 text-[15px] whitespace-pre-line text-pretty text-soft [overflow-wrap:anywhere]">
                {approval.description}
              </p>
            </section>
          ) : null}
          {card ? (
            // Its card opens in Wallet, with its details.
            <ListGroup>
              <ListRow
                icon={
                  <svg
                    viewBox="0 0 34 22"
                    width={34}
                    height={22}
                    className="block"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: our own brand marks (card-brands.ts), no user input
                    dangerouslySetInnerHTML={{
                      __html: cardBrandArt(card.brand),
                    }}
                  />
                }
                label={t.detail.card}
                value={
                  card.name ? `${card.name} ·· ${card.last4}` : cardLabel(card)
                }
                href={`/wallet?card=${encodeURIComponent(card.paymentMethodId)}`}
              />
            </ListGroup>
          ) : null}
          {state === "active" ? (
            <ListGroup>
              <ListRow
                icon={<Trash width={20} height={20} />}
                label={t.detail.cancel}
                danger
                dialog
                onClick={() => {
                  close?.();
                  onCancel();
                }}
              />
            </ListGroup>
          ) : null}
        </div>
      )}
    </DetailPane>
  );
}

/** A limit that can't pay any more: it expired or the user revoked it. */
function ended(approval: Approval) {
  const state = shown(approval);
  return state === "expired" || state === "cancelled";
}

/**
 * A limits table's expired and revoked rows, under its toggle row: they open
 * and close by easing their height and fading, and while closed they are
 * inert. The rows draw their own lines, so a closed table ends at the toggle.
 */
function EndedRows({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      className={`grid !border-t-0 transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
    >
      <div
        className={`min-h-0 overflow-hidden transition-opacity duration-300 motion-reduce:transition-none [&>*]:border-t [&>*]:border-black/[0.05] ${open ? "opacity-100" : "opacity-0"}`}
      >
        {children}
      </div>
    </div>
  );
}

/** The small row after a limits table's active limits that shows or hides its expired and revoked ones, under it. */
function EndedToggle({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const { m, f } = useI18n();
  const t = m.app.wallet;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-11 w-full items-center justify-center gap-1.5 text-[13px] font-medium text-quiet transition-colors hover:bg-black/[0.03] hover:text-ink"
      >
        {open ? t.hideEnded : f(t.seeEnded, { count: String(count) })}
        <Chevron
          width={12}
          height={12}
          aria-hidden="true"
          className={`transition-transform ${open ? "-rotate-90" : "rotate-90"}`}
        />
      </button>
    </div>
  );
}

/**
 * The approvals Menta has paid under. With none and no card saved, it asks for
 * a card first; existing approvals always show: a card list that failed to
 * load, or a removed card, must never hide one the user may want to cancel.
 */
export function SpendingLimits({
  currencies,
  currency,
}: {
  currencies: readonly string[];
  currency: string;
}) {
  /** The saved cards, for which card a limit is on; undefined while listing, null when that failed. */
  const [cards, setCards] = useState<readonly SavedCard[] | null>();
  useEffect(() => {
    void fetch("/api/crossmint/cards", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { cards?: SavedCard[] | null } | null) =>
        setCards(body?.cards ?? null),
      )
      .catch(() => setCards(null));
  }, []);
  // A list that failed to load (null) still offers +: the form lists cards itself.
  const hasCard = cards === null || Boolean(cards?.length);
  const { m, f } = useI18n();
  const t = m.app.wallet;
  const [approvals, setApprovals] = useState<readonly Approval[] | null>();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** The approval being confirmed for canceling. */
  const [confirming, setConfirming] = useState<Approval | null>(null);
  const [creating, setCreating] = useState(false);
  const [load, setLoad] = useState(0);
  // The approval open in the details panel. Wide screens keep a limit open in
  // the pane: the first until one is picked; narrowing forgets the pick.
  const [wide, open, setOpen] = usePanePick();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `load` asks for a fresh list
  useEffect(() => {
    void fetch("/api/crossmint/order-intents", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { orderIntents?: Approval[] } | null) =>
        setApprovals(body?.orderIntents ? ordered(body.orderIntents) : null),
      )
      .catch(() => setApprovals(null));
  }, [load]);

  // A card's details link a limit here as ?open=<id>: open it, then drop the query.
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("open");
    if (id && approvals?.some((item) => item.orderIntentId === id)) {
      setOpen(id);
      url.searchParams.delete("open");
      window.history.replaceState(null, "", url);
    }
  }, [approvals, setOpen]);

  const { money, remaining } = useFormat();
  /** The row that opened the details panel (focus returns there). */
  const opener = useRef<HTMLButtonElement | null>(null);
  /** The details panel's Cancel: the confirmation follows once it has closed. */
  const cancelNext = useRef(false);
  const opened =
    approvals?.find((item) => item.orderIntentId === open) ??
    (wide ? (approvals?.[0] ?? null) : null);

  async function cancel(id: string) {
    setCancelling(id);
    setFailed(null);
    const response = await fetch(
      `/api/crossmint/order-intents/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ).catch(() => null);
    if (response?.ok) {
      setApprovals((current) =>
        current
          ? ordered(
              current.map((item) =>
                item.orderIntentId === id
                  ? { ...item, status: "cancelled" as const }
                  : item,
              ),
            )
          : current,
      );
      // Revoked limits sort last: keep the pane on this one, not whichever is now first.
      if (wide) {
        setOpen(id);
      }
      setConfirming(null);
    } else {
      setFailed(id);
    }
    setCancelling(null);
  }

  // Expired and revoked limits open under a row after the active ones.
  const current = (approvals ?? []).filter((item) => !ended(item));
  const past = (approvals ?? []).filter(ended);
  const [showEnded, setShowEnded] = useState(false);
  const row = (approval: Approval) => {
    const state = shown(approval);
    const { currency } = approval.amount;
    const name = store(approval) ?? (approval.description || t.unknownStore);
    return (
      <div
        key={approval.orderIntentId}
        className={`${approvalColumns} relative min-h-14 px-5 py-2.5 transition-colors hover:bg-black/[0.03] ${opened?.orderIntentId === approval.orderIntentId ? "bg-black/[0.04]" : ""} ${state === "active" ? "" : "[&>*]:opacity-50"}`}
      >
        {/* The name opens the details; its hit area covers the row, under the ⋯ menu. */}
        <button
          type="button"
          // In the pane (wide screens) nothing pops up: the row is the one shown.
          aria-haspopup={wide ? undefined : "dialog"}
          aria-current={
            wide && opened?.orderIntentId === approval.orderIntentId
              ? true
              : undefined
          }
          onClick={(event) => {
            opener.current = event.currentTarget;
            setOpen(approval.orderIntentId);
          }}
          className="flex min-w-0 items-center gap-3 text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:bg-black/[0.03] focus-visible:after:ring-2 focus-visible:after:ring-ink focus-visible:after:ring-inset"
        >
          <ApprovalIcon approval={approval} />
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium">{name}</span>
              {/* Phones: no status column, so its tag sits beside the name. */}
              {state === "active" ? null : (
                <span
                  className={`flex-none rounded-full px-2 py-0.5 text-[11.5px] font-medium sm:hidden ${tone[state]}`}
                >
                  {t.status[state]}
                </span>
              )}
            </span>
            {approval.description && store(approval) ? (
              <span className="truncate text-[13px] text-quiet">
                {approval.description}
              </span>
            ) : null}
          </span>
        </button>
        {/* Phones: the limit's amount. */}
        <span className="text-right font-medium tabular-nums sm:hidden">
          {money(approval.amount.total, currency)}
        </span>
        <span className="text-right text-[13px] text-quiet tabular-nums max-sm:hidden">
          {/* The headings are hidden from screen readers: each value says what it is. */}
          <span className="sr-only">{t.columns.used} </span>
          {/* One sentence per language, so word order can change; the spent part stands out. */}
          {rich(t.spentOf, {
            spent: (
              <span className="font-medium text-ink">
                {money(approval.amount.spent, currency)}
              </span>
            ),
            total: money(approval.amount.total, currency),
          })}
        </span>
        <span className="text-right text-[13px] text-quiet max-sm:hidden">
          {state === "active" ? (
            <>
              <span className="sr-only">{t.columns.expires} </span>
              {remaining(approval.expiresAt)}
            </>
          ) : (
            <span
              className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${tone[state]}`}
            >
              {t.status[state]}
            </span>
          )}
        </span>
      </div>
    );
  };
  return (
    <PageShell
      title={t.approvals}
      pane
      tool={
        hasCard ? (
          <PlusButton label={t.create.open} onClick={() => setCreating(true)} />
        ) : null
      }
    >
      <div
        className={`${bleed} overflow-hidden [&>div+div]:border-t [&>div+div]:border-black/[0.05]`}
      >
        {/* With no limits, which empty state shows waits for the cards too. */}
        {approvals === undefined ||
        (approvals?.length === 0 && cards === undefined) ? (
          <div
            role="status"
            className="[&>div+div]:border-t [&>div+div]:border-black/[0.05]"
          >
            <span className="sr-only">{m.settings.loading}</span>
            <LimitSkeleton columns={approvalColumns} />
            <LimitSkeleton columns={approvalColumns} />
          </div>
        ) : approvals === null ? (
          <p className="px-5 py-4 text-[13px] text-quiet">
            {t.approvalsFailed}
          </p>
        ) : approvals.length === 0 && cards?.length === 0 ? (
          // A spending limit is set on a card: with none saved, adding one comes first.
          <div className="flex flex-col items-center pb-8 text-center">
            <GhostApprovals names={t.approvalsFirst.examples} />
            <div className="relative -mt-20 flex flex-col items-center gap-5 bg-[radial-gradient(ellipse_65%_75%_at_50%_45%,#fff_55%,rgb(255_255_255/0))] px-6 pt-2">
              <div className="flex flex-col items-center gap-1.5">
                <h3 className="m-0 text-[22px] font-semibold tracking-[-0.03em]">
                  {t.cardFirst.title}
                </h3>
                <p className="m-0 max-w-[520px] text-[15px] text-pretty text-quiet">
                  {t.cardFirst.text}
                </p>
              </div>
              <Link
                href="/wallet#cards"
                className="raised tap relative inline-flex h-11 flex-none items-center rounded-full bg-ink px-5 font-medium text-white hover:bg-ink-hover"
              >
                {m.settings.cardManager.add}
              </Link>
            </div>
          </div>
        ) : current.length === 0 ? (
          <LimitsEmpty
            title={
              approvals.length === 0 ? t.approvalsFirst.title : t.noneActive
            }
            onCreate={() => setCreating(true)}
          />
        ) : (
          <div>
            <div className="[&>div+div]:border-t [&>div+div]:border-black/[0.05]">
              {/* The headings are for sight only (rows say them to screen
                  readers); Used's help stays reachable. */}
              <div
                // Rows draw the line under it ([&>div+div]), as they do between them.
                className={`${approvalColumns} h-10 px-5 text-[12px] font-medium text-muted`}
              >
                <span aria-hidden="true">{t.columns.approval}</span>
                {/* Phones show the amount; wider screens what's used and when it expires. */}
                <span aria-hidden="true" className="text-right sm:hidden">
                  {m.app.transactions.columns.amount}
                </span>
                <span className="inline-flex items-center justify-end gap-1.5 max-sm:hidden">
                  <span aria-hidden="true">{t.columns.used}</span>
                  <InfoTip
                    label={t.detail.usedHelpLabel}
                    text={t.detail.usedHelp}
                  />
                </span>
                <span aria-hidden="true" className="text-right max-sm:hidden">
                  {t.columns.expires}
                </span>
              </div>
              {current.map(row)}
            </div>
          </div>
        )}
        {/* Expired and revoked: in the same table, behind a small row at its end. */}
        {approvals && past.length > 0 ? (
          <>
            <EndedToggle
              count={past.length}
              open={showEnded}
              onToggle={() => setShowEnded((value) => !value)}
            />
            <EndedRows open={showEnded}>{past.map(row)}</EndedRows>
          </>
        ) : null}
      </div>
      {/* Keyed: the pane stays mounted, and one limit's state isn't the next's. */}
      {opened ? (
        <ApprovalDetail
          key={opened.orderIntentId}
          approval={opened}
          card={
            cards?.find(
              (card) => card.paymentMethodId === opened.paymentMethodId,
            ) ?? null
          }
          onCancel={() => {
            if (wide) {
              // The pane stays: confirm right away.
              setFailed(null);
              setConfirming(opened);
            } else {
              cancelNext.current = true;
            }
          }}
          onClose={() => {
            setOpen(null);
            opener.current?.focus();
            // Asked to cancel: confirm once the panel has gone, so the
            // confirmation returns focus to the row, not the panel's button.
            if (cancelNext.current) {
              cancelNext.current = false;
              setFailed(null);
              setConfirming(opened);
            }
          }}
        />
      ) : null}
      {creating ? (
        <NewApproval
          currencies={currencies}
          currency={currency}
          // Closed mid-approval, Crossmint may still have made it: reload either way.
          onClose={() => {
            setCreating(false);
            setLoad((current) => current + 1);
          }}
          onMade={() => {
            setCreating(false);
            setLoad((current) => current + 1);
          }}
        />
      ) : null}
      {confirming ? (
        <ConfirmModal
          id="cancel-approval-title"
          title={f(t.cancelTitle, {
            store:
              store(confirming) ?? (confirming.description || t.unknownStore),
          })}
          text={t.cancelText}
          confirm={t.cancelConfirm}
          busyLabel={t.cancelling}
          cancel={t.keep}
          busy={cancelling === confirming.orderIntentId}
          error={failed === confirming.orderIntentId ? t.cancelFailed : null}
          onConfirm={() => void cancel(confirming.orderIntentId)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </PageShell>
  );
}

/** Before the first approval: faded rows named for everyday purchases. */
function GhostApprovals({ names }: { names: readonly string[] }) {
  const bar = "h-2.5 rounded-full bg-black/[0.06]";
  return (
    <div
      aria-hidden="true"
      className="w-full divide-y divide-black/[0.04] text-left [mask-image:linear-gradient(to_bottom,#000_25%,rgb(0_0_0/15%))]"
    >
      {names.map((name, index) => (
        <div key={name} className="flex items-center gap-3 py-3.5 pr-5 pl-4">
          <ApprovalTile faded />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="truncate font-medium text-faint">{name}</span>
            <span className={`${bar} ${["w-32", "w-24", "w-28"][index % 3]}`} />
          </span>
          <span className="flex flex-none flex-col items-end gap-2">
            <span className={`${bar} w-20`} />
            <span className="h-4 w-14 rounded-full bg-black/[0.04]" />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * No active spending limits, in the Spending limits table and a card's
 * details: faded rows of what will be here, the message over them on a soft
 * glow, and making the first one right here.
 */
function LimitsEmpty({
  title,
  onCreate,
}: {
  title: string;
  onCreate: () => void;
}) {
  const { m } = useI18n();
  const t = m.app.wallet;
  return (
    <div className="flex flex-col items-center pb-8 text-center">
      <GhostApprovals names={t.approvalsFirst.examples} />
      <div className="relative -mt-20 flex flex-col items-center gap-5 bg-[radial-gradient(ellipse_65%_75%_at_50%_45%,#fff_55%,rgb(255_255_255/0))] px-6 pt-2">
        <div className="flex flex-col items-center gap-1.5">
          <h3 className="m-0 text-[22px] font-semibold tracking-[-0.03em]">
            {title}
          </h3>
          <p className="m-0 max-w-[520px] text-[15px] text-pretty text-quiet">
            {t.approvalsFirst.text}
          </p>
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onCreate}
          className="raised tap relative inline-flex h-11 flex-none items-center rounded-full bg-ink px-5 font-medium text-white hover:bg-ink-hover"
        >
          {t.create.open}
        </button>
      </div>
    </div>
  );
}

/** A card's spending limits, in its details panel, and making one on it. */
function CardLimits({
  card,
  currencies,
  currency,
}: {
  card: SavedCard;
  currencies: readonly string[];
  currency: string;
}) {
  const { m } = useI18n();
  const t = m.app.wallet;
  const { money } = useFormat();
  const [approvals, setApprovals] = useState<readonly Approval[] | null>();
  const [creating, setCreating] = useState(false);
  const [load, setLoad] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `load` asks for a fresh list
  useEffect(() => {
    void fetch("/api/crossmint/order-intents", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { orderIntents?: Approval[] } | null) =>
        setApprovals(
          body?.orderIntents
            ? ordered(
                body.orderIntents.filter(
                  (item) => item.paymentMethodId === card.paymentMethodId,
                ),
              )
            : null,
        ),
      )
      .catch(() => setApprovals(null));
  }, [load, card.paymentMethodId]);
  const reload = () => {
    setCreating(false);
    setLoad((current) => current + 1);
  };

  // Expired and revoked limits open under a row after the active ones.
  const current = (approvals ?? []).filter((approval) => !ended(approval));
  const past = (approvals ?? []).filter(ended);
  const [showEnded, setShowEnded] = useState(false);
  const item = (approval: Approval) => {
    const state = shown(approval);
    const where = store(approval);
    return (
      <Link
        key={approval.orderIntentId}
        href={`/spending-limits?open=${encodeURIComponent(approval.orderIntentId)}`}
        className={`flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-black/[0.03] ${state === "active" ? "" : "[&>*]:opacity-50"}`}
      >
        <ApprovalIcon approval={approval} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">
              {where ?? approval.description}
            </span>
            {state === "active" ? null : (
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-[11.5px] font-medium ${tone[state]}`}
              >
                {t.status[state]}
              </span>
            )}
          </span>
          {where && approval.description ? (
            <span className="truncate text-[13px] text-quiet">
              {approval.description}
            </span>
          ) : null}
        </span>
        <span className="flex-none font-medium tabular-nums">
          {money(approval.amount.total, approval.amount.currency)}
        </span>
      </Link>
    );
  };
  return (
    <section
      aria-labelledby="card-limits-title"
      className="flex flex-col gap-3"
    >
      <header className="flex items-center justify-between gap-3 px-1">
        <h3
          id="card-limits-title"
          className="m-0 text-[17px] font-semibold tracking-[-0.02em]"
        >
          {m.settings.cardManager.limits}
        </h3>
        <PlusButton label={t.create.open} onClick={() => setCreating(true)} />
      </header>
      {/* The Spending limits table as phones show it, for the pane's width: store and name, then the amount. */}
      <div className="panel overflow-hidden [&>*+*]:border-t [&>*+*]:border-black/[0.05]">
        {approvals && current.length === 0 ? null : (
          <div
            aria-hidden="true"
            className="flex h-10 items-center justify-between px-4 text-[12px] font-medium text-muted"
          >
            <span>{t.columns.approval}</span>
            <span>{m.app.transactions.columns.amount}</span>
          </div>
        )}
        {approvals === undefined ? (
          <RowSkeleton icon={false} />
        ) : approvals === null ? (
          <p className="m-0 px-5 py-4 text-[13px] text-quiet">
            {t.approvalsFailed}
          </p>
        ) : current.length === 0 ? (
          <LimitsEmpty
            title={
              approvals.length === 0 ? t.approvalsFirst.title : t.noneActive
            }
            onCreate={() => setCreating(true)}
          />
        ) : (
          current.map(item)
        )}
        {approvals && past.length > 0 ? (
          <>
            <EndedToggle
              count={past.length}
              open={showEnded}
              onToggle={() => setShowEnded((value) => !value)}
            />
            <EndedRows open={showEnded}>{past.map(item)}</EndedRows>
          </>
        ) : null}
      </div>
      {creating ? (
        <NewApproval
          currencies={currencies}
          currency={currency}
          card={card.paymentMethodId}
          onClose={reload}
          onMade={reload}
        />
      ) : null}
    </section>
  );
}

/** A round + at a page's or section's top right: add a card, make a spending limit. */
function PlusButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      onClick={onClick}
      className="tap relative inline-flex size-12 flex-none items-center justify-center rounded-full text-ink transition-colors hover:bg-black/[0.04]"
    >
      <Plus width={22} height={22} strokeWidth={2} />
    </button>
  );
}

/**
 * Wallet: the cards Menta pays with, each opening its details (and its
 * spending limits); + adds one. Spending limits have their own page.
 */
export function Wallet({
  currencies,
  currency,
}: {
  /** What a new spending limit can be in, and what it starts in. */
  currencies: readonly string[];
  currency: string;
}) {
  const { m } = useI18n();
  const t = m.app.wallet;
  /** Bumped by + to open the add-card form. */
  const [add, setAdd] = useState(0);
  return (
    <PageShell
      title={t.title}
      pane
      tool={
        <PlusButton
          label={m.settings.cardManager.add}
          onClick={() => setAdd((current) => current + 1)}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <CrossmintScope fallback={<ListSkeleton />}>
          {() => (
            <CardManager
              add={add}
              limits={(card) => (
                <CardLimits
                  card={card}
                  currencies={currencies}
                  currency={currency}
                />
              )}
            />
          )}
        </CrossmintScope>
        <PoweredByCrossmint />
      </div>
    </PageShell>
  );
}

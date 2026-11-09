"use client";

import { useI18n } from "../../lib/i18n/client";

/**
 * The approval step while its cards load: a card row, "Add a card" and the
 * Approve button, quiet. `row`: the card as one details row (the spending
 * limit request page), then Approve.
 */
export function ApprovalSkeleton({
  label,
  row = false,
}: {
  label?: string;
  row?: boolean;
}) {
  const { m } = useI18n();
  const block = "rounded-[14px] bg-black/[0.04] motion-safe:animate-pulse";
  if (row) {
    return (
      <div role="status" className="flex flex-col gap-2.5">
        <span className="sr-only">
          {label ?? m.settings.cardManager.loadingCards}
        </span>
        <div className="flex min-h-[52px] items-center justify-between gap-3.5 rounded-[20px] bg-stage px-4.5">
          <span className="h-3.5 w-10 rounded-full bg-black/[0.06] motion-safe:animate-pulse" />
          <span className="h-3.5 w-28 rounded-full bg-black/[0.06] motion-safe:animate-pulse" />
        </div>
        <div className={`${block} h-10 rounded-full`} />
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">
        {label ?? m.settings.cardManager.loadingCards}
      </span>
      <div className={`${block} h-[62px]`} />
      <div className="h-10 rounded-[12px] border border-dashed border-line-card" />
      <div className={`${block} h-11 rounded-full`} />
    </div>
  );
}

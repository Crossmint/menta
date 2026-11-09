"use client";

import { useI18n } from "../../lib/i18n/client";

/** A loading row the height of a real one, so nothing jumps when it fills in. */
export function RowSkeleton({
  icon = true,
  square = false,
}: {
  icon?: boolean;
  /** An app's rounded square (agents), not a person's circle. */
  square?: boolean;
}) {
  const { m } = useI18n();
  return (
    <div role="status" className="flex items-center gap-3.5 px-5 py-3.5">
      <span className="sr-only">{m.settings.loading}</span>
      {icon ? (
        <span
          className={`size-9 flex-none animate-pulse bg-chip ${square ? "rounded-[10px]" : "rounded-full"}`}
        />
      ) : null}
      <span className="flex min-h-10 flex-1 flex-col justify-center gap-2">
        <span className="h-3.5 w-28 animate-pulse rounded-full bg-chip" />
        <span className="h-3 w-52 max-w-full animate-pulse rounded-full bg-chip" />
      </span>
    </div>
  );
}

const pulse = "animate-pulse rounded-full bg-chip";

/** A loading purchase: merchant icon and name, date, amount, in the table's own columns. */
export function PurchaseSkeleton({ columns }: { columns: string }) {
  return (
    <div aria-hidden="true" className={`${columns} min-h-14 px-5 py-2.5`}>
      <span className="flex min-w-0 items-center gap-3">
        <span className="size-7 flex-none animate-pulse rounded-[8px] bg-chip" />
        <span className={`${pulse} h-3.5 w-28`} />
      </span>
      <span className={`${pulse} ml-auto h-3 w-14`} />
      <span className={`${pulse} ml-auto h-3.5 w-12`} />
    </div>
  );
}

/** A loading saved card: the brand tile, its label and expiry. */
export function CardRowSkeleton() {
  const { m } = useI18n();
  return (
    <div role="status" className="flex items-center gap-3.5 py-3.5 pr-4 pl-5">
      <span className="sr-only">{m.settings.loading}</span>
      <span className="h-[22px] w-[34px] flex-none animate-pulse rounded-[4px] bg-chip" />
      <span className="flex min-h-10 flex-1 flex-col justify-center gap-2">
        <span className={`${pulse} h-3.5 w-32`} />
        <span className={`${pulse} h-3 w-20`} />
      </span>
    </div>
  );
}

/** A loading spending limit, in its table's columns: icon and name, used, expires. */
export function LimitSkeleton({ columns }: { columns: string }) {
  return (
    <div aria-hidden="true" className={`${columns} min-h-14 px-5 py-2.5`}>
      <span className="flex min-w-0 items-center gap-3">
        <span className="size-9 flex-none animate-pulse rounded-[10px] bg-chip" />
        <span className={`${pulse} h-3.5 w-24`} />
      </span>
      <span className={`${pulse} ml-auto h-3 w-20 max-sm:hidden`} />
      <span className={`${pulse} ml-auto h-3 w-14`} />
    </div>
  );
}

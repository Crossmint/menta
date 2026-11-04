"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadConnections } from "../../../lib/client/connections";
import { useI18n } from "../../../lib/i18n/client";
import { railInput } from "../../_components/address-form";
import { Chevron, Close, Search, Store } from "../../_components/icons";
import { usePanePick } from "../../_components/pane";
import { PurchaseSkeleton } from "../../_components/row-skeleton";
import { ConnectAgent } from "../connect-agent";
import { PageShell } from "../page-shell";
import {
  type Feed,
  type Filter,
  hasMore,
  loadPage,
  matches,
  noFilter,
  type Purchase,
} from "./feed";
import { columns, Detail, Row, Table, TableNote } from "./table";

/** Narrows the loaded purchases by words in the request, store and total. */
function Filters({
  filter,
  stores,
  searching,
  onChange,
}: {
  filter: Filter;
  stores: readonly string[];
  /** The search field is open (the header's search icon). */
  searching: boolean;
  onChange: (filter: Filter) => void;
}) {
  const { m } = useI18n();
  const t = m.app.transactions.filters;
  const field =
    (key: keyof Filter) =>
    (event: { target: { value: string } }): void =>
      onChange({ ...filter, [key]: event.target.value });
  return (
    <search
      aria-label={t.label}
      className="flex flex-wrap items-center gap-2.5"
    >
      {searching ? (
        <label className="relative min-w-[200px] flex-1 basis-full sm:basis-0">
          <span className="sr-only">{t.text}</span>
          <Search
            width={15}
            height={15}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-quiet"
          />
          <input
            autoFocus
            type="search"
            value={filter.text}
            onChange={field("text")}
            placeholder={t.text}
            className={`${railInput} pl-9`}
          />
        </label>
      ) : null}
      {/* The browser's own select under a pill, like the language picker. */}
      <label className="raised-light relative inline-flex h-10 max-w-full flex-none items-center gap-2 rounded-full border border-line-card bg-white pr-9 pl-3.5 text-[13px] font-medium text-soft transition-colors focus-within:border-ink hover:text-ink">
        <Store
          width={16}
          height={16}
          aria-hidden="true"
          className="flex-none"
        />
        <span className="sr-only">{t.store}</span>
        <select
          value={filter.store}
          onChange={field("store")}
          className="absolute inset-0 cursor-pointer appearance-none rounded-full text-[16px] opacity-0"
        >
          <option value="">{t.allStores}</option>
          {stores.map((store) => (
            <option key={store} value={store}>
              {store}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="truncate">
          {filter.store || t.allStores}
        </span>
        <Chevron
          width={14}
          height={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 rotate-90 text-muted"
        />
      </label>
    </search>
  );
}

/**
 * Before the first purchase: faded rows at the visitor's own stores, so the
 * empty table shows what it will hold.
 */
function GhostRows({ stores }: { stores: readonly string[] }) {
  const bar = "h-2.5 rounded-full bg-black/[0.06]";
  return (
    <div
      aria-hidden="true"
      className="divide-y divide-black/[0.04] [mask-image:linear-gradient(to_bottom,#000_25%,rgb(0_0_0/15%))]"
    >
      {stores.map((logo, index) => (
        <div key={logo} className={`${columns} min-h-14 px-5 py-2.5`}>
          <span className="flex min-w-0 items-center gap-3">
            <Image
              src={logo}
              alt=""
              width={28}
              height={28}
              unoptimized
              className="size-7 flex-none rounded-[8px] bg-white object-contain opacity-60 ring-1 ring-black/[0.06] grayscale-[35%]"
            />
            <span className={`${bar} ${["w-28", "w-20", "w-24"][index % 3]}`} />
          </span>
          <span className={`${bar} ml-auto w-14`} />
          <span className={`${bar} ml-auto w-12`} />
        </div>
      ))}
    </div>
  );
}

const retryButton =
  "tap relative flex-none rounded-full px-2.5 py-1 font-medium text-soft transition-colors hover:bg-black/[0.04] hover:text-ink";

/**
 * Activity: every purchase, from any assistant, newest first, straight
 * from Crossmint, as a table of merchant, date and amount; a row
 * opens its details. Before the first one the table shows faded rows at the
 * visitor's own stores, then how to connect an agent, or once one is
 * connected, to tell it to order something.
 */
export function Activity({
  serverUrl,
  examples,
}: {
  serverUrl: string;
  /** Logos of the visitor's local stores, for the empty table's faded rows. */
  examples: readonly string[];
}) {
  const { m } = useI18n();
  const t = m.app.transactions;
  const [runs, setRuns] = useState<readonly Purchase[] | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>(noFilter);
  /** The search field is open; closing it clears the search. */
  const [searching, setSearching] = useState(false);
  /** Whether an agent is connected; undefined while loading. A failed load counts as none. */
  const [connected, setConnected] = useState<boolean>();
  // The purchase open in the side panel; narrowing below the pane forgets it.
  const [wide, open, setOpen] = usePanePick();
  /** The row that opened the side panel (focus returns there). */
  const opener = useRef<HTMLButtonElement | null>(null);

  const more = useCallback(async (after: Feed | null) => {
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadPage(after);
      setRuns((current) => [...(after ? (current ?? []) : []), ...page.runs]);
      setFeed(page.feed);
    } catch {
      setFailed(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void more(null);
    void loadConnections().then((list) =>
      setConnected((list?.length ?? 0) > 0),
    );
  }, [more]);

  const closeDetail = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
  }, [setOpen]);

  const further = hasMore(feed);
  const filtering = Object.values(filter).some((value) => value.trim());
  const shown = runs?.filter((run) => matches(run, filter)) ?? null;
  const stores = [...new Set(runs?.map((run) => run.store))].sort();
  // Wide screens keep a purchase open in the pane: the first until one is picked.
  // Only one the filters show: a filtered-out pick gives way to the first match.
  const selected =
    shown?.find((run) => run.runId === open) ??
    (wide ? (shown?.[0] ?? null) : null);
  // Only a list read to its end is empty; a paused search offers "Show more".
  const empty = runs?.length === 0 && !further;

  return (
    <PageShell
      title={t.title}
      pane
      tool={
        runs && runs.length > 0 ? (
          <button
            type="button"
            aria-label={searching ? t.filters.closeSearch : t.filters.text}
            aria-pressed={searching}
            onClick={() => {
              if (searching) {
                setFilter({ ...filter, text: "" });
              }
              setSearching(!searching);
            }}
            className={`tap relative inline-flex size-12 items-center justify-center rounded-full text-ink transition-colors hover:bg-black/[0.04] ${searching ? "bg-black/[0.04]" : ""}`}
          >
            {searching ? (
              <Close width={20} height={20} />
            ) : (
              <Search width={20} height={20} strokeWidth={2} />
            )}
          </button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {runs && runs.length > 0 ? (
          <Filters
            filter={filter}
            stores={stores}
            searching={searching}
            onChange={setFilter}
          />
        ) : null}
        <Table>
          {runs === null || (empty && connected === undefined) ? (
            failed ? (
              <TableNote>
                {t.failed}
                <button
                  type="button"
                  onClick={() => void more(null)}
                  className={retryButton}
                >
                  {t.retry}
                </button>
              </TableNote>
            ) : (
              <div
                role="status"
                className="[&>div+div]:border-t [&>div+div]:border-black/[0.05]"
              >
                <span className="sr-only">{t.loading}</span>
                <PurchaseSkeleton columns={columns} />
                <PurchaseSkeleton columns={columns} />
                <PurchaseSkeleton columns={columns} />
              </div>
            )
          ) : empty ? (
            <>
              <GhostRows stores={examples} />
              {/* Up over the fading rows, on a soft white glow so they fade out around the text. */}
              {/* One line overlaps only the last row; the connect steps reach further up. */}
              <div
                className={`relative ${connected ? "-mt-10" : "-mt-24"} bg-[radial-gradient(ellipse_65%_75%_at_50%_45%,#fff_55%,rgb(255_255_255/0))]`}
              >
                {connected ? (
                  <p className="m-0 px-6 pt-2 pb-8 text-center text-[15px] text-pretty text-quiet">
                    {t.none.order}
                  </p>
                ) : (
                  <ConnectAgent
                    serverUrl={serverUrl}
                    bare
                    lede={t.none.connect}
                  />
                )}
              </div>
            </>
          ) : runs.length === 0 ? (
            <TableNote>{t.noneRecent}</TableNote>
          ) : shown?.length === 0 ? (
            <TableNote>
              {t.filters.noMatch}
              <button
                type="button"
                onClick={() => setFilter(noFilter)}
                className={retryButton}
              >
                {t.filters.clear}
              </button>
            </TableNote>
          ) : (
            shown?.map((run) => (
              <Row
                key={run.runId}
                run={run}
                selected={run.runId === selected?.runId}
                onOpen={(button) => {
                  opener.current = button;
                  setOpen(run.runId);
                }}
              />
            ))
          )}
        </Table>
        {runs && further && filtering ? (
          <p className="text-center text-[13px] text-pretty text-quiet">
            {t.filters.loadedOnly}
          </p>
        ) : null}
        {runs && further ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void more(feed)}
            className="raised-light h-10 self-center rounded-full border border-line-card bg-white px-5 text-[13px] font-medium text-soft hover:text-ink disabled:opacity-50"
          >
            {loading ? t.loading : t.more}
          </button>
        ) : null}
        {runs && failed ? (
          <p role="alert" className="text-center text-[13px] text-danger">
            {t.failed}
          </p>
        ) : null}
      </div>
      {/* Keyed: the pane stays mounted, and one purchase's state (Show more) isn't the next's. */}
      {selected ? (
        <Detail key={selected.runId} run={selected} onClose={closeDetail} />
      ) : null}
    </PageShell>
  );
}

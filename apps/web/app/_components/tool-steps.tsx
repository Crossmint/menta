"use client";

import {
  describeStep,
  resultCount,
  type SearchResult,
  summarize,
  type ToolStep,
} from "@oca/client/tool-steps";
import { useId, useState } from "react";
import {
  type LocationStep as LocationStepState,
  OSM_ATTRIBUTION,
} from "../../lib/client/location";
import { Chevron, Globe, Pin, Search } from "./icons";

/**
 * The agent asking where the user is, as one quiet row like a research step.
 * The browser's own permission prompt is the only other UI.
 */
export function LocationStep({ step }: { step: LocationStepState }) {
  return (
    <div
      role={step.status === "running" ? "status" : undefined}
      title={step.status === "shared" ? OSM_ATTRIBUTION : undefined}
      className="flex max-w-full min-w-0 animate-[fade-in_240ms_ease-out] items-center gap-2 self-start text-muted"
    >
      <Pin width={14} height={14} className="flex-none" />
      {step.status === "running" ? (
        <span className="shimmer">Getting your location…</span>
      ) : step.status === "shared" && step.label ? (
        <span className="truncate">Got your location: {step.label}</span>
      ) : (
        <span>Couldn't get your location</span>
      )}
    </div>
  );
}

/** Enough to see where the agent looked without turning into a results page. */
const shownResults = 5;

function StepIcon({ kind }: { kind: ToolStep["kind"] }) {
  const Icon = kind === "search" ? Search : Globe;
  return <Icon width={14} height={14} className="flex-none" />;
}

/**
 * One step as a line: "Searched the web · query · 8 results" or
 * "Read apple.com". `link` makes the page a link (not inside a button). In a
 * list (`listed`) the icon says it's a search, so a search leads with its
 * query.
 */
function StepLabel({
  step,
  link,
  listed,
}: {
  step: ToolStep;
  link?: boolean;
  listed?: boolean;
}) {
  const { verb, detail } = describeStep(step);
  const running = step.status === "running";
  const count = resultCount(step);
  if (listed && step.kind === "search" && detail && step.status === "done") {
    return (
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span title={detail} className="truncate text-soft">
          {detail}
        </span>
        {count ? <span className="flex-none text-muted">· {count}</span> : null}
      </span>
    );
  }
  if (step.kind === "fetch") {
    return (
      <span className="flex min-w-0 items-baseline gap-1">
        <span className={`flex-none ${running ? "shimmer" : ""}`}>
          {verb}
          {running && !detail ? "…" : ""}
        </span>
        {detail ? (
          link && step.url ? (
            <a
              href={step.url}
              target="_blank"
              rel="noreferrer"
              title={step.url}
              className="truncate underline decoration-line underline-offset-2 hover:text-ink hover:decoration-current"
            >
              {detail}
            </a>
          ) : (
            <span className={`truncate ${running ? "shimmer" : ""}`}>
              {detail}
              {running ? "…" : ""}
            </span>
          )
        ) : null}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className={`flex-none ${running ? "shimmer" : ""}`}>
        {verb}
        {running && !detail ? "…" : ""}
      </span>
      {detail ? (
        <span title={detail} className="truncate text-muted">
          · {detail}
        </span>
      ) : null}
      {count ? <span className="flex-none text-muted">· {count}</span> : null}
    </span>
  );
}

function Results({ results }: { results: readonly SearchResult[] }) {
  const [all, setAll] = useState(false);
  const more = all ? 0 : results.length - shownResults;
  return (
    <ul className="flex flex-col">
      {(all ? results : results.slice(0, shownResults)).map((result) => (
        <li key={result.url} className="min-w-0">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            title={result.title}
            className="-mx-2 flex min-w-0 items-baseline gap-3 rounded-[8px] px-2 py-1 text-[13px] transition-colors hover:bg-black/[0.04]"
          >
            <span className="truncate text-soft">{result.title}</span>
            <span className="ml-auto flex-none text-muted">{result.host}</span>
          </a>
        </li>
      ))}
      {more > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setAll(true)}
            className="py-1 text-[13px] text-muted transition-colors hover:text-soft"
          >
            {more === 1 ? "1 more result" : `${more} more results`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function hasResults(step: ToolStep) {
  return step.kind === "search" && (step.results?.length ?? 0) > 0;
}

/**
 * The research behind a reply, ChatGPT/Claude style: one quiet row for a run
 * of web searches and page reads, with what's happening now while it works.
 * A single search opens to its results; several steps open to the list.
 */
export function ToolSteps({ steps }: { steps: readonly ToolStep[] }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const single = steps.length === 1 ? steps[0] : null;
  const running = steps.findLast((step) => step.status === "running");
  const shown = running ?? single;
  const expandable = single ? hasResults(single) : true;
  const icon =
    shown?.kind ??
    (steps.some((step) => step.kind === "search") ? "search" : "fetch");
  const label = shown ? (
    <StepLabel step={shown} link={!expandable} />
  ) : (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="flex-none">Researched</span>
      <span className="truncate text-muted">· {summarize(steps)}</span>
    </span>
  );
  return (
    <div className="flex min-w-0 animate-[fade-in_240ms_ease-out] flex-col text-muted">
      {expandable ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex max-w-full items-center gap-2 self-start text-left transition-colors hover:text-soft"
        >
          <StepIcon kind={icon} />
          {label}
          <Chevron
            width={14}
            height={14}
            className={`flex-none transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          />
        </button>
      ) : (
        <div className="flex max-w-full items-center gap-2">
          <StepIcon kind={icon} />
          {label}
        </div>
      )}
      {expandable ? (
        <div
          id={panel}
          inert={!open}
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="min-h-0 overflow-hidden">
            {single ? (
              <div className="pt-1.5 pl-[22px]">
                {single.kind === "search" && single.results ? (
                  <Results results={single.results} />
                ) : null}
              </div>
            ) : (
              <ol className="mt-2.5 ml-[6.5px] flex flex-col gap-2.5 border-l border-line pl-[15px]">
                {steps.map((step) => (
                  <li key={step.id} className="flex min-w-0 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <StepIcon kind={step.kind} />
                      <StepLabel step={step} link listed />
                    </span>
                    {step.kind === "search" && step.results?.length ? (
                      <div className="pl-[22px]">
                        <Results results={step.results} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

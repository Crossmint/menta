import type { EveMessagePart } from "eve/react";

type ToolPart = Extract<EveMessagePart, { type: "dynamic-tool" }>;

/**
 * Research the agent does on its own (Eve's built-in web tools), shown as
 * quiet rows in its reply. Checkout tools have their own cards and the dock.
 */
export const stepTools = new Set(["web_search", "web_fetch"]);

export interface SearchResult {
  title: string;
  url: string;
  host: string;
}

export type ToolStep = {
  id: string;
  /** Running only while the reply is still streaming; a stopped reply leaves calls unfinished. */
  status: "running" | "done" | "error" | "stopped";
} & (
  | { kind: "search"; query: string | null; results: SearchResult[] | null }
  | { kind: "fetch"; url: string | null; host: string | null }
);

/** `apple.com` for `https://www.apple.com/shop/…`; null for anything not http(s). */
export function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * A string field of the tool input. While the model is still writing the
 * input there is only partial JSON, so read the field's text so far.
 */
function field(part: ToolPart, name: string): string | null {
  const input = part.input as Record<string, unknown> | undefined;
  const value = input?.[name];
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (part.state !== "input-streaming") {
    return null;
  }
  const match = new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(
    part.inputText,
  );
  if (!match) {
    return null;
  }
  try {
    return (JSON.parse(`"${match[1].replace(/\\$/, "")}"`) as string).trim();
  } catch {
    return null;
  }
}

function resultsOf(output: unknown): SearchResult[] | null {
  const results = (output as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) {
    return null;
  }
  const seen = new Set<string>();
  const read: SearchResult[] = [];
  for (const result of results) {
    const { title, url } = (result ?? {}) as { title?: unknown; url?: unknown };
    const host = typeof url === "string" ? hostOf(url) : null;
    if (typeof url !== "string" || !host || seen.has(url)) {
      continue;
    }
    seen.add(url);
    read.push({
      url,
      host,
      title: (typeof title === "string" && title.trim()) || host,
    });
  }
  return read;
}

/** The step a tool part shows, or null for tools that aren't research steps. */
export function readStep(part: ToolPart, live: boolean): ToolStep | null {
  if (!stepTools.has(part.toolName)) {
    return null;
  }
  const finished =
    part.state === "output-available" ||
    part.state === "output-error" ||
    part.state === "output-denied";
  const status: ToolStep["status"] =
    part.state === "output-error" || part.state === "output-denied"
      ? "error"
      : part.state === "output-available" && !part.partial
        ? "done"
        : live
          ? "running"
          : finished
            ? "done"
            : "stopped";
  if (part.toolName === "web_search") {
    return {
      id: part.toolCallId,
      kind: "search",
      status,
      query: field(part, "query"),
      results: status === "done" ? resultsOf(part.output) : null,
    };
  }
  // A URL still being written has half a host ("www", "brick"): wait for it.
  const url = part.state === "input-streaming" ? null : field(part, "url");
  const host = url ? hostOf(url) : null;
  return {
    id: part.toolCallId,
    kind: "fetch",
    status,
    url: host ? url : null,
    host,
  };
}

/** What a step did (or is doing), and on what. */
export function describeStep(step: ToolStep): {
  verb: string;
  detail: string | null;
} {
  if (step.kind === "search") {
    const verb = {
      running: "Searching the web",
      done: "Searched the web",
      error: "Couldn't search the web",
      stopped: "Stopped searching",
    }[step.status];
    return { verb, detail: step.query };
  }
  const verb = {
    running: step.host ? "Reading" : "Reading a page",
    done: step.host ? "Read" : "Read a page",
    error: step.host ? "Couldn't read" : "Couldn't read a page",
    stopped: "Stopped reading",
  }[step.status];
  return { verb, detail: step.host };
}

export function resultCount(step: ToolStep): string | null {
  if (step.kind !== "search" || !step.results) {
    return null;
  }
  const count = step.results.length;
  return count === 1 ? "1 result" : `${count} results`;
}

/** "3 searches, 1 page" for a finished run of several steps. */
export function summarize(steps: readonly ToolStep[]): string {
  const searches = steps.filter((step) => step.kind === "search").length;
  const pages = steps.length - searches;
  return [
    searches === 1 ? "1 search" : searches > 1 ? `${searches} searches` : "",
    pages === 1 ? "1 page" : pages > 1 ? `${pages} pages` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Splits a reply's parts into what renders in order: research steps that run
 * back to back (with nothing visible between them) share one row. Returns,
 * for the first part of each run, every step in it; other step parts are
 * covered by their run. `shows` says whether a non-step part puts anything on
 * screen, which ends the run.
 */
export function groupSteps(
  parts: readonly EveMessagePart[],
  live: boolean,
  shows: (part: EveMessagePart, index: number) => boolean,
): Map<number, ToolStep[]> {
  const runs = new Map<number, ToolStep[]>();
  let open: ToolStep[] | null = null;
  parts.forEach((part, index) => {
    const step = part.type === "dynamic-tool" ? readStep(part, live) : null;
    if (step) {
      if (open) {
        open.push(step);
      } else {
        open = [step];
        runs.set(index, open);
      }
    } else if (shows(part, index)) {
      open = null;
    }
  });
  return runs;
}

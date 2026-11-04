import { clock, type Said } from "@oca/agent/ui/logic";
import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";

/**
 * Dock order and the run it shows: the one that needs the user most, newest on
 * a tie.
 */
export {
  byUrgency,
  nextChoice,
  shownRun,
  urgency,
} from "@oca/agent/dock";
/** A checkout task cut to a card title. */
export { shortTask } from "@oca/agent/task";
/** Shared with the ChatGPT/Claude checkout card (packages/agent/src/ui). */
export {
  type Answer,
  clock,
  type Draft,
  describeCheckout,
  expiresIn,
  type FormEntry,
  failureText,
  formAnswers,
  LONG_LIST,
  money,
  onePick,
  optionsOf,
  runStatus,
  type Said,
  type Tone,
  type UiField,
} from "@oca/agent/ui/logic";

export type { CheckoutView };

export function isActive(view: CheckoutView | undefined) {
  return (
    !view ||
    view.status === "queued" ||
    view.status === "running" ||
    view.status === "awaiting_input"
  );
}

/**
 * One read of a run: its view, `"missing"` when this user can't read it
 * (deleted, or another Crossmint project's), or a throw for anything worth
 * retrying.
 */
export type ReadCheckout = (runId: string) => Promise<CheckoutView | "missing">;

export interface CheckoutRef {
  readonly runId: string;
  /** The latest snapshot the conversation holds, if any. */
  readonly initial?: CheckoutView | null;
}

/**
 * Live Crossmint state for the runs on screen, shared by everything that
 * shows them: one poller per run that slows down while the run is quiet,
 * backs off further on errors, and stops for good when the run settles or
 * turns out to be missing. Each app wraps it in its own hook.
 */
export function createCheckoutStore(read: ReadCheckout) {
  const views = new Map<string, CheckoutView>();
  const listeners = new Set<() => void>();
  /** Runs this user can't read: never asked for again. */
  const missing = new Set<string>();
  let version = 0;

  function changed() {
    version++;
    for (const listener of listeners) {
      listener();
    }
  }

  function publish(view: CheckoutView) {
    const current = views.get(view.runId);
    if (
      current &&
      (current.revision > view.revision ||
        JSON.stringify(current) === JSON.stringify(view))
    ) {
      return;
    }
    views.set(view.runId, view);
    changed();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  /** Reads the run once. Returns whether it's worth asking again later. */
  async function refresh(runId: string) {
    const view = await read(runId);
    if (view === "missing") {
      missing.add(runId);
      changed();
      return false;
    }
    publish(view);
    return true;
  }

  interface Follower {
    count: number;
    timer?: ReturnType<typeof setTimeout>;
  }
  const followers = new Map<string, Follower>();

  function follow(runId: string) {
    let entry = followers.get(runId);
    if (!entry) {
      const self: Follower = { count: 0 };
      entry = self;
      followers.set(runId, self);
      let delay = 2500;
      let failures = 0;
      const tick = async () => {
        let again = true;
        try {
          again = await refresh(runId);
          failures = 0;
        } catch {
          failures++;
        }
        if (
          !again ||
          followers.get(runId) !== self ||
          !isActive(views.get(runId))
        ) {
          return;
        }
        delay = Math.min(delay * 1.15, 10_000);
        self.timer = setTimeout(
          tick,
          failures ? Math.min(delay * 2 ** failures, 120_000) : delay,
        );
      };
      if (!missing.has(runId) && isActive(views.get(runId))) {
        self.timer = setTimeout(tick, views.has(runId) ? delay : 0);
      }
    }
    entry.count++;
    const followed = entry;
    return () => {
      followed.count--;
      if (followed.count === 0) {
        clearTimeout(followed.timer);
        followers.delete(runId);
      }
    };
  }

  /**
   * The agent's latest read (a watch that just returned) can be ahead of the
   * last poll; take it so the UI never trails the conversation.
   */
  function adopt(runs: readonly CheckoutRef[]) {
    for (const { runId, initial } of runs) {
      const live = views.get(runId);
      if (initial && live && initial.revision > live.revision) {
        // A model-facing copy has no live-view URL or progress; keep ours.
        publish({
          ...initial,
          liveViewUrl:
            "liveViewUrl" in initial ? initial.liveViewUrl : live.liveViewUrl,
          progress: initial.progress ?? live.progress,
        });
      }
    }
  }

  /**
   * What to show for each run, keyed by run ID. `gaveUp`: the first live read
   * is taking long, so show the conversation's snapshot anyway.
   */
  function shown(
    runs: readonly CheckoutRef[],
    gaveUp: boolean,
    now = Date.now(),
  ) {
    const result = new Map<string, CheckoutView>();
    for (const { runId, initial } of runs) {
      const live = views.get(runId);
      // A missing run's last snapshot stands only if it had already ended.
      const view = missing.has(runId)
        ? [live, initial].find((known) => known && !isActive(known)) ||
          undefined
        : (live ??
          (initial && (gaveUp || trustworthy(initial, now))
            ? initial
            : undefined));
      if (view) {
        result.set(runId, view);
      }
    }
    return result;
  }

  return {
    subscribe,
    version: () => version,
    refresh,
    follow,
    adopt,
    shown,
    /** Whether the run is gone for this user; the UI keeps its last snapshot. */
    isMissing: (runId: string) => missing.has(runId),
  };
}

export type CheckoutStore = ReturnType<typeof createCheckoutStore>;

/**
 * A view saved in the conversation is a snapshot from when the agent read it.
 * Trust it right away only if it can no longer change (a finished run) or was
 * taken moments ago; otherwise wait for one live read before showing it.
 */
function trustworthy(initial: CheckoutView, now: number) {
  if (!isActive(initial)) {
    return true;
  }
  const created = initial.createdAt ? Date.parse(initial.createdAt) : 0;
  return now - created < 30_000;
}

/** "now", "40s ago", "3m ago", then the clock time. */
export function ago(iso: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (Number.isNaN(seconds) || seconds < 10) {
    return "now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  return seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : clock(iso);
}

/** A step this old reads as "Still working…": the agent is thinking, or the page is slow. */
const STALE_MS = 90_000;

/**
 * The line that says what a run is doing: Crossmint's newest step, or
 * "Still working…" once it's old (unless the run is waiting on the user).
 * Null without progress.
 */
export function stepLine(
  view: CheckoutView,
  now = Date.now(),
): { text: string; running: boolean } | null {
  const step = view.progress?.now;
  if (!step) {
    return null;
  }
  if (!view.pending && now - Date.parse(step.at) > STALE_MS) {
    return { text: "Still working…", running: true };
  }
  return { text: step.text, running: step.status === "running" };
}

export type QuestionField = Extract<
  NonNullable<CheckoutView["pending"]>,
  { kind: "question" }
>["fields"][number];

const flat = (text: string) => text.replace(/\s+/g, " ").trim();
const secureLine = "- Private details: sent securely";

/**
 * The chat message the dock sends once the user answers or approves in it, so
 * the agent picks that checkout back up. It names the checkout (there can be
 * several) and spells out each answer; the conversation shows it as one quiet
 * line (see `readDockNote`). Web and mobile must send the same text.
 */
export function dockNote(
  view: Pick<CheckoutView, "runId" | "store">,
  done:
    | { kind: "answer"; said: readonly Said[]; secure: boolean }
    | { kind: "approval" }
    | { kind: "cancel" },
) {
  const run = `(checkout ${view.runId} at ${view.store})`;
  if (done.kind === "approval") {
    return `Approved the payment in the checkout panel ${run}.`;
  }
  if (done.kind === "cancel") {
    return `Cancelled the checkout in the checkout panel ${run}.`;
  }
  return [
    `Answered the store in the checkout panel ${run}:`,
    ...done.said.map(
      (item) => `- ${flat(item.label)}: ${JSON.stringify(flat(item.value))}`,
    ),
    ...(done.secure ? [secureLine] : []),
  ].join("\n");
}

export type DockNote =
  | { kind: "answer"; store: string | null; values: string[] }
  | { kind: "approval"; store: string | null }
  | { kind: "cancel"; store: string | null }
  | { kind: "address"; label: string; place: string; start: boolean };

/** What a dock message says, for its compact line in the conversation, or null for any other message. */
export function readDockNote(text: string): DockNote | null {
  const [head = "", ...lines] = text.trim().split("\n");
  const approved =
    /^Approved the payment in the checkout panel \(checkout \S+ at (.+)\)\.$/.exec(
      head,
    );
  if (approved || head === "I approved the payment.") {
    return { kind: "approval", store: approved?.[1] ?? null };
  }
  const cancelled =
    /^Cancelled the checkout in the checkout panel \(checkout \S+ at (.+)\)\.$/.exec(
      head,
    );
  if (cancelled && lines.length === 0) {
    return { kind: "cancel", store: cancelled[1] ?? null };
  }
  const saved =
    /^Saved the (.+) address \(([^()]+)\)\.( It's my default now\.)?( Start the checkout\.)?$/.exec(
      text.trim(),
    );
  if (saved?.[1] && saved[2]) {
    return {
      kind: "address",
      label: saved[1],
      place: saved[2],
      start: Boolean(saved[4]),
    };
  }
  const answered =
    /^Answered the store in the checkout panel \(checkout \S+ at (.+)\):$/.exec(
      head,
    );
  if (answered) {
    return {
      kind: "answer",
      store: answered[1] ?? null,
      values: lines.flatMap((line) => {
        if (line === secureLine) {
          return ["private details sent securely"];
        }
        const quoted = /: ("(?:[^"\\]|\\.)*")$/.exec(line)?.[1];
        try {
          return quoted ? [String(JSON.parse(quoted))] : [];
        } catch {
          return [];
        }
      }),
    };
  }
  // Conversations from before the dock named the checkout.
  const older = /^Answered the store: (.+)$/s.exec(text.trim());
  return older
    ? { kind: "answer", store: null, values: [flat(older[1] ?? "")] }
    : null;
}

/**
 * How a dock message reads as its quiet line in the conversation: what the
 * user did, and the detail after it ("You answered amazon.com · Size 10").
 */
export function dockNoteLine(note: DockNote): { what: string; detail: string } {
  const at = (store: string | null) => (store ? ` at ${store}` : "");
  switch (note.kind) {
    case "approval":
      return { what: `You approved the payment${at(note.store)}`, detail: "" };
    case "cancel":
      return { what: `You canceled the checkout${at(note.store)}`, detail: "" };
    case "address":
      return {
        what: `You saved the ${note.label} address`,
        detail: note.place,
      };
    case "answer":
      return {
        what: `You answered ${note.store ?? "the store"}`,
        detail: note.values.join(", "),
      };
  }
}

/** One page of the user's checkouts, as `GET /api/checkouts` returns it. */
export interface CheckoutPage {
  readonly runs: readonly CheckoutView[];
  readonly nextCursor: string | null;
}

/**
 * Checkouts waiting on the user for a payment approval or a secure step
 * ("N checkouts need you"), newest first. One waiting can sit behind many
 * newer finished runs, so this reads up to `pages` pages, not just the first.
 * A plain question stays with the assistant that asked it.
 */
export async function runsNeedingYou(
  read: (cursor: string | null) => Promise<CheckoutPage | null>,
  pages = 4,
): Promise<CheckoutView[]> {
  const waiting: CheckoutView[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < pages; page++) {
    const result = await read(cursor);
    if (!result) {
      break;
    }
    waiting.push(
      ...result.runs.filter(
        (run) =>
          run.status === "awaiting_input" &&
          run.pending != null &&
          run.pending.kind !== "question",
      ),
    );
    cursor = result.nextCursor;
    if (!cursor) {
      break;
    }
  }
  return waiting;
}

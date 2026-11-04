/**
 * Which active checkout a dock shows: the one that needs the user most, with
 * a switch to the others, for the web chat's dock. Pure and DOM-free.
 */

/** The fields the rule reads; any checkout view with these works. */
export interface DockRun {
  readonly runId: string;
  readonly createdAt: string | null;
  readonly pending: {
    readonly kind: string;
    readonly requestId: string;
  } | null;
}

/** How much a run needs the user: lower comes first. */
export function urgency(run: Pick<DockRun, "pending">) {
  switch (run.pending?.kind) {
    case "payment":
      return 0;
    case "question":
      return 1;
    case "protected":
      return 2;
    default:
      return 3;
  }
}

/** Active runs in dock order: the one that needs the user most, newest on a tie. */
export function byUrgency(
  a: Pick<DockRun, "pending" | "createdAt">,
  b: Pick<DockRun, "pending" | "createdAt">,
) {
  return (
    urgency(a) - urgency(b) ||
    (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0)
  );
}

/**
 * What the runs are waiting on, as one key. A choice the user made sticks
 * until this changes: a new request anywhere puts the most urgent run first.
 */
export function needsKey(runs: readonly Pick<DockRun, "pending">[]) {
  return runs.map((run) => run.pending?.requestId ?? "").join(" ");
}

/** The run the user switched to, remembered with what the runs needed then. */
export interface DockChoice {
  readonly runId: string;
  readonly needs: string;
}

/**
 * The run to show from runs already in dock order: the user's choice while
 * nothing new needs them and it is still listed, else the first.
 */
export function shownRun<T extends DockRun>(
  runs: readonly T[],
  chosen: DockChoice | null | undefined,
): T | undefined {
  return (
    (chosen?.needs === needsKey(runs)
      ? runs.find((run) => run.runId === chosen.runId)
      : undefined) ?? runs[0]
  );
}

/** The switch: the run after the shown one (wrapping), as a choice to remember. */
export function nextChoice(
  runs: readonly DockRun[],
  shownId: string,
): DockChoice | null {
  const index = runs.findIndex((run) => run.runId === shownId);
  const next = runs[(index + 1) % runs.length];
  return next ? { runId: next.runId, needs: needsKey(runs) } : null;
}

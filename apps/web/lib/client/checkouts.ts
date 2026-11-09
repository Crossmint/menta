"use client";

import {
  type CheckoutRef,
  type CheckoutView,
  createCheckoutStore,
} from "@oca/client/checkouts";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The DOM-free half (packages/client). */
export {
  ago,
  byUrgency,
  type CheckoutRef,
  type CheckoutView,
  clock,
  type DockNote,
  type Draft,
  dockNote,
  dockNoteLine,
  formAnswers,
  isActive,
  money,
  nextChoice,
  type QuestionField,
  readDockNote,
  type Said,
  shownRun,
  stepLine,
  urgency,
} from "@oca/client/checkouts";

const store = createCheckoutStore(async (runId) => {
  const response = await fetch(`/api/checkouts/${encodeURIComponent(runId)}`, {
    cache: "no-store",
  });
  if (response.ok) {
    return (await response.json()) as CheckoutView;
  }
  if (response.status === 404 || response.status === 403) {
    return "missing";
  }
  throw new Error(`Checkout read failed (${response.status}).`);
});

/** Whether the run is gone for this user; the UI keeps its last snapshot. */
export const isMissing = store.isMissing;
/** Reads the run once. Returns whether it's worth asking again later. */
export const refreshCheckout = store.refresh;
/** Follow a run until it settles; returns the stop function. */
export const followCheckout = store.follow;

/** Live Crossmint state for several runs at once, keyed by run ID. */
export function useCheckouts(runs: readonly CheckoutRef[]) {
  useSyncExternalStore(store.subscribe, store.version, () => 0);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setGaveUp(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);
  const ids = runs.map((run) => run.runId).join(" ");
  useEffect(() => {
    const stops = ids
      ? ids.split(" ").map((runId) => store.follow(runId))
      : ([] as (() => void)[]);
    return () => {
      for (const stop of stops) {
        stop();
      }
    };
  }, [ids]);
  useEffect(() => {
    store.adopt(runs);
  });
  const result = store.shown(runs, gaveUp);
  // Same views as last render: hand back the same map so effects stay quiet.
  const previous = useRef(result);
  if (
    previous.current.size !== result.size ||
    [...result].some(([runId, view]) => previous.current.get(runId) !== view)
  ) {
    previous.current = result;
  }
  return previous.current;
}

/** Live Crossmint state for one run, shared by every card that shows it. */
export function useCheckout(runId: string, initial?: CheckoutView | null) {
  return useCheckouts([{ runId, initial }]).get(runId);
}

export async function checkoutAction(
  runId: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`/api/checkouts/${encodeURIComponent(runId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error ?? "That didn't go through. Try again.");
  }
  void store.refresh(runId).catch(() => {});
  return result;
}

/** The current time, ticking every `ms` while mounted, for lines that age. */
export function useNow(ms = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

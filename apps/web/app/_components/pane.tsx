"use client";

import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Modal } from "./modal";

/** Wide enough for the sidebar, a list and a details pane side by side. */
const PANE = "(min-width: 72rem)";

// Outside the hook, so React subscribes once per component, not on every render.
function subscribe(change: () => void) {
  const query = window.matchMedia(PANE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
const wideNow = () => window.matchMedia(PANE).matches;
const unknown = () => null;

/** Whether details show in the page's pane (true) or a side sheet (false); null before it's known. */
export function usePane() {
  return useSyncExternalStore(subscribe, wideNow, unknown);
}

/**
 * `usePane`, and the id of the item picked for details. Narrowing below the
 * pane forgets the pick during render, so no sheet opens for it, not even for
 * one commit (an effect would mount the modal and pull focus first).
 */
export function usePanePick() {
  const wide = usePane();
  const [pick, setPick] = useState<string | null>(null);
  const [was, setWas] = useState(wide);
  if (wide !== was) {
    setWas(wide);
    if (wide === false) {
      setPick(null);
    }
  }
  return [wide, pick, setPick] as const;
}

/** The id of the pane `PageShell` lays out at the right when a page has one. */
export const PANE_ID = "page-pane";

/**
 * An item's details: on wide screens in the page's pane at the right, always
 * open (no Close; picking another row changes it), and below that in the
 * app's side sheet. Children get `close` in the sheet, null in the pane.
 */
export function DetailPane({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  /** The sheet closed. The pane never closes. */
  onClose: () => void;
  children: (close: (() => void) | null) => ReactNode;
}) {
  const wide = usePane();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(wide ? document.getElementById(PANE_ID) : null);
  }, [wide]);
  if (wide) {
    return slot
      ? createPortal(
          <section
            aria-labelledby={labelledBy}
            className="flex min-h-full flex-col animate-[fade-in_150ms_ease-out] motion-reduce:animate-none"
          >
            {children(null)}
          </section>,
          slot,
        )
      : null;
  }
  if (wide === false) {
    return (
      <Modal labelledBy={labelledBy} side onClose={onClose}>
        {(close) => children(close)}
      </Modal>
    );
  }
  return null;
}

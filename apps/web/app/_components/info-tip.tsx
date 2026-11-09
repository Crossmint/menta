"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Help } from "./icons";

/**
 * A "?" beside a label that explains it (a blank line in `text` starts a
 * paragraph): a tap or click toggles the text,
 * a mouse shows it while hovering the icon or the text. A native popover, so
 * a scrolling pane can't clip it; Escape, a tap elsewhere and scrolling
 * close it.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  /** Opened by a tap or click, so leaving with the mouse keeps it. */
  const pinned = useRef(false);
  /** When a pinned tip last closed: the press on its own icon closes it first, then mustn't reopen it. */
  const closedAt = useRef(0);
  /** A mouse leaving closes it a moment later, so the pointer can cross onto the text. */
  const leaving = useRef<number | undefined>(undefined);
  useEffect(() => {
    const element = tip.current;
    const toggled = (event: Event) => {
      const opened = (event as ToggleEvent).newState === "open";
      if (!opened) {
        if (pinned.current) {
          closedAt.current = Date.now();
        }
        pinned.current = false;
      }
      setOpen(opened);
    };
    element?.addEventListener("toggle", toggled);
    return () => {
      element?.removeEventListener("toggle", toggled);
      window.clearTimeout(leaving.current);
    };
  }, []);
  useEffect(() => {
    if (!open) {
      return;
    }
    // It's placed once, when it opens: scrolling or resizing would leave it behind.
    const close = () => tip.current?.hidePopover();
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);
  function show() {
    window.clearTimeout(leaving.current);
    const element = tip.current;
    const anchor = button.current?.getBoundingClientRect();
    if (!element || !anchor || element.matches(":popover-open")) {
      return;
    }
    const width = Math.min(300, window.innerWidth - 32);
    // Under the icon, kept 16px inside the screen. Set on the element, not
    // through React's state: a hover's update can commit after the browser
    // paints, and the tip would first show at a popover's default place, the
    // middle of the screen.
    Object.assign(element.style, {
      position: "fixed",
      margin: "0",
      left: `${Math.max(16, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 16))}px`,
      right: "auto",
      top: `${anchor.bottom + 6}px`,
      bottom: "auto",
      width: `${width}px`,
    });
    element.showPopover();
    // Above the icon instead when it would run off the bottom and there's more room up there.
    const height = element.offsetHeight;
    const below = window.innerHeight - anchor.bottom;
    if (
      anchor.bottom + 6 + height > window.innerHeight - 16 &&
      anchor.top > below
    ) {
      element.style.top = `${Math.max(16, anchor.top - 6 - height)}px`;
    }
  }
  const hide = () => tip.current?.hidePopover();
  const hideSoon = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" && !pinned.current) {
      window.clearTimeout(leaving.current);
      leaving.current = window.setTimeout(hide, 150);
    }
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          // A hover-opened tip is dismissed by the press itself, so a click
          // shows and pins it; a second click on a pinned one closes it.
          if (pinned.current) {
            hide();
          } else if (Date.now() - closedAt.current > 300) {
            show();
            pinned.current = true;
          }
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            show();
          }
        }}
        onPointerLeave={hideSoon}
        className="-m-1.5 inline-flex size-7 flex-none items-center justify-center rounded-full text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <Help width={16} height={16} aria-hidden="true" />
      </button>
      <div
        ref={tip}
        id={id}
        popover="auto"
        role="note"
        onPointerEnter={() => window.clearTimeout(leaving.current)}
        onPointerLeave={hideSoon}
        className="rounded-[14px] bg-ink px-3.5 py-2.5 text-[13px] leading-[1.45] whitespace-pre-line text-pretty text-white shadow-[0_8px_24px_rgb(0_0_0/18%)]"
      >
        {text}
      </div>
    </>
  );
}

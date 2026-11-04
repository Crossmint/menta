"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { menuCard, useMenuKeys, usePhone } from "./agent-picker";
import { Modal, ModalHeader } from "./modal";

/** One action in a row's menu; `danger` for the one that deletes. */
export interface RowAction {
  readonly key: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly danger?: boolean;
}

const item =
  "flex h-10 w-full items-center rounded-[11px] px-3 text-left text-[14px] font-medium transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none max-sm:h-12 max-sm:text-[15px]";

/**
 * A row's "⋯" button and its actions: a menu under the button, drawn over
 * the page so the row's card doesn't clip it, or a sheet on phones.
 */
export function RowMenu({
  label,
  title,
  actions,
  disabled,
}: {
  /** The button's accessible name ("More for Home"). */
  label: string;
  /** The sheet's title on phones (the row's name). */
  title: string;
  actions: readonly RowAction[];
  disabled?: boolean;
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const menu = useId();
  const [place, setPlace] = useState<{
    top: number;
    right: number;
    up: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || phone) {
      return;
    }
    const measure = () => {
      const box = button.current?.getBoundingClientRect();
      if (box) {
        // Above the button when there's no room below it.
        const up = box.bottom + 180 > window.innerHeight && box.top > 180;
        setPlace({
          top: up ? box.top - 6 : box.bottom + 6,
          right: window.innerWidth - box.right,
          up,
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, phone]);

  // A click outside or Escape closes the menu, and focus goes back to the button.
  useEffect(() => {
    if (!open || phone) {
      return;
    }
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !button.current?.contains(target) &&
        !list.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open, phone]);

  useMenuKeys(open && !phone && place !== null, list, button, () =>
    setOpen(false),
  );

  const rows = (done: () => void) =>
    actions.map((action) => (
      <button
        key={action.key}
        type="button"
        role={phone ? undefined : "menuitem"}
        onClick={() => {
          done();
          action.onSelect();
        }}
        className={`${item} ${action.danger ? "text-danger" : "text-ink"}`}
      >
        {action.label}
      </button>
    ));

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup={phone ? "dialog" : "menu"}
        aria-expanded={open}
        aria-controls={open && !phone ? menu : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="tap relative inline-flex size-8 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-black/[0.04] hover:text-ink disabled:opacity-50 pointer-coarse:size-10"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" fill="currentColor" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <circle cx="13" cy="8" r="1.4" fill="currentColor" />
        </svg>
      </button>
      {open && !phone && place
        ? createPortal(
            <div
              ref={list}
              id={menu}
              role="menu"
              aria-label={title}
              style={{ top: place.top, right: place.right }}
              className={`fixed z-50 w-[200px] ${place.up ? "-translate-y-full" : ""}`}
            >
              <div
                data-up={place.up || undefined}
                className={`${menuCard} try-menu`}
              >
                {rows(() => {
                  // Focus back on the button, where a modal the action opens returns it.
                  button.current?.focus();
                  setOpen(false);
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
      {open && phone ? (
        <Modal labelledBy={`${menu}-title`} onClose={() => setOpen(false)}>
          {(close) => (
            <div className="flex flex-col gap-3 p-5">
              <ModalHeader id={`${menu}-title`} title={title} close={close} />
              <div className="flex flex-col">{rows(close)}</div>
            </div>
          )}
        </Modal>
      ) : null}
    </>
  );
}

"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../lib/i18n/client";
import { Close } from "./icons";

/**
 * A modal inside another (a spending limit made from a card's details): the
 * outer one's stepped-down state, and how the inner one asks it to step down.
 */
const Nesting = createContext<{
  stepped: boolean;
  stepDown: (on: boolean) => void;
} | null>(null);

/**
 * Every modal in the app, one way: a native modal dialog (the page behind is
 * inert, Escape closes it, focus returns where it was), a bottom sheet on
 * phones, and from `sm` up a centered card, or a panel from the right for
 * `side`. A click on the backdrop closes it. Mount it to open it; `onClose`
 * runs once however it closes, and is where the caller unmounts it.
 * Its children get `close` to close it from their own buttons. While `busy`
 * (saving), Escape, the backdrop and `close` leave it open. Closing plays its
 * way out first (style.css, `dialog[data-closing]`), then closes.
 */
export function Modal({
  labelledBy,
  side = false,
  busy = false,
  under = false,
  onClose,
  children,
}: {
  /** The id of the modal's title. */
  labelledBy: string;
  /** A panel from the right on wide screens (details), not a centered card. */
  side?: boolean;
  /** Something is saving: the user can't close it until that's done. */
  busy?: boolean;
  /**
   * Something outside it must show on top (Crossmint's card verification,
   * which opens on the page): it steps down from the browser's top layer, as
   * an ordinary dialog in place, until this turns off.
   */
  under?: boolean;
  onClose: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const parent = useContext(Nesting);
  /** A modal inside this one needs the page on top. */
  const [nested, setNested] = useState(false);
  /** This one, or one inside it, needs the page on top. */
  const needs = under || nested;
  /**
   * Stepped down for this one, one inside it, or the one it's inside: an
   * inner one steps back up only after the outer one has, so it stays on top.
   */
  const stepped = needs || (parent?.stepped ?? false);
  /**
   * Where this one is now, once its swap below has run: what one inside it
   * follows. React runs an inner modal's effects before its outer one's, so
   * following `stepped` itself would put the inner one back first, under it.
   */
  const [down, setDown] = useState(false);
  const stepDown = parent?.stepDown;
  useEffect(() => {
    if (!stepDown) {
      return;
    }
    // The modal it's inside would otherwise keep the page inert, under the top layer.
    stepDown(needs);
    return () => stepDown(false);
  }, [stepDown, needs]);
  const nesting = useMemo(
    () => ({ stepped: down, stepDown: setNested }),
    [down],
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const leaving = useRef<number | undefined>(undefined);
  const closed = useRef(false);
  /** Tells the caller once, whichever way it closed. */
  const finish = () => {
    if (!closed.current) {
      closed.current = true;
      onClose();
    }
  };
  /** Closes that are only the switch between modal and ordinary, not a real close. */
  const swaps = useRef(0);
  useEffect(() => {
    dialog.current?.showModal();
    return () => window.clearTimeout(leaving.current);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    const modal = element?.matches(":modal") ?? false;
    if (element?.open && modal === stepped) {
      // Keep the user's place: close() alone sends focus back to the page.
      const focused = document.activeElement;
      swaps.current += 1;
      // Once stepped down, its entrance doesn't play again when it steps back up.
      element.dataset.entered = "";
      element.close();
      if (stepped) {
        element.show();
      } else {
        element.showModal();
      }
      if (focused instanceof HTMLElement && element.contains(focused)) {
        focused.focus({ preventScroll: true });
      }
    }
    // Only now may one inside it step back up, on top of it.
    setDown(stepped);
  }, [stepped]);
  const close = () => {
    const element = dialog.current;
    if (busy || !element?.open || element.dataset.closing !== undefined) {
      return;
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.dataset.closing = "";
    leaving.current = window.setTimeout(
      () => {
        element.close();
        delete element.dataset.closing;
        // Not left to the close event alone: Chrome holds it while the page isn't drawing.
        finish();
      },
      still ? 0 : 220,
    );
  };
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a backdrop click; Escape already closes a modal dialog
    <dialog
      ref={dialog}
      aria-labelledby={labelledBy}
      data-side={side || undefined}
      data-under={stepped || undefined}
      onClose={(event) => {
        // React passes a nested modal's close up to this one: not ours.
        if (event.target !== event.currentTarget) {
          return;
        }
        if (swaps.current > 0) {
          swaps.current -= 1;
          return;
        }
        // Chrome lets a page hold off Escape only once per user activation, so a
        // second Escape still closes it: while busy, it opens again.
        if (busy) {
          dialog.current?.showModal();
          return;
        }
        finish();
      }}
      onCancel={(event) => {
        // A nested modal's Escape (React passes it up) closes only that one.
        if (event.target !== event.currentTarget) {
          return;
        }
        // Escape plays the way out too (or, while busy, does nothing).
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        // A click on the backdrop (the dialog itself, outside its content) closes it.
        if (event.target === event.currentTarget) {
          close();
        }
      }}
      onAnimationEnd={(event) => {
        // In place, its entrance doesn't play again (style.css), not even when
        // the screen crosses `sm` (a phone turning), which swaps the entrance.
        if (event.target === event.currentTarget && !event.pseudoElement) {
          event.currentTarget.dataset.entered = "";
        }
      }}
      // Stepped down, it stays where it was (fixed, like a modal).
      className={`data-[under]:fixed data-[under]:inset-0 data-[under]:z-40 m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[24px] bg-white p-0 pb-[env(safe-area-inset-bottom)] text-left text-ink shadow-[0_0_0_1px_rgb(0_0_0/6%),0_24px_64px_-12px_rgb(0_0_0/25%)] backdrop:bg-black/25 backdrop:animate-[fade-in_150ms_ease-out] open:animate-[sheet-up_320ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:backdrop:animate-none ${
        side
          ? "sm:mr-0 sm:mb-0 sm:ml-auto sm:h-dvh sm:max-h-none sm:max-w-[400px] sm:rounded-none sm:pb-0 sm:open:animate-[live-in_200ms_ease-out]"
          : "sm:m-auto sm:max-w-[480px] sm:rounded-[24px] sm:open:animate-[sheet-in_280ms_cubic-bezier(0.22,1,0.36,1)]"
      }`}
    >
      <Nesting.Provider value={nesting}>{children(close)}</Nesting.Provider>
    </dialog>
  );
}

/** A modal's title row: the title, an optional line under it, and Close. */
export function ModalHeader({
  id,
  title,
  lede,
  close,
}: {
  id: string;
  title: ReactNode;
  lede?: ReactNode;
  close: () => void;
}) {
  const { m } = useI18n();
  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2
          id={id}
          className="m-0 text-[20px] font-semibold tracking-[-0.03em] text-balance"
        >
          {title}
        </h2>
        {lede ? (
          <p className="m-0 text-[14px] text-pretty text-quiet">{lede}</p>
        ) : null}
      </div>
      <CloseButton label={m.app.modal.close} onClick={close} />
    </div>
  );
}

/** A modal's quiet round Close button. */
export function CloseButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="tap relative -mt-1 -mr-1.5 inline-flex size-9 flex-none items-center justify-center rounded-full text-soft transition-colors hover:bg-black/[0.04] hover:text-ink"
    >
      <Close width={16} height={16} />
    </button>
  );
}

/** Buttons at the end of a modal: secondary first, the main action last; stacked on phones, the main action on top. */
export function ModalActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

/**
 * Confirming something hard to undo (disconnecting an agent, removing a card,
 * canceling an approval), in the app's modal. The action stays busy while it
 * runs; `onConfirm` closes it by unmounting, or leaves it open with `error`.
 */
export function ConfirmModal({
  id,
  title,
  text,
  confirm,
  busyLabel,
  cancel,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  id: string;
  title: ReactNode;
  text: ReactNode;
  confirm: string;
  busyLabel: string;
  cancel: string;
  busy: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal labelledBy={id} busy={busy} onClose={onClose}>
      {(close) => (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <ModalHeader id={id} title={title} lede={text} close={close} />
          {error ? (
            <p role="alert" className="m-0 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
          <ModalActions>
            <button
              type="button"
              onClick={close}
              className="raised-light tap relative inline-flex h-11 items-center justify-center rounded-full border border-line-card bg-white px-5 font-medium text-soft hover:text-ink"
            >
              {cancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              aria-busy={busy}
              className="tap relative inline-flex h-11 items-center justify-center rounded-full bg-danger-soft px-5 font-medium text-danger transition-colors hover:bg-danger/25 disabled:opacity-60"
            >
              {busy ? busyLabel : confirm}
            </button>
          </ModalActions>
        </div>
      )}
    </Modal>
  );
}

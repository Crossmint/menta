"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, type RefObject, useEffect, useState } from "react";
import { Plug, Sparkle } from "./icons";

/** One row of an agent menu: a link (in the app or out), or an action like the setup prompt. */
export interface PickItem {
  readonly key: string;
  readonly label: string;
  /** An app icon from public/assistants, or a drawn tile. */
  readonly icon: string | ReactNode;
  readonly href?: string;
  /** Opens in a new tab: the assistant's own site. */
  readonly external?: boolean;
  readonly onSelect?: () => void;
  /** A hairline above it, setting it apart (trying Menta on the web). */
  readonly divided?: boolean;
}

const row =
  "flex h-11 w-full items-center gap-3 rounded-[12px] px-2 text-left text-[15px] font-medium whitespace-nowrap text-ink transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none max-sm:h-14";

/** The rows of an agent menu, the same in a dropdown and in a phone's sheet. */
export function PickList({
  items,
  onPicked,
}: {
  items: readonly PickItem[];
  /** After any row: closes the menu. */
  onPicked?: () => void;
}) {
  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const face = (
          <>
            {typeof item.icon === "string" ? (
              <Image
                src={`/assistants/${item.icon}.png`}
                alt=""
                width={28}
                height={28}
                className="size-7 flex-none rounded-[8px] ring-1 ring-black/10 max-sm:size-8"
              />
            ) : (
              item.icon
            )}
            {item.label}
          </>
        );
        return (
          <div key={item.key}>
            {item.divided ? (
              <div aria-hidden="true" className="mx-2 my-1.5 h-px bg-line" />
            ) : null}
            {item.href ? (
              item.external ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onPicked}
                  className={row}
                >
                  {face}
                </a>
              ) : (
                <Link href={item.href} onClick={onPicked} className={row}>
                  {face}
                </Link>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  onPicked?.();
                  item.onSelect?.();
                }}
                className={row}
              >
                {face}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Whether the screen is phone-width, where menus open as a bottom sheet. */
export function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}

/**
 * Keys for a dropdown drawn over the page: it sits at the end of the body,
 * out of reach of Tab from its button, so once shown it takes focus on its
 * first row, the arrows move between rows, and Tab closes it and goes on
 * from the button.
 */
export function useMenuKeys(
  shown: boolean,
  list: RefObject<HTMLElement | null>,
  button: RefObject<HTMLElement | null>,
  close: () => void,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs, and close only sets state; runs as it shows
  useEffect(() => {
    const element = list.current;
    if (!shown || !element) {
      return;
    }
    const rows = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)"),
      );
    rows()[0]?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const all = rows();
        const at = all.indexOf(document.activeElement as HTMLElement);
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next =
          at === -1
            ? step === 1
              ? 0
              : all.length - 1
            : (at + step + all.length) % all.length;
        all[next]?.focus();
      } else if (event.key === "Tab") {
        // From the button, Tab's own move goes on to what follows it.
        button.current?.focus();
        close();
      }
    };
    element.addEventListener("keydown", key);
    return () => element.removeEventListener("keydown", key);
  }, [shown]);
}

const tile =
  "inline-flex size-7 flex-none items-center justify-center rounded-[8px] max-sm:size-8";

/** Any other assistant: no one app's icon, a plug on a grey tile. */
export function OtherTile() {
  return (
    <span className={`${tile} bg-chip text-soft ring-1 ring-black/10`}>
      <Plug width={16} height={16} aria-hidden="true" />
    </span>
  );
}

/** Trying Menta on the web: the leaf's green, with a sparkle. */
export function WebTile() {
  return (
    <span className={`${tile} mascot-fill text-white`}>
      <Sparkle width={16} height={16} aria-hidden="true" />
    </span>
  );
}

/** A dropdown's white card, as the homepage's menu draws it. */
export const menuCard =
  "rounded-[20px] border border-line-card bg-white p-1.5 text-left shadow-[0_1px_2px_rgb(0_0_0/8%),0_12px_32px_-8px_rgb(0_0_0/22%)]";

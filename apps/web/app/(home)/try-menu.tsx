"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  menuCard,
  OtherTile,
  type PickItem,
  PickList,
  usePhone,
  WebTile,
} from "../_components/agent-picker";
import { Chevron } from "../_components/icons";
import { Modal, ModalHeader } from "../_components/modal";
import { SetupPrompt } from "../(app)/connect-agent";
import { ASSISTANTS } from "./assistants";

/**
 * The hero's and footer's "Install now" button: a click (or hovering it
 * with a mouse) opens a menu of each assistant, plus trying Menta on the
 * web. Until Menta is in every assistant's marketplace, an assistant opens
 * the setup prompt to copy.
 */
export function TryMenu({
  serverUrl,
  label,
  more,
  other,
  live,
  up = false,
}: {
  serverUrl: string;
  label: string;
  /** The phone sheet's title. */
  more: string;
  other: string;
  live: string;
  /** Open the menu above the button, where there's no room below (the footer). */
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useId();
  // While the mouse is over it the menu stays open, so a click doesn't shut it.
  const hovering = useRef(false);
  // On phones the menu is a sheet, like every menu in the app.
  const phone = usePhone();
  // The prompt takes over from the menu, so a hover that opened the menu
  // doesn't keep the button from closing it once the prompt is gone.
  const ask = () => {
    hovering.current = false;
    setPrompt(true);
  };
  const items: PickItem[] = [
    ...ASSISTANTS.map(({ icon, name }) => ({
      key: icon,
      label: name,
      icon,
      onSelect: ask,
    })),
    {
      key: "other",
      label: other,
      icon: <OtherTile />,
      onSelect: ask,
    },
    {
      key: "live",
      label: live,
      href: "/chat",
      divided: true,
      icon: <WebTile />,
    },
  ];

  useEffect(() => {
    if (!open || phone) {
      return;
    }
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, phone]);

  return (
    <div
      ref={root}
      className="relative"
      // Hover opens the dropdown, never a phone-width window's sheet, nor
      // behind the setup prompt (its dialog is inside this element, so moving
      // over it counts as entering).
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && !phone && !prompt) {
          hovering.current = true;
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && !phone) {
          hovering.current = false;
          setOpen(false);
        }
      }}
    >
      {/* One button: "Install now" and its chevron both open the menu. */}
      <button
        ref={toggle}
        type="button"
        aria-haspopup={phone ? "dialog" : "menu"}
        aria-expanded={open}
        aria-controls={open && !phone ? menu : undefined}
        onClick={() => setOpen((value) => hovering.current || !value)}
        className="raised inline-flex h-12 cursor-pointer items-stretch rounded-full bg-ink text-[15px] font-medium text-white transition-colors hover:bg-ink-hover"
      >
        <span className="inline-flex items-center pr-4 pl-[22px]">{label}</span>
        <span aria-hidden="true" className="my-3 w-px bg-white/20" />
        <span className="inline-flex items-center pr-4 pl-3">
          <Chevron
            width={16}
            height={16}
            aria-hidden="true"
            // It points where the menu opens while closed, and back once open.
            className={`transition-transform duration-200 ${open !== up ? "-rotate-90" : "rotate-90"}`}
          />
        </span>
      </button>
      {open && !phone ? (
        // The padding bridges the gap to the button, so the pointer can cross it without closing the menu.
        <div
          id={menu}
          className={`absolute left-1/2 z-30 w-[260px] -translate-x-1/2 ${up ? "bottom-full pb-2" : "top-full pt-2"}`}
        >
          <div data-up={up || undefined} className={`try-menu ${menuCard}`}>
            <PickList
              items={items}
              // A pick closes the dropdown (the setup prompt opens over the
              // page, not over it), with focus on the button for the prompt
              // to return to.
              onPicked={() => {
                toggle.current?.focus();
                setOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
      {open && phone ? (
        <Modal labelledBy={`${menu}-title`} onClose={() => setOpen(false)}>
          {(close) => (
            <div className="flex flex-col gap-3 p-5 text-left">
              <ModalHeader id={`${menu}-title`} title={more} close={close} />
              <PickList items={items} onPicked={close} />
            </div>
          )}
        </Modal>
      ) : null}
      {prompt ? (
        <SetupPrompt serverUrl={serverUrl} onClose={() => setPrompt(false)} />
      ) : null}
    </div>
  );
}

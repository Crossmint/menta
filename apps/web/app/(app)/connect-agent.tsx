"use client";

import Image from "next/image";
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { setupPrompt } from "../../lib/connect";
import { useI18n } from "../../lib/i18n/client";
import {
  menuCard,
  OtherTile,
  type PickItem,
  PickList,
  useMenuKeys,
  usePhone,
  WebTile,
} from "../_components/agent-picker";
import { Check, Chevron, Copy } from "../_components/icons";
import { Modal, ModalHeader } from "../_components/modal";
import { ASSISTANTS } from "../(home)/assistants";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Copies text and says so briefly. Without clipboard access it selects the
 * element with that id so the user can copy it.
 */
function useCopy() {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy(id: string, text: string, onFallback?: () => void) {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Some embedded browsers deny the async clipboard; a selection copy still works there.
      const node = document.getElementById(id);
      const selection = window.getSelection();
      if (node && selection) {
        selection.selectAllChildren(node);
      }
      if (!node || !selection || !document.execCommand("copy")) {
        onFallback?.();
        setCopied(false);
        setStatus(m.app.connect.selectToCopy);
        return;
      }
      selection.removeAllRanges();
    }
    setCopied(true);
    setStatus(m.app.connect.copied);
    timer.current = window.setTimeout(() => {
      setCopied(false);
      setStatus("");
    }, 2000);
  }
  return { copied, status, copy };
}

/** Both faces share one grid cell, so the control keeps its size when it flips. */
function Swap({
  on,
  idle,
  done,
}: {
  on: boolean;
  idle: ReactNode;
  done: ReactNode;
}) {
  const face =
    "col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-150";
  return (
    <span className="grid justify-items-center" aria-hidden="true">
      <span className={`${face} ${on ? "opacity-0" : ""}`}>{idle}</span>
      <span className={`${face} ${on ? "" : "opacity-0"}`}>{done}</span>
    </span>
  );
}

/** The setup prompt any agent can follow, to copy and paste into it, in the app's modal. */
export function SetupPrompt({
  serverUrl,
  onClose,
}: {
  serverUrl: string;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const t = m.app.connect;
  const { copied, status, copy } = useCopy();
  const [expanded, setExpanded] = useState(false);
  const prompt = setupPrompt(serverUrl);
  return (
    <Modal labelledBy="setup-prompt-title" onClose={onClose}>
      {(close) => (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <ModalHeader
            id="setup-prompt-title"
            title={t.promptTitle}
            lede={t.promptLede}
            close={close}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <pre
              id="setup-prompt"
              className={`well min-w-0 rounded-[14px] px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] whitespace-pre-wrap text-soft [overflow-wrap:anywhere] ${expanded ? "" : "max-h-[96px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_50%,transparent)]"}`}
            >
              {prompt}
            </pre>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls="setup-prompt"
              className={`tap relative self-start rounded text-[13px] text-muted underline underline-offset-2 hover:text-ink ${focus}`}
            >
              {expanded ? t.showLess : t.showFull}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void copy("setup-prompt", prompt, () => setExpanded(true))
              }
              aria-label={t.copyPrompt}
              className={`raised inline-flex h-11 min-w-[196px] items-center justify-center rounded-full px-5 font-medium text-white transition-colors max-[480px]:w-full ${copied ? "mascot-fill" : "bg-ink hover:bg-ink-hover"} ${focus}`}
            >
              <Swap
                on={copied}
                idle={
                  <>
                    <Copy width={16} height={16} />
                    {t.copyPrompt}
                  </>
                }
                done={
                  <>
                    <Check width={16} height={16} />
                    {t.copied}
                  </>
                }
              />
            </button>
            <span
              className={`text-[13px] transition-opacity ${copied ? "text-ink" : "opacity-0"}`}
              aria-hidden={!copied}
            >
              {t.nowPaste}
            </span>
          </div>
          <span className="sr-only" role="status">
            {status}
          </span>
        </div>
      )}
    </Modal>
  );
}

/**
 * One button for connecting an agent. It opens the agents to pick from: a
 * menu under it, or a sheet on phones. Grok Bot, ChatGPT and Claude open
 * where Menta is added to them; Muse and any other get the setup prompt.
 */
function AgentButton({
  label,
  bare,
  onOther,
}: {
  label: string;
  bare: boolean;
  onOther: () => void;
}) {
  const { m } = useI18n();
  const how = m.landing.how;
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const menu = useId();
  /** Where the dropdown sits: under the button, drawn over the page so no card clips it. */
  const [place, setPlace] = useState<{
    top: number;
    left: number;
    up: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || phone) {
      return;
    }
    const measure = () => {
      const box = button.current?.getBoundingClientRect();
      if (box) {
        // Above the button when there's no room for the list below it.
        const up = box.bottom + 260 > window.innerHeight && box.top > 260;
        setPlace({
          top: up ? box.top - 8 : box.bottom + 8,
          left: box.left + box.width / 2,
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

  // The dropdown closes on a click outside it or on Escape, like the homepage's.
  useEffect(() => {
    if (!open || phone) {
      return;
    }
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !list.current?.contains(target)) {
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

  const items: PickItem[] = [
    // Until Menta is in every assistant's marketplace, each one opens the
    // setup prompt rather than its connector page.
    ...ASSISTANTS.map(({ icon, name }) => ({
      key: icon,
      label: name,
      icon,
      onSelect: onOther,
    })),
    { key: "other", label: how.other, icon: <OtherTile />, onSelect: onOther },
    {
      key: "live",
      label: m.landing.hero.live,
      href: "/chat",
      divided: true,
      icon: <WebTile />,
    },
  ];

  return (
    <div
      ref={root}
      className={`relative ${bare ? "self-center" : "self-start"}`}
    >
      <button
        ref={button}
        type="button"
        aria-haspopup={phone ? "dialog" : "menu"}
        aria-expanded={open}
        aria-controls={open && !phone ? menu : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`raised tap relative inline-flex h-12 items-center gap-3 rounded-full bg-ink pr-4 pl-2 text-[15px] font-medium text-white transition-colors hover:bg-ink-hover ${focus}`}
      >
        <span className="flex flex-none -space-x-1.5">
          {ASSISTANTS.slice(0, 3).map(({ icon }) => (
            <Image
              key={icon}
              src={`/assistants/${icon}.png`}
              alt=""
              width={28}
              height={28}
              className="size-7 flex-none rounded-[8px] shadow-[0_0_0_2px_var(--color-ink)]"
            />
          ))}
        </span>
        {label}
        <Chevron
          width={16}
          height={16}
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "-rotate-90" : "rotate-90"}`}
        />
      </button>
      {open && !phone && place
        ? createPortal(
            <div
              ref={list}
              id={menu}
              style={{ top: place.top, left: place.left }}
              className={`fixed z-50 w-[260px] -translate-x-1/2 ${place.up ? "-translate-y-full" : ""}`}
            >
              <div
                data-up={place.up || undefined}
                className={`${menuCard} try-menu`}
              >
                <PickList
                  items={items}
                  onPicked={() => {
                    // Focus back on the button, where the setup prompt's modal returns it.
                    button.current?.focus();
                    setOpen(false);
                  }}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
      {open && phone ? (
        <Modal labelledBy="agent-picker-title" onClose={() => setOpen(false)}>
          {(close) => (
            <div className="flex flex-col gap-3 p-5">
              <ModalHeader
                id="agent-picker-title"
                title={label}
                close={close}
              />
              <PickList items={items} onPicked={close} />
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

/** Just the agent picker's button ("Connect"), with its setup prompt: Home's first setup step. */
export function ChooseAgent({ serverUrl }: { serverUrl: string }) {
  const { m } = useI18n();
  const [other, setOther] = useState(false);
  return (
    <>
      <AgentButton
        label={m.app.home.connect}
        bare={false}
        onOther={() => setOther(true)}
      />
      {other ? (
        <SetupPrompt serverUrl={serverUrl} onClose={() => setOther(false)} />
      ) : null}
    </>
  );
}

/**
 * Connecting an agent: a heading, a line, and one button that opens the
 * assistants Menta plugs into (links), and for any other agent a prompt to
 * copy and paste into it. Transactions shows it until an agent is connected;
 * Connections shows it on its own, or under the connected agents.
 */
export function ConnectAgent({
  serverUrl,
  another = false,
  bare = false,
  heading,
  lede,
}: {
  serverUrl: string;
  /** Some agent is connected already: offers to connect another. */
  another?: boolean;
  /** Inside another card (the empty transactions table): no card of its own, centered. */
  bare?: boolean;
  /** The place's own words in place of "Connect your agent" and its line. */
  heading?: string;
  lede?: string;
}) {
  const { m } = useI18n();
  const t = m.app.connect;
  const [other, setOther] = useState(false);
  return (
    <section
      aria-labelledby="connect-agent-title"
      className={`flex flex-col gap-6 p-6 md:p-8 ${bare ? "items-center pt-2 text-center" : "panel"}`}
    >
      <div className={`flex flex-col gap-1.5 ${bare ? "items-center" : ""}`}>
        <h2
          id="connect-agent-title"
          className="m-0 text-[22px] font-semibold tracking-[-0.03em]"
        >
          {heading ?? (another ? t.another : t.title)}
        </h2>
        <p className="m-0 max-w-[520px] text-[15px] text-pretty text-quiet">
          {lede ?? t.lede}
        </p>
      </div>
      <AgentButton
        label={t.choose}
        bare={bare}
        onOther={() => setOther(true)}
      />
      {other ? (
        <SetupPrompt serverUrl={serverUrl} onClose={() => setOther(false)} />
      ) : null}
    </section>
  );
}

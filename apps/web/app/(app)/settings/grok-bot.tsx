"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  deliveryLine,
  deliveryProblem,
  type LastDelivery,
  testNote,
} from "../../../lib/client/grok-bot";
import { useI18n } from "../../../lib/i18n/client";
import { rich } from "../../../lib/i18n/rich";
import { railInput } from "../../_components/address-form";
import { Collapse } from "../../_components/collapse";
import { Check, Copy } from "../../_components/icons";
import {
  ConfirmModal,
  Modal,
  ModalActions,
  ModalHeader,
} from "../../_components/modal";
import { Switch } from "../../_components/switch";
import { pill, primary, rowButton, secondaryButton } from "./section";

interface Setup {
  /** What to say in Grok Bot ("Turn on Menta updates"). */
  readonly phrase?: string;
  /** The routine's instruction, for setting it up by hand. */
  readonly instruction?: string;
}

/** What /api/grok-bot says. Never the key: only its last four characters. */
type Status =
  | (Setup & { readonly available: boolean; readonly configured: false })
  | (Setup & {
      readonly available: true;
      readonly configured: true;
      readonly enabled: boolean;
      readonly host: string;
      readonly keyHint: string;
      readonly keyReadable: boolean;
      readonly lastDelivery: LastDelivery | null;
    });

type Test = { ok: boolean; error?: string };

/** A copy button for `text`; where the clipboard is denied, selects `target` instead. */
function CopyButton({
  text,
  target,
  label,
}: {
  text: string;
  target: string;
  label: string;
}) {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Some embedded browsers deny the async clipboard; select it instead.
      const node = document.getElementById(target);
      const selection = window.getSelection();
      if (node && selection) {
        selection.selectAllChildren(node);
      }
      return;
    }
    setCopied(true);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        className="raised-light inline-flex h-8 flex-none items-center gap-1.5 self-start rounded-full border border-line-card bg-white px-3 text-[13px] font-medium text-soft hover:text-ink"
      >
        {copied ? (
          <Check
            width={13}
            height={13}
            aria-hidden="true"
            className="text-leaf"
          />
        ) : (
          <Copy width={13} height={13} aria-hidden="true" />
        )}
        {copied ? m.settings.grokBot.copied : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? m.settings.grokBot.copied : ""}
      </span>
    </>
  );
}

/** The routine's instruction with a copy button. */
function Instruction({ text }: { text: string }) {
  const { m } = useI18n();
  return (
    <div className="well flex flex-col gap-2 rounded-[14px] p-3.5">
      <p
        id="grok-bot-instruction"
        className="text-[13px] leading-relaxed text-soft [overflow-wrap:anywhere]"
      >
        {text}
      </p>
      <CopyButton
        text={text}
        target="grok-bot-instruction"
        label={m.settings.grokBot.copyInstruction}
      />
    </div>
  );
}

/**
 * The routine's Webhook URL and key, pasted from Grok Bot's routine panel.
 * The key field also takes the panel's Authorization header. Saving sends a
 * test. The key never comes back.
 */
function RoutineForm({
  onSaved,
  onCancel,
  onBusy,
}: {
  onSaved: (status: Status, test: Test | null) => void;
  onCancel: () => void;
  /** Saving: the modal holds still until it's done. */
  onBusy: (busy: boolean) => void;
}) {
  const { m } = useI18n();
  const t = m.settings.grokBot;
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<{ field: string; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    onBusy(true);
    setError(null);
    const response = await fetch("/api/grok-bot", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, key }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setSaving(false);
    onBusy(false);
    if (response?.ok && body) {
      setKey("");
      onSaved(body, body.test ?? null);
      return;
    }
    setError({
      field: body?.field ?? "",
      text: body?.error ?? t.saveFailed,
    });
  }
  return (
    <form
      onSubmit={(event) => void save(event)}
      className="flex flex-col gap-3"
    >
      <p className="text-[13px] text-muted">{t.pasteIntro}</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">{t.webhookUrl}</span>
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          required
          placeholder="https://…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={error?.field === "url"}
          className={railInput}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">{t.key}</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          placeholder={t.keyPlaceholder}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          aria-invalid={error?.field === "key"}
          className={railInput}
        />
      </label>
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error.text}
        </p>
      ) : null}
      <p className="m-0 text-[13px] text-muted">{t.savingSendsTest}</p>
      <ModalActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={secondaryButton}
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={saving || !url.trim() || !key.trim()}
          className={primary}
        >
          {saving ? t.saving : t.save}
        </button>
      </ModalActions>
    </form>
  );
}

/** Setting it up without the phrase: the routine's instruction and the steps. */
function ByHand({ instruction }: { instruction: string }) {
  const { m } = useI18n();
  const t = m.settings.grokBot;
  return (
    <details className="group text-[13px]">
      <summary className="cursor-pointer list-none text-soft hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">{t.byHand}</span>
        <span className="hidden group-open:inline">{t.hideSteps}</span>
      </summary>
      <ol className="mt-3 flex list-decimal flex-col gap-3 pl-5 text-soft">
        <li className="flex flex-col gap-2">
          <span>{t.steps.create}</span>
          <Instruction text={instruction} />
        </li>
        <li>
          {rich(t.steps.trigger, {
            trigger: (
              <span className="font-medium text-ink">
                {t.steps.triggerName}
              </span>
            ),
          })}
        </li>
        <li>
          {rich(t.steps.paste, {
            url: <span className="font-medium text-ink">{t.steps.url}</span>,
            key: <span className="font-medium text-ink">{t.steps.key}</span>,
          })}
        </li>
      </ol>
    </details>
  );
}

/**
 * Grok Bot updates, a row of the Notifications card: the user's own Grok Bot
 * routine, started by a webhook when a checkout Grok Bot followed needs them
 * or ends. Grok Bot creates the routine when the user says the phrase; the
 * URL and key are pasted here, in a modal, never in chat.
 */
export function GrokBotUpdates() {
  const { m, f } = useI18n();
  const t = m.settings.grokBot;
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<"test" | "toggle" | "remove" | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  /** The setup modal: "setup" before there's a routine, "replace" after a failed delivery. */
  const [modal, setModal] = useState<"setup" | "replace" | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** Grok Bot sends people to #grok-bot: open the setup once the status says it isn't set up. */
  const [fromLink, setFromLink] = useState(false);
  useEffect(() => {
    setFromLink(window.location.hash === "#grok-bot");
  }, []);

  function take(body: Status) {
    setStatus(body);
    if (body.instruction || body.phrase) {
      setSetup({ phrase: body.phrase, instruction: body.instruction });
    }
  }

  useEffect(() => {
    void fetch("/api/grok-bot", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Status | null) => {
        if (body) {
          setStatus(body);
          setSetup({ phrase: body.phrase, instruction: body.instruction });
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (fromLink && status?.available && !status.configured) {
      setModal("setup");
      setFromLink(false);
    }
  }, [fromLink, status]);

  async function call(
    kind: "test" | "toggle" | "remove",
    path: string,
    init: RequestInit,
  ) {
    setBusy(kind);
    setFailed(false);
    setTest(null);
    const response = await fetch(path, init).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(null);
    return { ok: Boolean(response?.ok), body };
  }

  async function sendTest() {
    const { ok, body } = await call("test", "/api/grok-bot/test", {
      method: "POST",
    });
    if (body?.status) {
      take(body.status);
    }
    setTest(ok ? { ok: true } : { ok: false, error: body?.error });
  }

  async function toggle(enabled: boolean) {
    const { ok, body } = await call("toggle", "/api/grok-bot", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (ok && body) {
      take(body);
    } else {
      setFailed(true);
    }
  }

  async function remove() {
    const { ok, body } = await call("remove", "/api/grok-bot", {
      method: "DELETE",
    });
    setConfirming(false);
    if (ok && body) {
      take(body);
    } else {
      setFailed(true);
    }
  }

  const saved = status?.configured ? status : null;
  const note = testNote(test);
  // A failed test already says what went wrong, just below.
  const problem = saved
    ? !saved.keyReadable
      ? t.keyUnreadable
      : note && !note.ok
        ? null
        : deliveryProblem(saved.lastDelivery)
    : null;
  const phrase = setup.phrase ?? "Turn on Menta updates";

  return (
    // Folds away when this server doesn't offer Grok Bot updates.
    <Collapse open={status?.available !== false}>
      <div id="grok-bot" className="scroll-mt-6">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-5 py-3.5">
          <span className="inline-flex size-9 flex-none overflow-hidden rounded-[10px] bg-white ring-1 ring-black/[0.06]">
            {/* biome-ignore lint/performance/noImgElement: a fixed local app icon at its natural size */}
            <img
              src="/assistants/grokbot.png"
              alt=""
              className="size-full object-cover"
            />
          </span>
          <span className="flex min-w-0 flex-[1_1_200px] flex-col">
            <span className="font-medium">Grok Bot</span>
            <span className="text-[13px] text-muted [overflow-wrap:anywhere]">
              {status === null
                ? failed
                  ? t.loadFailed
                  : m.settings.loading
                : saved
                  ? f(saved.enabled ? t.status : t.statusPaused, {
                      hint: saved.keyHint,
                      delivery: deliveryLine(saved.lastDelivery),
                    })
                  : t.notSetUp}
            </span>
          </span>
          {saved ? (
            <span className="flex flex-none items-center gap-1">
              <button
                type="button"
                onClick={() => void sendTest()}
                disabled={busy !== null || !saved.enabled}
                className={rowButton}
              >
                {busy === "test" ? t.sending : t.sendTest}
              </button>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setConfirming(true)}
                disabled={busy !== null}
                className={rowButton}
              >
                {t.remove}
              </button>
              <span className="ml-1.5 inline-flex">
                <Switch
                  checked={busy === "toggle" ? !saved.enabled : saved.enabled}
                  busy={busy !== null}
                  onChange={(on) => void toggle(on)}
                  label={t.switchLabel}
                />
              </span>
            </span>
          ) : status ? (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setModal("setup")}
              className={pill}
            >
              {t.setUp}
            </button>
          ) : null}
        </div>
        <Collapse open={Boolean(saved && (problem || (note && !note.ok)))}>
          <div className="flex flex-col gap-2 border-t border-black/[0.05] px-5 py-3.5 text-[13px]">
            {problem ? <p className="text-danger">{problem}</p> : null}
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setModal("replace")}
              className="self-start font-medium text-soft transition-colors hover:text-ink"
            >
              {t.replace}
            </button>
          </div>
        </Collapse>
        <Collapse open={Boolean(note || (failed && status !== null))}>
          <div className="flex flex-col gap-1 border-t border-black/[0.05] px-5 py-3 text-[13px]">
            {note ? (
              <p
                role={note.ok ? "status" : "alert"}
                className={note.ok ? "text-muted" : "text-danger"}
              >
                {note.text}
              </p>
            ) : null}
            {failed && status !== null ? (
              <p role="alert" className="text-danger">
                {t.updateFailed}
              </p>
            ) : null}
          </div>
        </Collapse>
      </div>
      {modal ? (
        <Modal
          labelledBy="grok-bot-title"
          busy={saving}
          onClose={() => setModal(null)}
        >
          {(close) => (
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <ModalHeader
                id="grok-bot-title"
                title={modal === "replace" ? t.replace : t.setUpTitle}
                lede={modal === "setup" ? t.explainer : undefined}
                close={close}
              />
              {modal === "setup" ? (
                <div className="well flex flex-wrap items-center gap-3 rounded-[14px] p-3.5 text-[14px]">
                  <span className="min-w-0 flex-[1_1_200px]">
                    {t.say}{" "}
                    <span id="grok-bot-phrase" className="font-medium">
                      {phrase}
                    </span>
                  </span>
                  <CopyButton
                    text={phrase}
                    target="grok-bot-phrase"
                    label={t.copy}
                  />
                </div>
              ) : null}
              <RoutineForm
                onBusy={setSaving}
                onSaved={(body, result) => {
                  take(body);
                  setTest(result);
                  setModal(null);
                }}
                onCancel={close}
              />
              {modal === "setup" && setup.instruction ? (
                <ByHand instruction={setup.instruction} />
              ) : null}
            </div>
          )}
        </Modal>
      ) : null}
      {confirming ? (
        <ConfirmModal
          id="grok-bot-remove-title"
          title={t.removeTitle}
          text={t.removeText}
          confirm={t.remove}
          busyLabel={t.removing}
          cancel={t.cancel}
          busy={busy === "remove"}
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </Collapse>
  );
}

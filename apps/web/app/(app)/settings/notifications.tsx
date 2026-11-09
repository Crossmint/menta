"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "../../../lib/client/account";
import {
  disableNotifications,
  enableNotifications,
  notificationState,
  supportedNotifications,
  testNotifications,
} from "../../../lib/client/notifications";
import { useI18n } from "../../../lib/i18n/client";
import { Monitor } from "../../_components/icons";
import { Switch } from "../../_components/switch";
import { GrokBotUpdates } from "./grok-bot";
import { rowButton } from "./section";

/** Where checkout updates go: this browser (Web Push) and Grok Bot. */
export function Notifications() {
  return (
    <div className="panel divide-y divide-black/[0.05] overflow-hidden">
      <BrowserNotifications />
      {/* grok_bot_updates_setup links here (`/settings#grok-bot`, sent on by Settings). */}
      <div id="grok-bot" className="scroll-mt-6">
        <GrokBotUpdates />
      </div>
    </div>
  );
}

function BrowserNotifications() {
  const { m } = useI18n();
  const t = m.settings.notifications;
  const { me } = useAccount();
  const [state, setState] = useState<Awaited<
    ReturnType<typeof notificationState>
  > | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  /** The switch's new position while it saves. */
  const [pending, setPending] = useState<boolean | null>(null);
  const load = useCallback(
    async (userId: string) => {
      setError(null);
      try {
        setState(await notificationState(userId));
      } catch (e) {
        setError(e instanceof Error ? e.message : t.loadFailed);
      }
    },
    [t],
  );
  useEffect(() => {
    const supported = supportedNotifications();
    setSupported(supported);
    const refresh = () => {
      if (me && supported) {
        void load(me.id);
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [me, load]);
  async function change(on: boolean) {
    if (!me || !state?.publicKey) {
      return;
    }
    setBusy(true);
    setPending(on);
    setError(null);
    setSent(false);
    try {
      if (on) {
        await enableNotifications(me.id, state.publicKey);
      } else {
        await disableNotifications();
      }
      await load(me.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.updateFailed);
    } finally {
      setPending(null);
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError(null);
    try {
      await testNotifications();
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.testFailed);
    } finally {
      setBusy(false);
    }
  }
  const blocked = supported && Notification.permission === "denied";
  const ready = supported && state?.available;
  const line =
    supported === false
      ? t.unsupported
      : state === null
        ? error
          ? t.couldntLoad
          : m.settings.loading
        : !state.available
          ? t.unavailable
          : blocked
            ? t.blocked
            : state.enabled
              ? t.on
              : state.enrolled
                ? t.reconnect
                : t.off;
  return (
    <div className="flex flex-col gap-2 px-5 py-3.5">
      <div className="flex items-center gap-3.5">
        <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-white text-ink ring-1 ring-black/[0.06]">
          <Monitor />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{t.thisBrowser}</span>
          <span className="text-[13px] text-muted">{line}</span>
        </span>
        {state?.enabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void test()}
            className={rowButton}
          >
            {t.sendTest}
          </button>
        ) : null}
        {state?.enrolled && !state.enabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void change(false)}
            className={rowButton}
          >
            {t.turnOff}
          </button>
        ) : null}
        {ready ? (
          <span className="inline-flex animate-[fade-in_200ms_ease-out] motion-reduce:animate-none">
            <Switch
              checked={pending ?? state.enabled}
              busy={busy}
              disabled={Boolean(blocked)}
              onChange={(on) => void change(on)}
              label={t.switchLabel}
            />
          </span>
        ) : null}
      </div>
      {sent ? (
        <p
          role="status"
          className="animate-[fade-in_150ms_ease-out] text-[13px] text-muted motion-reduce:animate-none"
        >
          {t.testSent}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="animate-[fade-in_150ms_ease-out] text-[13px] text-danger motion-reduce:animate-none"
        >
          {error}{" "}
          <button
            type="button"
            onClick={() => me && void load(me.id)}
            className="underline"
          >
            {t.retry}
          </button>
        </p>
      ) : null}
    </div>
  );
}

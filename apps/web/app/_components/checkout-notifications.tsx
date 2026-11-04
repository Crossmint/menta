"use client";

import { useEffect, useState } from "react";
import { useAccount } from "../../lib/client/account";
import {
  enableNotifications,
  notificationState,
  supportedNotifications,
} from "../../lib/client/notifications";
import { Collapse } from "./collapse";
import { Bell, Check } from "./icons";

/** Opt in where the wait starts; the browser owns the actual permission dialog. */
export function CheckoutNotifications() {
  const { me } = useAccount();
  const [state, setState] = useState<Awaited<
    ReturnType<typeof notificationState>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  /** Just turned on: the row says so before it folds away. */
  const [justOn, setJustOn] = useState(false);
  useEffect(() => {
    if (!me || !supportedNotifications()) {
      return;
    }
    let alive = true;
    const refresh = () => {
      void notificationState(me.id)
        .then((value) => {
          if (alive) {
            setState(value);
          }
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
    };
  }, [me]);
  // Once on, it says so for a moment, then folds away.
  useEffect(() => {
    if (!justOn) {
      return;
    }
    const timer = window.setTimeout(() => setJustOn(false), 2500);
    return () => window.clearTimeout(timer);
  }, [justOn]);
  const on = Boolean(state?.enabled) && Notification.permission === "granted";
  if (!me || !state?.available || !state.publicKey) {
    return null;
  }
  const blocked = Notification.permission === "denied";
  async function enable() {
    if (!me || !state?.publicKey) {
      return;
    }
    if (blocked) {
      setShowPermissionHelp((shown) => !shown);
      return;
    }
    setBusy(true);
    setError(false);
    setShowPermissionHelp(false);
    try {
      const enabled = await enableNotifications(me.id, state.publicKey);
      if (enabled) {
        setState({ ...state, enabled: true, enrolled: true });
        setJustOn(true);
      } else if (Notification.permission === "denied") {
        setShowPermissionHelp(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    // Stays mounted while it folds, so "Notifications are on" leaves with it.
    <Collapse open={!on || justOn} appear>
      <div className="pt-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[14px] bg-black/[0.03] py-1.5 pr-1.5 pl-3 text-[13px]">
          {on ? (
            <Check
              width={14}
              height={14}
              className="flex-none text-leaf"
              aria-hidden="true"
            />
          ) : (
            <Bell
              width={15}
              height={15}
              className="flex-none text-quiet"
              aria-hidden="true"
            />
          )}
          <span
            role={on || error ? "status" : undefined}
            className={`min-w-0 flex-1 ${error ? "text-danger" : "text-soft"}`}
          >
            {on
              ? "Notifications are on"
              : error
                ? "Couldn't turn on notifications."
                : blocked
                  ? "Notifications are blocked for this site."
                  : "Get a notification when the store needs you."}
          </span>
          {on ? null : (
            <button
              type="button"
              disabled={busy}
              aria-expanded={blocked ? showPermissionHelp : undefined}
              onClick={() => void enable()}
              className="tap relative inline-flex h-7 flex-none items-center gap-1.5 rounded-full border border-line-card bg-white px-3 text-[12.5px] font-medium text-soft raised-light hover:text-ink disabled:opacity-60"
            >
              {busy ? <span className="spinner size-3" /> : null}
              {busy
                ? "Turning on…"
                : error
                  ? "Try again"
                  : blocked
                    ? "How to allow"
                    : "Notify me"}
            </button>
          )}
          {showPermissionHelp ? (
            <span className="basis-full animate-[fade-in_150ms_ease-out] pb-1 text-[12.5px] text-muted motion-reduce:animate-none">
              Open your browser's site settings for this page (the icon next to
              the address), allow notifications, then come back.
            </span>
          ) : null}
        </div>
      </div>
    </Collapse>
  );
}

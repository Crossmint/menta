"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignOut } from "../../../lib/client/account";
import { useI18n } from "../../../lib/i18n/client";
import { Avatar } from "../../_components/sidebar";
import { pill } from "./section";

/** Who is signed in, and signing out. */
export function AccountDetails() {
  const { m } = useI18n();
  const t = m.settings.account;
  const { me } = useAccount();
  const { signingOut, signOut } = useSignOut();
  return (
    <div className="panel flex flex-wrap items-center gap-3.5 px-5 py-3.5">
      <Avatar me={me} className="size-9 text-xs" />
      <span className="flex min-w-0 flex-[1_1_200px] flex-col">
        <span className="truncate font-medium">
          {me?.name ?? me?.email ?? " "}
        </span>
        {me?.name && me.email ? (
          <span className="truncate text-[13px] text-muted">{me.email}</span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={signingOut}
        className={pill}
      >
        {signingOut ? t.signingOut : t.signOut}
      </button>
    </div>
  );
}

/** The store sign-ins kept between checkouts (the user's Crossmint browser profile), and signing out of them. */
export function StoreSignIns() {
  const { m } = useI18n();
  const t = m.settings.account;
  const [saved, setSaved] = useState<boolean | undefined>();
  const [failed, setFailed] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    void fetch("/api/store-sign-ins", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { saved: boolean } | null) => {
        if (body) {
          setSaved(body.saved);
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
  }, []);

  async function clear() {
    setClearing(true);
    setFailed(false);
    const response = await fetch("/api/store-sign-ins", {
      method: "DELETE",
    }).catch(() => null);
    if (response?.ok) {
      setSaved(false);
    } else {
      setFailed(true);
    }
    setClearing(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="panel flex flex-wrap items-center gap-3.5 px-5 py-3.5">
        <span
          key={String(saved)}
          className="flex min-w-0 flex-[1_1_240px] animate-[fade-in_200ms_ease-out] flex-col motion-reduce:animate-none"
        >
          <span className="font-medium">
            {saved
              ? t.storesRemember
              : saved === false
                ? t.noStoreSignIns
                : t.storeSignIns}
          </span>
          <span className="text-[13px] text-muted">
            {saved
              ? t.storesRememberNote
              : saved === false
                ? t.noStoreSignInsNote
                : m.settings.loading}
          </span>
        </span>
        {saved ? (
          <button
            type="button"
            onClick={() => void clear()}
            disabled={clearing}
            className={pill}
          >
            {clearing ? t.signingOut : t.signOutStores}
          </button>
        ) : null}
      </div>
      {failed ? (
        <p role="alert" className="text-[13px] text-danger">
          {t.updateFailed}
        </p>
      ) : null}
    </div>
  );
}

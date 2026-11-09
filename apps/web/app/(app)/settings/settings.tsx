"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useSignOut } from "../../../lib/client/account";
import { useI18n } from "../../../lib/i18n/client";
import { helpPath, LANGUAGES, LOCALES } from "../../../lib/i18n/locales";
import { LEGAL } from "../../../lib/site";
import {
  Bell,
  Doc,
  Globe,
  Lock,
  LogOut,
  Mail,
  Person,
  Plug,
  Store,
  Support,
  Translate,
  Trash,
} from "../../_components/icons";
import { ConfirmModal } from "../../_components/modal";
import { ListGroup, ListRow, ProfileHeader } from "../list";
import { BackHeader } from "../page-shell";
import { movedTo } from "./sections";

const icon = { width: 20, height: 20 };

/**
 * Settings: who you are on top, then each section as a row that opens its
 * own page, the help pages, and logging out or deleting the account here.
 * Anchors that moved (`#grok-bot`, `#addresses`, `#cards`) are sent on.
 */
export function Settings() {
  const { m, locale } = useI18n();
  const t = m.app.settingsPage;
  const router = useRouter();
  const { me } = useAccount();
  const { signingOut, signOut } = useSignOut();
  const [deleting, setDeleting] = useState<"ask" | "busy" | "failed" | null>(
    null,
  );

  useEffect(() => {
    const anchor = decodeURIComponent(window.location.hash.slice(1));
    const moved = movedTo(anchor);
    if (moved) {
      router.replace(moved);
    }
  }, [router]);

  async function deleteAccount() {
    setDeleting("busy");
    const response = await fetch("/api/me", { method: "DELETE" }).catch(
      () => null,
    );
    if (response?.ok) {
      window.location.replace("/");
    } else {
      setDeleting("failed");
    }
  }

  const language = LOCALES.includes(locale) ? LANGUAGES[locale].name : null;

  return (
    <main className="flex min-h-dvh flex-col px-2 sm:px-8">
      <BackHeader href="/home" title={t.title} className="md:hidden" />
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-2 pt-4 pb-16 animate-[fade-in_200ms_ease-out] motion-reduce:animate-none sm:px-0 md:pt-14">
        <ProfileHeader />
        <ListGroup>
          <ListRow
            icon={<Person {...icon} />}
            label={t.name}
            value={me?.name}
          />
          <ListRow
            icon={<Mail {...icon} />}
            label={t.email}
            value={me?.email}
          />
          <ListRow
            icon={<Store {...icon} />}
            label={t.deliveryAddresses}
            href="/settings/delivery-addresses"
          />
        </ListGroup>
        <ListGroup>
          <ListRow
            icon={<Plug {...icon} />}
            label={t.agents}
            href="/settings/agents"
          />
          <ListRow
            icon={<Globe {...icon} />}
            label={m.settings.account.storeSignIns}
            href="/settings/store-sign-ins"
          />
        </ListGroup>
        <ListGroup>
          <ListRow
            icon={<Bell {...icon} />}
            label={t.sections.notifications.title}
            href="/settings/notifications"
          />
          <ListRow
            icon={<Translate {...icon} />}
            label={t.language}
            value={language}
            href="/settings/language"
          />
        </ListGroup>
        <ListGroup>
          <ListRow
            icon={<Support {...icon} />}
            label={t.getSupport}
            href={helpPath(locale)}
            external
          />
          <ListRow
            icon={<Doc {...icon} />}
            label={t.terms}
            href={LEGAL.terms}
            external
          />
          <ListRow
            icon={<Lock {...icon} />}
            label={t.privacy}
            href={LEGAL.privacy}
            external
          />
        </ListGroup>
        <ListGroup>
          <ListRow
            icon={<LogOut {...icon} />}
            label={signingOut ? t.loggingOut : t.logOut}
            onClick={() => void signOut()}
            disabled={signingOut}
          />
          <ListRow
            icon={<Trash {...icon} />}
            label={t.deleteAccount}
            onClick={() => setDeleting("ask")}
            danger
            dialog
          />
        </ListGroup>
      </div>
      {deleting ? (
        <ConfirmModal
          id="delete-account-title"
          title={t.deleteTitle}
          text={t.deleteText}
          confirm={t.deleteConfirm}
          busyLabel={t.deleting}
          cancel={t.cancel}
          busy={deleting === "busy"}
          error={deleting === "failed" ? t.deleteFailed : null}
          onConfirm={() => void deleteAccount()}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </main>
  );
}

"use client";

import type { Host } from "@oca/client/secure-page";
import { useEffect, useState } from "react";
import { BRAND_NAME } from "../../lib/brand";
import type { Me } from "../../lib/client/account";
import { useI18n } from "../../lib/i18n/client";
import { rich } from "../../lib/i18n/rich";
import { AgentIcon } from "./agent-icon";
import { Avatar } from "./sidebar";

/** The signed-in user, for the standalone pages outside the app's layout. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    void fetch("/api/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) {
          setMe(await response.json());
        }
      })
      .catch(() => {});
  }, []);
  return me;
}

/** The header's end on the secure and spending limit pages: who's signed in (on a phone, just the avatar). */
export function SignedIn({ me }: { me: Me | null }) {
  return me?.email ? (
    <span className="flex min-w-0 items-center gap-2 text-[13px] text-quiet">
      <span className="hidden min-w-0 truncate sm:inline">{me.email}</span>
      <Avatar me={me} className="size-7 text-[11px]" />
    </span>
  ) : null;
}

/** An app's icon and name, inside a line of text. */
function Named({ name }: { name: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-ink">
      <AgentIcon
        name={name}
        className="size-[18px] flex-none self-center rounded-[5px] text-[7px]"
      />
      {name}
    </span>
  );
}

const subtitle = "m-0 text-[15px] leading-relaxed text-pretty text-quiet";

/** Under a store step's title: Menta needs something to go on at the store. */
export function MentaNeeds({ store }: { store: string }) {
  const { m } = useI18n();
  return (
    <p className={subtitle}>
      {rich(m.checkout.store.needsInfo, {
        menta: <Named name={BRAND_NAME} />,
        store: <strong className="font-semibold text-ink">{store}</strong>,
      })}
    </p>
  );
}

/** Under the spending limit's title: what approving it allows the assistant. */
export function AllowCard({ host }: { host: Host | null }) {
  const { m } = useI18n();
  return (
    <p className={subtitle}>
      {host
        ? rich(m.checkout.limit.allow, { host: <Named name={host.name} /> })
        : m.checkout.limit.allowAny}
    </p>
  );
}

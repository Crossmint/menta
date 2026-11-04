"use client";
import type { LimitRequest } from "@oca/agent/crossmint";
import { backLink, hostFrom } from "@oca/client/secure-page";
import { use, useEffect, useState } from "react";
import { checkoutAction, money } from "../../../lib/client/checkouts";
import { useI18n } from "../../../lib/i18n/client";
import { rich } from "../../../lib/i18n/rich";
import { HostName } from "../../_components/host-name";
import { Check, Close, Warning } from "../../_components/icons";
import {
  type Expiry,
  expiryOf,
  LimitForm,
  type LimitMade,
  storeUrl,
} from "../../_components/limit-form";
import { PoweredByCrossmint } from "../../_components/powered-by";
import {
  Outcome,
  primaryAction,
  Standalone,
} from "../../_components/standalone";

/** A store's site, as the form names it ("https://www.ubereats.com/" → "ubereats.com"). */
function siteOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * A spending limit an assistant asked for, made for that one request, like
 * the secure page's private step: what it's for and how much, prefilled and
 * editable, then the user's saved cards (the default first) and Crossmint's
 * Approve. The link carries only a sealed token (`/spending-limit/<token>`):
 * the page opens it through the API for the signed-in user it was made for.
 * With a checkout in it, the approved limit pays that checkout's open payment
 * at once. Only the user's click on Approve makes it.
 */
export default function SpendingLimitRequest({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { m, f, tag } = useI18n();
  const t = m.checkout.limit;
  const [asked, setAsked] = useState<LimitRequest | null | undefined>();
  const [made, setMade] = useState<
    (LimitMade & { paying: string | null }) | null
  >(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    let stopped = false;
    void fetch(`/api/spending-limit-requests/${encodeURIComponent(token)}`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((body) => {
        if (!stopped) {
          setAsked(body);
        }
      });
    return () => {
      stopped = true;
    };
  }, [token]);

  const host = hostFrom(asked?.via ?? null);
  const back = backLink(host, null);
  const backButton = back ? (
    <a href={back.href} className={primaryAction}>
      {back.label}
    </a>
  ) : null;

  if (asked === undefined) {
    return (
      <Standalone home="/home" size="step">
        {null}
      </Standalone>
    );
  }
  if (asked === null) {
    return (
      <Standalone home="/home" size="outcome">
        <Outcome
          icon={<Warning width={26} height={26} />}
          title={t.missing}
          lede={t.missingLede}
        >
          <a href="/spending-limits" className={primaryAction}>
            {t.yourLimits}
          </a>
        </Outcome>
      </Standalone>
    );
  }

  const runId = asked.runId ?? null;
  const store = storeUrl(asked.store ?? null);
  const askedDay = /^\d{4}-\d{2}-\d{2}$/.test(asked.expires)
    ? new Date(`${asked.expires}T12:00:00`)
    : null;
  const custom = askedDay !== null && askedDay > new Date();
  const expiry: Expiry = custom
    ? "custom"
    : asked.expires === "week"
      ? "week"
      : "month";

  /** Approved: pay the checkout that asked for it, if it's still waiting. */
  async function approved(limit: LimitMade) {
    let paying: string | null = null;
    if (runId) {
      try {
        const view = await fetch(
          `/api/checkouts/${encodeURIComponent(runId)}`,
        ).then((response) => (response.ok ? response.json() : null));
        const payment = view?.pending?.kind === "payment" ? view.pending : null;
        // Only a limit that covers it: Crossmint takes one answer per payment.
        if (
          payment &&
          payment.amount.currency.toUpperCase() ===
            limit.amount.currency.toUpperCase() &&
          Number(limit.amount.value) >= Number(payment.amount.amount) &&
          (limit.store === null || limit.store === siteOf(payment.merchant.url))
        ) {
          await checkoutAction(runId, {
            action: "approve",
            requestId: payment.requestId,
            orderIntentId: limit.orderIntentId,
          });
          paying = view.store ?? null;
        }
      } catch {
        // The limit stands; the checkout's own step still offers it.
      }
    }
    setMade({ ...limit, paying });
  }

  if (cancelled) {
    return (
      <Standalone home="/home" size="outcome">
        <Outcome
          icon={<Close width={26} height={26} />}
          title={t.cancelled}
          lede={t.cancelledLede}
        >
          {backButton}
        </Outcome>
      </Standalone>
    );
  }

  if (made) {
    return (
      <Standalone home="/home" size="outcome">
        <Outcome
          tone="done"
          icon={<Check width={28} height={28} />}
          title={t.approved}
          lede={`${f(t.approvedLede, {
            name: made.name,
            amount: money({
              amount: made.amount.value,
              currency: made.amount.currency,
            }),
            date: made.ends.toLocaleDateString(tag, { dateStyle: "medium" }),
          })}${made.paying ? ` ${f(t.paying, { store: made.paying })}` : ""}`}
        >
          {backButton}
        </Outcome>
      </Standalone>
    );
  }

  return (
    <Standalone home="/home" size="step">
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance md:text-[40px] md:tracking-[-0.05em]">
          {t.title}
        </h1>
        <p className="text-[15px] leading-snug text-pretty text-soft">
          {host
            ? rich(t.ledeNamed, { host: <HostName host={host} /> })
            : t.lede}
        </p>
      </div>
      <LimitForm
        start={{
          name: asked.name,
          amount: asked.amount,
          currency: asked.currency,
          store,
          expiry,
          day: custom && askedDay ? askedDay : expiryOf("month"),
        }}
        host={host}
        onApproved={(limit) => void approved(limit)}
        onCancel={() => setCancelled(true)}
      />
      <PoweredByCrossmint />
    </Standalone>
  );
}

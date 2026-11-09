"use client";

import { useEffect, useRef, useState } from "react";
import { disableNotifications } from "../../../lib/client/notifications";
import { useI18n } from "../../../lib/i18n/client";
import { rich } from "../../../lib/i18n/rich";
import { ConnectPair } from "../../_components/connect-pair";
import { Close, Warning } from "../../_components/icons";
import { Outcome, Standalone } from "../../_components/standalone";

interface Consent {
  readonly kind: "consent";
  readonly client: {
    readonly name: string;
    readonly description: string;
    readonly logoUrl?: string | null;
    /** Its official app icon in public/assistants, when we have one. */
    readonly icon?: string | null;
  };
  readonly returnsTo: string;
  readonly scopes: readonly { scope: string; grantable: boolean }[];
  readonly email: string | null;
}

type State =
  | { readonly kind: "loading" }
  | { readonly kind: "leaving"; readonly to: string }
  /** `message` is the server's own words; without it, a generic line (or the offline one). */
  | {
      readonly kind: "error";
      readonly message?: string;
      readonly offline?: boolean;
    }
  | Consent;

/** The OAuth request as Stytch forwarded it; `resource` may repeat. */
function requestParams() {
  const params: Record<string, string | string[]> = {};
  for (const [key, value] of new URL(window.location.href).searchParams) {
    const existing = params[key];
    if (key === "resource") {
      params[key] = [...(Array.isArray(existing) ? existing : []), value];
    } else if (existing === undefined) {
      params[key] = value;
    }
  }
  return params;
}

function here() {
  return `${window.location.pathname}${window.location.search}`;
}

/** The homepage's white card with only a hairline ring (landing.tsx). */
const hairlineCard =
  "rounded-[24px] bg-white shadow-[0_1px_3px_rgb(0_0_0/4%),inset_0_0_0_1px_rgb(0_0_0/6%),inset_0_-1px_0_rgb(0_0_0/6%)]";

/** A list mark in a small round chip: the leaf's green for what it can do. */
const chip =
  "mt-px flex size-5 flex-none items-center justify-center rounded-full";

const ok = (
  <span aria-hidden="true" className={`${chip} bg-leaf/[0.08] text-leaf`}>
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l4 4 10-10" />
    </svg>
  </span>
);

const offline: State = { kind: "error", offline: true };

/** One consent step; navigates away itself when sign-in or the assistant is next. */
async function consentStep(decision?: "allow" | "deny"): Promise<State> {
  const response = await fetch("/api/oauth/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      params: requestParams(),
      ...(decision ? { decision } : {}),
    }),
  });
  if (response.status === 401) {
    window.location.replace(`/login?next=${encodeURIComponent(here())}`);
    return { kind: "loading" };
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    return {
      kind: "error",
      message: typeof body?.error === "string" ? body.error : undefined,
    };
  }
  if (body.kind === "redirect") {
    window.location.replace(body.redirectUri);
    return { kind: "leaving", to: body.redirectUri };
  }
  return body as Consent;
}

export default function Authorize() {
  const { m, f } = useI18n();
  const t = m.auth.authorize;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    void consentStep()
      .catch(() => offline)
      .then(setState);
  }, []);

  async function decide(decision: "allow" | "deny") {
    setBusy(true);
    setState(await consentStep(decision).catch(() => offline));
    setBusy(false);
  }

  async function switchAccount() {
    setBusy(true);
    await disableNotifications().catch(() => {});
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
    window.location.replace(`/login?next=${encodeURIComponent(here())}`);
  }

  if (state.kind !== "consent") {
    return (
      <Standalone>
        {state.kind === "error" ? (
          <Outcome
            tone="attention"
            icon={<Warning width={28} height={28} />}
            title={t.cantConnect}
            lede={
              <span role="alert">
                {state.offline ? t.offline : (state.message ?? t.failed)}
              </span>
            }
          />
        ) : (
          <p className="flex items-center justify-center gap-2.5 text-[15px] text-quiet">
            <span className="spinner" aria-hidden="true" />
            {state.kind === "leaving" ? t.returning : t.checking}
          </p>
        )}
      </Standalone>
    );
  }

  const name = state.client.name || t.thisAssistant;
  const ungrantable = state.scopes.filter((scope) => !scope.grantable);
  return (
    <Standalone size="wide">
      <div className="flex flex-col items-center gap-7">
        <ConnectPair
          large
          assistant={{
            name,
            logoUrl: state.client.logoUrl ?? null,
            icon: state.client.icon ?? null,
          }}
        />

        <div className="flex flex-col items-center gap-2.5 text-center">
          <h1 className="max-w-[620px] text-[32px] leading-[1.08] font-semibold tracking-[-0.045em] text-balance sm:text-[40px]">
            {f(t.heading, { name })}
          </h1>
          <p className="text-[15px] text-quiet">
            {state.email ? f(t.signedInAs, { email: state.email }) : null}
            <button
              type="button"
              onClick={switchAccount}
              disabled={busy}
              className="tap relative text-soft underline underline-offset-2 hover:text-ink"
            >
              {t.notYou}
            </button>
          </p>
        </div>

        <div
          className={`flex w-full max-w-[560px] flex-col p-2 ${hairlineCard}`}
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-2">
            <section className="flex flex-col gap-3.5 p-4">
              <h2 className="m-0 text-[17px] font-semibold tracking-[-0.02em]">
                {t.itCan}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] text-ink">
                {t.can.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    {ok}
                    {item}
                  </li>
                ))}
              </ul>
            </section>
            {/* The homepage's soft grey inset; no second accent color. */}
            <section className="flex flex-col gap-3.5 rounded-[18px] bg-[#f9f9f9] p-4 ring-1 ring-black/[0.04] ring-inset">
              <h2 className="m-0 text-[17px] font-semibold tracking-[-0.02em]">
                {t.itCant}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] text-quiet">
                {t.cannot.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`${chip} bg-black/[0.05] text-muted`}
                    >
                      <Close width={11} height={11} strokeWidth={2.5} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          {ungrantable.length > 0 ? (
            <p className="px-[18px] pt-1 text-[13px] text-attention-ink">
              {f(t.ungrantable, {
                scopes: ungrantable.map((s) => s.scope).join(", "),
                name,
              })}
            </p>
          ) : null}
          <div className="flex gap-2 p-2.5">
            <button
              type="button"
              onClick={() => void decide("deny")}
              disabled={busy}
              className="raised-light h-11 flex-1 rounded-full border border-line-card bg-white font-medium text-soft hover:text-ink disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => void decide("allow")}
              disabled={busy}
              className="raised h-11 flex-1 rounded-full bg-ink font-medium text-white hover:bg-ink-hover disabled:opacity-50"
            >
              {t.allow}
            </button>
          </div>
        </div>
        <p className="max-w-[480px] text-center text-xs text-muted">
          {rich(t.returnsTo, {
            returnsTo: state.returnsTo,
            connections: (
              <a
                href="/settings/agents"
                className="text-soft underline underline-offset-2 hover:text-ink"
              >
                {t.connections}
              </a>
            ),
          })}
        </p>
      </div>
    </Standalone>
  );
}

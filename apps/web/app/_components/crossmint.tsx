"use client";

import {
  CrossmintPaymentMethodManagement,
  type CrossmintPaymentMethodManagementRef,
  CrossmintProtectedInput,
  CrossmintProvider,
} from "@crossmint/client-sdk-react-ui";
import {
  type ApprovalStep,
  cardBrandArt,
  cardExpiry,
  cardLabel,
  orderIntentsApi,
  type PaymentRequest,
  type SavedCard,
  savedCard,
  useCardApproval,
} from "@oca/agent/approval";
import {
  ApprovalView,
  paymentAppearance,
  protectedAppearance,
} from "@oca/agent/ui/approval";
import {
  type ComponentProps,
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../lib/i18n/client";
import { bleed } from "../(app)/page-shell";
import { ApprovalSkeleton } from "./approval-skeleton";
import { CardPanel } from "./card-panel";
import { Collapse } from "./collapse";
import { Card } from "./icons";
import { ConfirmModal, Modal, ModalActions, ModalHeader } from "./modal";
import { usePanePick } from "./pane";
import { PoweredByCrossmint } from "./powered-by";
import { CardRowSkeleton } from "./row-skeleton";

interface Token {
  apiKey: string;
  jwt: string;
  email: string | null;
}

const TokenContext = createContext<Token | null>(null);

/** When a JWT expires (ms), from its `exp` claim; null when it can't be read. */
function expiresAt(jwt: string): number | null {
  try {
    const part = jwt.split(".")[1] ?? "";
    const claims = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: unknown };
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Client key and the signed-in user's short-lived JWT, refreshed a minute
 * before it expires rather than on a timer: each new JWT reaches Crossmint's
 * forms, and a form given a new one reloads, losing what was typed.
 */
function useCrossmintToken() {
  const [token, setToken] = useState<Token | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), delay);
    };
    const load = async () => {
      try {
        const response = await fetch("/api/crossmint/token", {
          cache: "no-store",
        });
        if (response.status === 401 && !stopped) {
          // The session ended: sign in again and come back here.
          const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.location.replace(`/login?next=${encodeURIComponent(here)}`);
          return;
        }
        if (!response.ok) {
          throw new Error();
        }
        const next = (await response.json()) as Token;
        if (stopped) {
          return;
        }
        setToken((current) => (current?.jwt === next.jwt ? current : next));
        setError(false);
        const expiry = expiresAt(next.jwt);
        schedule(
          expiry === null
            ? 60_000
            : Math.min(
                Math.max(expiry - Date.now() - 60_000, 15_000),
                10 * 60_000,
              ),
        );
      } catch {
        if (!stopped) {
          setError(true);
          schedule(15_000);
        }
      }
    };
    void load();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);
  return { token, error };
}

/** Renders Crossmint's components once the user's Crossmint credentials are ready. */
export function CrossmintScope({
  children,
  fallback,
}: {
  children: (jwt: string) => ReactNode;
  /** Shown while the credentials load, in place of the spinner. */
  fallback?: ReactNode;
}) {
  const { m } = useI18n();
  const { token, error } = useCrossmintToken();
  // A refresh that fails (a laptop waking, a dropped connection) keeps the
  // token already loaded; the next one tries again.
  if (error && !token) {
    return (
      <p className="p-6 text-center text-[13px] text-muted">
        {m.settings.cardManager.unavailable}
      </p>
    );
  }
  if (!token) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center gap-2.5 p-8 text-[13px] text-muted">
          <span className="spinner" /> {m.settings.cardManager.connecting}
        </div>
      )
    );
  }
  return (
    <CrossmintProvider
      apiKey={token.apiKey}
      jwt={token.jwt}
      consoleLogLevel="warn"
    >
      <TokenContext.Provider value={token}>
        {children(token.jwt)}
      </TokenContext.Provider>
    </CrossmintProvider>
  );
}

/**
 * The user's saved cards, listed and enrolled for agent payments (with their email) on our
 * server: the browser can't list them. Null when Crossmint couldn't list them.
 */
async function loadCards(): Promise<readonly SavedCard[] | null> {
  try {
    const response = await fetch("/api/crossmint/cards", {
      method: "POST",
      cache: "no-store",
    });
    return response.ok
      ? ((await response.json()) as { cards: SavedCard[] | null }).cards
      : null;
  } catch {
    return null;
  }
}

type AddedPaymentMethod = Parameters<
  NonNullable<
    ComponentProps<
      typeof CrossmintPaymentMethodManagement
    >["onPaymentMethodSelected"]
  >
>[0];

/** The card list's loading state: one row the height of a real one. */
function CardsSkeleton() {
  return (
    <div className={`${bleed} overflow-hidden`}>
      <CardRowSkeleton />
    </div>
  );
}

/** Two faded cards, tilted: what the list will hold once one is added. */
function GhostCards() {
  const card =
    "absolute flex h-[88px] w-[148px] flex-col justify-between rounded-[14px] bg-white p-3 ring-1 ring-black/[0.06] shadow-[0_10px_28px_-12px_rgb(0_0_0/18%)]";
  const bar = "rounded-full bg-black/[0.06]";
  return (
    <div aria-hidden="true" className="relative h-[120px] w-[240px]">
      <span className={`${card} top-1 left-2 -rotate-6 opacity-70`}>
        <span className={`${bar} h-4 w-6 rounded-[4px]`} />
        <span className={`${bar} h-2 w-20`} />
      </span>
      <span className={`${card} top-6 right-2 rotate-3`}>
        <span className="flex items-center justify-between">
          <span className={`${bar} h-4 w-6 rounded-[4px]`} />
          <Card
            width={16}
            height={16}
            strokeWidth={1.75}
            className="text-faint"
          />
        </span>
        <span className="flex flex-col gap-1.5">
          <span className={`${bar} h-2 w-24`} />
          <span className={`${bar} h-2 w-14`} />
        </span>
      </span>
    </div>
  );
}

/**
 * Settings' cards: our own list (the same rows as the payment step), with
 * Crossmint's add-card form, new cards only, behind "Add a card" (with no cards
 * yet, a "No saved cards" row holds the button). A new card is enrolled
 * for agent payments right away; card numbers stay in Crossmint's frame.
 */
export function CardManager({
  limits,
  add = 0,
}: {
  /** Changes when the page's + asks for the add-card form. */
  add?: number;
  /** A card's spending limits, and making one, under its details. */
  limits?: (card: SavedCard) => ReactNode;
} = {}) {
  const { m, f } = useI18n();
  const t = m.settings.cardManager;
  const token = useContext(TokenContext);
  const [cards, setCards] = useState<readonly SavedCard[] | null>();
  const [load, setLoad] = useState(0);
  const [adding, setAdding] = useState(false);
  /** The card being confirmed for removal. */
  const [confirming, setConfirming] = useState<SavedCard | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  /** Removed cards collapse out before they leave the list. */
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  /** Cards added in this visit ease in rather than pop in. */
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");
  // The card open in its details panel; narrowing below the pane forgets it.
  const [wide, open, setOpen] = usePanePick();
  useEffect(() => {
    if (add > 0) {
      setAdding(true);
    }
  }, [add]);
  // A spending limit's card links here as ?card=<id>: once the cards are listed,
  // open its details if it's there, and drop the query either way. A list that
  // failed keeps it for Try again.
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("card");
    if (!id || !cards) {
      return;
    }
    if (cards.some((card) => card.paymentMethodId === id)) {
      setOpen(id);
    }
    url.searchParams.delete("card");
    window.history.replaceState(null, "", url);
  }, [cards, setOpen]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `load` asks for a fresh list
  useEffect(() => {
    let stopped = false;
    void loadCards().then((list) => {
      if (!stopped) {
        setCards(list);
        // "Manage cards" in an assistant's settings links to #cards: with none saved, that means adding one.
        if (list?.length === 0 && window.location.hash === "#cards") {
          setAdding(true);
        }
      }
    });
    return () => {
      stopped = true;
    };
  }, [load]);
  const kept = useMemo(
    () => cards?.filter((card) => !gone.has(card.paymentMethodId)) ?? null,
    [cards, gone],
  );
  if (!token || cards === undefined) {
    return <CardsSkeleton />;
  }
  const list = kept ?? [];
  // Wide screens keep a card open in the pane: the first until one is picked.
  const openCard =
    list.find((card) => card.paymentMethodId === open) ??
    (wide ? (list[0] ?? null) : null);

  async function save(paymentMethod: AddedPaymentMethod) {
    const card = token ? await enroll(token, paymentMethod) : null;
    if (!card) {
      return;
    }
    setAdded((current) => new Set(current).add(card.paymentMethodId));
    setCards((current) => [
      card,
      ...(current ?? []).filter(
        (item) => item.paymentMethodId !== card.paymentMethodId,
      ),
    ]);
    setAdding(false);
  }

  async function change(
    card: SavedCard,
    body: { name?: string; default?: true },
  ) {
    const response = await fetch(
      `/api/crossmint/cards/${encodeURIComponent(card.paymentMethodId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    ).catch(() => null);
    if (!response?.ok) {
      return false;
    }
    setCards((current) =>
      current?.map((item) =>
        body.default
          ? {
              ...item,
              isDefault: item.paymentMethodId === card.paymentMethodId,
            }
          : item.paymentMethodId === card.paymentMethodId
            ? { ...item, name: body.name || null }
            : item,
      ),
    );
    return true;
  }

  async function remove(card: SavedCard) {
    setRemoving(card.paymentMethodId);
    setError("");
    const response = await fetch(
      `/api/crossmint/cards/${encodeURIComponent(card.paymentMethodId)}`,
      { method: "DELETE" },
    ).catch(() => null);
    setRemoving(null);
    if (response?.ok) {
      setGone((current) => new Set(current).add(card.paymentMethodId));
      setConfirming(null);
      setOpen(null);
    } else {
      setError(f(t.removeFailed, { card: cardLabel(card) }));
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className={`${bleed} divide-y divide-black/[0.05] overflow-hidden`}>
        {(cards ?? []).map((card) => (
          <Collapse
            key={card.paymentMethodId}
            open={!gone.has(card.paymentMethodId)}
            appear={added.has(card.paymentMethodId)}
          >
            <button
              type="button"
              // In the pane (wide screens) nothing pops up: the row is the one shown.
              aria-haspopup={wide ? undefined : "dialog"}
              aria-label={f(t.open, { card: cardLabel(card) })}
              aria-current={
                wide && openCard?.paymentMethodId === card.paymentMethodId
                  ? true
                  : undefined
              }
              onClick={() => setOpen(card.paymentMethodId)}
              className={`flex w-full min-w-0 items-center gap-3.5 py-3.5 pr-4 pl-5 text-left transition-[opacity,background-color] duration-200 hover:bg-black/[0.03] aria-[current=true]:bg-black/[0.04] focus-visible:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset ${removing === card.paymentMethodId ? "opacity-50" : ""}`}
            >
              <svg
                viewBox="0 0 34 22"
                width="34"
                height="22"
                aria-hidden="true"
                className="flex-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: our own static brand art (card-brands.ts)
                dangerouslySetInnerHTML={{ __html: cardBrandArt(card.brand) }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">
                    {card.name
                      ? `${card.name} ·· ${card.last4}`
                      : cardLabel(card)}
                  </span>
                  {card.isDefault ? (
                    <span className="flex-none rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-soft ring-1 ring-black/[0.08] ring-inset">
                      {t.default}
                    </span>
                  ) : null}
                </span>
                {cardExpiry(card) ? (
                  <span className="text-[13px] text-quiet">
                    {cardExpiry(card)}
                  </span>
                ) : null}
              </span>
            </button>
          </Collapse>
        ))}
        {cards === null ? (
          <p className="px-5 py-4 text-[13px] text-quiet">
            {t.loadFailed}{" "}
            <button
              type="button"
              onClick={() => {
                setCards(undefined);
                setLoad((current) => current + 1);
              }}
              className="font-medium text-ink underline decoration-line-strong underline-offset-[3px] hover:decoration-ink"
            >
              {t.tryAgain}
            </button>
          </p>
        ) : null}
        {/* The first card: faded cards for what will be here, then what to do. */}
        <Collapse open={cards !== null && list.length === 0}>
          <div className="flex flex-col items-center gap-5 px-6 pt-8 pb-8 text-center md:px-8">
            <GhostCards />
            <div className="flex flex-col items-center gap-1.5">
              <h3 className="m-0 text-[22px] font-semibold tracking-[-0.03em]">
                {t.first}
              </h3>
              <p className="m-0 max-w-[520px] text-[15px] text-pretty text-quiet">
                {t.firstNote}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="raised tap relative h-11 flex-none rounded-full bg-ink px-5 font-medium text-white hover:bg-ink-hover"
            >
              {t.add}
            </button>
          </div>
        </Collapse>
      </div>
      {/* Keyed: the pane stays mounted, and one card's state (a failed default,
          its spending limits loading) must not show under the next. */}
      {openCard && token ? (
        <CardPanel
          key={openCard.paymentMethodId}
          card={openCard}
          jwt={token.jwt}
          limits={limits?.(openCard)}
          onRename={(name) => change(openCard, { name })}
          onDefault={() => change(openCard, { default: true })}
          onRemove={() => {
            setError("");
            setConfirming(openCard);
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {confirming ? (
        <ConfirmModal
          id="remove-card-title"
          title={f(t.removeTitle, { card: cardLabel(confirming) })}
          text={t.removeText}
          confirm={t.removeCard}
          busyLabel={t.removing}
          cancel={t.cancel}
          busy={removing === confirming.paymentMethodId}
          error={error || null}
          onConfirm={() => void remove(confirming)}
          onClose={() => {
            // The modal already showed its error; don't repeat it on the page.
            setConfirming(null);
            setError("");
          }}
        />
      ) : null}
      {adding && token ? (
        <AddCard
          jwt={token.jwt}
          onSaved={save}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {/* While the remove modal is open, it shows the error itself. */}
      {error && !confirming ? (
        <p
          role="alert"
          className="animate-[fade-in_150ms_ease-out] text-[13px] text-danger motion-reduce:animate-none"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A card just added, enrolled for agent payments with the user's email. Null when Crossmint gave no card. */
async function enroll(token: Token, paymentMethod: AddedPaymentMethod) {
  const card = savedCard(paymentMethod);
  if (card && token.email) {
    // The payment step enrolls it again if this fails.
    await orderIntentsApi(token.apiKey, token.jwt)
      .register(card.paymentMethodId, { email: token.email })
      .catch(() => null);
  }
  return card;
}

/**
 * Adding a card from outside the card list (Home's setup steps): the modal
 * opens at once, and loads the user's Crossmint credentials itself.
 */
export function NewCard({
  onAdded,
  onClose,
}: {
  onAdded: (card: SavedCard) => void;
  onClose: () => void;
}) {
  const { token, error } = useCrossmintToken();
  return (
    <AddCard
      jwt={token?.jwt ?? null}
      failed={error && !token}
      provide={(form) =>
        token ? (
          <CrossmintProvider
            apiKey={token.apiKey}
            jwt={token.jwt}
            consoleLogLevel="warn"
          >
            {form}
          </CrossmintProvider>
        ) : null
      }
      onSaved={async (method) => {
        if (!token) {
          return;
        }
        const card = await enroll(token, method);
        if (card) {
          onAdded(card);
        }
      }}
      onClose={onClose}
    />
  );
}

/**
 * Adding a card, in the app's modal: Crossmint's form, which keeps the card
 * details in its own frame and asks for the billing address, with our own
 * Save button. The card is kept through `onSaved` (Crossmint's
 * `onPaymentMethodSelected`); Save's own result only says what's wrong.
 */
function AddCard({
  jwt,
  failed = false,
  provide = (form) => form,
  onSaved,
  onClose,
}: {
  /** Null while the user's Crossmint credentials load. */
  jwt: string | null;
  /** The credentials didn't load (they're retried): said in the modal. */
  failed?: boolean;
  /** Puts Crossmint's form under its provider, when the caller isn't already. */
  provide?: (form: ReactNode) => ReactNode;
  onSaved: (method: AddedPaymentMethod) => Promise<void>;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const t = m.settings.cardManager;
  const form = useRef<CrossmintPaymentMethodManagementRef>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  // Crossmint's frame starts with no height and grows once its form is drawn.
  // If it never does (it failed to load), stop waiting: whatever the frame
  // shows appears, and Save gets Crossmint's own answer.
  const frame = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const loaded = jwt !== null;
  useEffect(() => {
    const element = frame.current;
    if (!loaded || !element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (element.offsetHeight > 40) {
        setReady(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    const giveUp = window.setTimeout(() => setReady(true), 10_000);
    return () => {
      observer.disconnect();
      window.clearTimeout(giveUp);
    };
  }, [loaded]);
  async function submit() {
    if (!form.current || saving || !ready) {
      return;
    }
    setSaving(true);
    setMessage("");
    const result = await form.current.submit();
    setSaving(false);
    // "invalid" is shown in the form itself; "saved" closes through onSaved.
    if (result.status === "failed" || result.status === "unavailable") {
      setMessage(result.message);
    }
  }
  return (
    <Modal labelledBy="add-card-title" busy={saving} onClose={onClose}>
      {(close) => (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <ModalHeader id="add-card-title" title={t.add} close={close} />
          {/* Room for Crossmint's form while its frame loads, so the sheet doesn't jump. */}
          <div className="relative min-h-[320px]">
            {failed ? (
              <p role="alert" className="m-0 text-[13px] text-quiet">
                {t.unavailable}
              </p>
            ) : ready ? null : (
              <CardFormSkeleton label={t.connecting} />
            )}
            {jwt === null
              ? null
              : provide(
                  <div
                    ref={frame}
                    className={`transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
                  >
                    <CrossmintPaymentMethodManagement
                      ref={form}
                      jwt={jwt}
                      allowedModes={["new"]}
                      allowedPaymentMethodTypes={["card"]}
                      appearance={appearance}
                      hideSubmitButton
                      fields={{ billingDetails: { address: true } }}
                      onPaymentMethodSelected={(method) => onSaved(method)}
                    />
                  </div>,
                )}
          </div>
          <PoweredByCrossmint />
          {message ? (
            <p role="alert" className="m-0 text-[13px] text-danger">
              {message}
            </p>
          ) : null}
          <ModalActions>
            <button
              type="button"
              onClick={close}
              className="raised-light tap relative inline-flex h-11 items-center justify-center rounded-full border border-line-card bg-white px-5 font-medium text-soft hover:text-ink"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !ready}
              aria-busy={saving}
              className="raised tap relative inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 font-medium text-white hover:bg-ink-hover disabled:opacity-60"
            >
              {saving ? t.saving : t.save}
            </button>
          </ModalActions>
        </div>
      )}
    </Modal>
  );
}

/** Where the card fields will be, while Crossmint's form loads. */
function CardFormSkeleton({ label }: { label: string }) {
  const field = "h-11 rounded-[12px] bg-black/[0.04] motion-safe:animate-pulse";
  return (
    <div role="status" className="absolute inset-0 flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      <div className={field} />
      <div className="grid grid-cols-2 gap-3">
        <div className={field} />
        <div className={field} />
      </div>
      <div className={field} />
      <div className={field} />
      <div className="grid grid-cols-2 gap-3">
        <div className={field} />
        <div className={field} />
      </div>
    </div>
  );
}

const appearance = paymentAppearance();
const protectedInputAppearance = protectedAppearance();

/** The shared approval view (`@oca/agent/ui/approval`) around this user's flow. */
function CardApproval({
  token,
  cards,
  request,
  onAuthorized,
  onReload,
  onStep,
  compact,
  compactLabel,
  cardNote,
  approveLabel,
  blocked,
}: {
  token: Token;
  cards: readonly SavedCard[] | null;
  request: PaymentRequest;
  compact?: boolean;
  compactLabel?: string;
  /** With `compact`: a line under the card row, before Approve. */
  cardNote?: ReactNode;
  /** The button's words in place of "Approve $X". */
  approveLabel?: string;
  blocked?: boolean;
  onAuthorized: (orderIntentId: string) => void;
  onReload: () => void;
  onStep?: (step: ApprovalStep["kind"]) => void;
}) {
  const flow = useCardApproval({
    apiKey: token.apiKey,
    jwt: token.jwt,
    email: token.email,
    cards,
    request,
    onAuthorized,
    onEncryptedOnly: markEncryptedOnly,
  });
  /** "Add a card" opens the app's add-card modal; the card joins the list, selected. */
  const [adding, setAdding] = useState(false);
  const { m } = useI18n();
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the step changes
  useEffect(() => {
    onStep?.(flow.step.kind);
  }, [flow.step.kind]);
  return (
    <>
      {cards === null ? (
        // The saved cards didn't load: say so, with a retry, above "Add a card".
        <p role="alert" className="m-0 text-[13px] text-quiet">
          {m.settings.cardManager.loadFailed}{" "}
          <button
            type="button"
            onClick={onReload}
            className="font-medium text-ink underline underline-offset-2"
          >
            {m.settings.cardManager.tryAgain}
          </button>
        </p>
      ) : null}
      <ApprovalView
        flow={flow}
        jwt={token.jwt}
        cards={cards}
        amount={request.amount}
        compact={compact}
        compactLabel={compactLabel}
        cardNote={cardNote}
        approveLabel={approveLabel}
        words={{
          choose: m.settings.cardManager.choose,
          add: m.settings.cardManager.add,
        }}
        blocked={blocked}
        onReload={onReload}
        onAddCard={() => setAdding(true)}
      />
      {adding ? (
        <AddCard
          jwt={token.jwt}
          onSaved={async (method) => {
            await flow.added(method);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}

/** The card network's check failed for this card: from now on it pays with the encrypted card, with no check. */
function markEncryptedOnly(paymentMethodId: string) {
  void fetch(`/api/crossmint/cards/${encodeURIComponent(paymentMethodId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ setup: "encrypted" }),
  }).catch(() => null);
}

/**
 * Our saved-card list and Approve button, inside the signed-in app. Approval starts only
 * from the user's click on Approve; Crossmint runs any card check (the card network's
 * verification, or the security code again), and `onAuthorized` gets the order intent only
 * once Crossmint confirms the card. Nothing else, and never the model, can approve.
 */
export function ApprovePayment({
  request,
  card,
  onAuthorized,
  onStep,
  compact,
  compactLabel,
  cardNote,
  approveLabel,
  blocked,
}: {
  request: PaymentRequest;
  compactLabel?: string;
  /** With `compact`: a line under the card row, before Approve. */
  cardNote?: ReactNode;
  /** The button's words in place of "Approve $X". */
  approveLabel?: string;
  /** Approve waits: the form above isn't complete yet. */
  blocked?: boolean;
  /** Only the selected card, with Change (a request made for one payment). */
  compact?: boolean;
  /** The card to start on (a spending limit made from that card); else the default, which Crossmint lists first. */
  card?: string;
  onAuthorized: (orderIntentId: string) => void;
  /** Where the approval is (picking a card, creating it, a card check…), for a caller that must hold still meanwhile. */
  onStep?: (step: ApprovalStep["kind"]) => void;
}) {
  const { m } = useI18n();
  const token = useContext(TokenContext);
  const [cards, setCards] = useState<readonly SavedCard[] | null>();
  const [load, setLoad] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `load` asks for a fresh list
  useEffect(() => {
    let stopped = false;
    void loadCards().then((list) => {
      if (!stopped) {
        setCards(list);
      }
    });
    return () => {
      stopped = true;
    };
  }, [load]);
  if (!token || cards === undefined) {
    return (
      <ApprovalSkeleton
        label={m.settings.cardManager.loadingCards}
        row={Boolean(compactLabel)}
      />
    );
  }
  return (
    <CardApproval
      key={load}
      token={token}
      cards={
        card && cards
          ? [...cards].sort(
              (a, b) =>
                Number(b.paymentMethodId === card) -
                Number(a.paymentMethodId === card),
            )
          : cards
      }
      request={request}
      compact={compact}
      compactLabel={compactLabel}
      cardNote={cardNote}
      approveLabel={approveLabel}
      blocked={blocked}
      onAuthorized={onAuthorized}
      onStep={onStep}
      onReload={() => {
        setCards(undefined);
        setLoad((current) => current + 1);
      }}
    />
  );
}
export type ProtectedInputHandle = {
  collect(): Promise<
    | { status: "collected"; input: { protectedInputId: string } }
    | { status: "invalid" | "unavailable"; code: string; message: string }
    | { status: "superseded"; message: string }
  >;
};
export const ProtectedInput = forwardRef<
  ProtectedInputHandle,
  Omit<ComponentProps<typeof CrossmintProtectedInput>, "ref">
>(function ProtectedInput(props, ref) {
  return (
    <CrossmintProtectedInput
      appearance={protectedInputAppearance}
      {...props}
      // biome-ignore lint/suspicious/noExplicitAny: the SDK's ref type is not exported
      ref={ref as any}
    />
  );
});

/** A protected input inside `CrossmintScope`, with the scope's own JWT. */
export const ScopedProtectedInput = forwardRef<
  ProtectedInputHandle,
  Omit<ComponentProps<typeof CrossmintProtectedInput>, "ref" | "jwt">
>(function ScopedProtectedInput(props, ref) {
  const token = useContext(TokenContext);
  return token ? <ProtectedInput ref={ref} jwt={token.jwt} {...props} /> : null;
});

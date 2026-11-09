"use client";

/**
 * Payment approval's UI: our saved-card list, "Add a card" and Approve, with
 * Crossmint's components for everything that touches card data (the add-card
 * form, the card network's verification, the security code). The same view in
 * the web app's dock and secure page (apps/web crossmint.tsx) and in the
 * ChatGPT/Claude card's on-demand secure script (card/secure-entry.tsx).
 *
 * Approval only starts from the user's click on Approve, and the flow
 * (`useCardApproval`) hands back an order intent only once Crossmint confirms
 * the card. Nothing else, and never a model, can approve.
 */
import {
  CrossmintCvcRecollection,
  CrossmintPaymentMethodManagement,
  type CrossmintPaymentMethodManagementRef,
  OrderIntentVerification,
  type OrderIntentVerificationProps,
  type PaymentMethodManagementAppearance,
  type ProtectedInputAppearance,
} from "@crossmint/client-sdk-react-ui";
import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  approvalMessages,
  cardBrandArt,
  cardLabel,
  type SavedCard,
  type useCardApproval,
} from "../approval.js";
import { money } from "./format.js";
import { useUi } from "./i18n/context.js";
import type { Ui, UiMessages } from "./i18n/index.js";
import { Check, Chevron, Lock } from "./icons.js";

export type Theme = "light" | "dark";

/** The approval flow's errors (written in English by ../approval.ts), by their key here. */
const approvalErrors: ReadonlyMap<string, keyof UiMessages["approval"]> =
  new Map([
    [approvalMessages.noRail, "noRail"],
    [approvalMessages.storeRefused.vic, "visaRefused"],
    [approvalMessages.storeRefused.agentpay, "mastercardRefused"],
    [approvalMessages.expired, "expired"],
    [approvalMessages.create, "create"],
    [approvalMessages.register, "register"],
    [approvalMessages.check, "check"],
    [approvalMessages.slow, "slow"],
    [approvalMessages.notRevoked, "notRevoked"],
  ]);

/** An approval error in the user's language; anything else (Crossmint's own) as it came. */
export function approvalErrorText(message: string, ui: Ui) {
  const key = approvalErrors.get(message);
  return key ? ui.m.approval[key] : message;
}

/** "Expires 08/29", or null when Crossmint didn't say. */
function expiryOf(card: SavedCard, ui: Ui) {
  const { month, year } = card.expiration ?? {};
  return month && year
    ? ui.f(ui.m.approval.expires, {
        date: `${month.padStart(2, "0")}/${year.slice(-2)}`,
      })
    : null;
}

/** Where the security code is printed, for the CVC step. */
function cvcHintOf(card: SavedCard | undefined, ui: Ui) {
  return card?.brand === "amex" || card?.brand === "american-express"
    ? ui.m.approval.cvcFront
    : ui.m.approval.cvcBack;
}

const palette = {
  light: {
    text: "#0A0A0A",
    muted: "#737373",
    border: "#E4E4E7",
    borderHover: "#D4D4D8",
    background: "#FFFFFF",
    backgroundSecondary: "#F4F4F5",
    button: "#0A0A0A",
    buttonHover: "#262626",
    buttonText: "#FFFFFF",
    disabled: "#D4D4D4",
    placeholder: "#A3A3A3",
    danger: "#DC2626",
    success: "#15803D",
    protectedBorder: "#EBEBEB",
  },
  dark: {
    text: "#F4F4F5",
    muted: "#9B9BA3",
    border: "#2E2E33",
    borderHover: "#3F3F46",
    background: "#111113",
    backgroundSecondary: "#232326",
    button: "#F4F4F5",
    buttonHover: "#D4D4D8",
    buttonText: "#0A0A0A",
    disabled: "#3F3F46",
    placeholder: "#6B6B73",
    danger: "#F87171",
    success: "#4ADE80",
    protectedBorder: "#27272A",
  },
} as const;

/**
 * The host's own surface under Crossmint's frames (the in-host card sets it
 * from the chat's colors), so a field sits on the card's background instead of
 * a band of ours. The web app keeps the palette.
 */
export interface Surface {
  readonly background: string;
  readonly backgroundSecondary: string;
  readonly border: string;
}
let surface: Surface | null = null;
export function setSurface(next: Surface | null) {
  surface = next;
}
function colorsFor(theme: Theme) {
  const c = palette[theme];
  return surface
    ? {
        ...c,
        background: surface.background,
        backgroundSecondary: surface.backgroundSecondary,
        border: surface.border,
        protectedBorder: surface.border,
      }
    : c;
}

const font = {
  cssSrc:
    "https://fonts.googleapis.com/css2?family=Geist:wght@400;500&display=swap",
};

function variables(theme: Theme) {
  const c = colorsFor(theme);
  return {
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
    // Multiplier units, not base sizes: labels render at x3.75, inputs at x4 and
    // the button at x4.25, so 3.6px gives 13.5px / 14.4px / 15.3px.
    // paymentAppearance's Input and PrimaryButton rules set their own sizes;
    // protectedAppearance sets its own unit.
    fontSizeUnit: "3.6px",
    borderRadius: "12px",
    colors: {
      textPrimary: c.text,
      textSecondary: c.muted,
      accent: c.button,
      borderPrimary: c.border,
      backgroundPrimary: c.background,
      danger: c.danger,
    },
  };
}

/**
 * Crossmint's card form, saved-card picker and CVC recollection. Its hosted
 * iframe reads this from its URL: `variables.colors.accent` colors the button,
 * focus ring and radios unless a `rules` entry overrides that element.
 */
export function paymentAppearance(
  theme: Theme = "light",
): PaymentMethodManagementAppearance {
  const c = colorsFor(theme);
  return {
    fonts: [font],
    variables: variables(theme),
    rules: {
      Input: {
        borderRadius: "12px",
        // At least 16px, or iOS zooms in when a field gets focus.
        font: { size: "16px" },
        colors: { border: c.border, placeholder: c.placeholder },
        hover: { colors: { border: c.borderHover } },
        focus: { colors: { border: c.button, boxShadow: "none" } },
      },
      PrimaryButton: {
        borderRadius: "999px",
        // Our own pills are 14px; Crossmint's would scale up with the inputs.
        font: { size: "14px", weight: "500" },
        colors: { background: c.button, text: c.buttonText },
        hover: { colors: { background: c.buttonHover, text: c.buttonText } },
        disabled: { colors: { background: c.disabled, text: c.buttonText } },
      },
    },
  };
}

/**
 * The card network's verification modal. It takes colors only: the primary
 * button is `PrimaryButton.colors.background` with `backgroundPrimary` as its
 * text. Without this it renders its own dark theme.
 */
export function verificationAppearance(
  theme: Theme = "light",
): OrderIntentVerificationProps["appearance"] {
  const c = colorsFor(theme);
  return {
    variables: {
      colors: {
        accent: c.button,
        textPrimary: c.text,
        textSecondary: c.muted,
        backgroundPrimary: c.background,
        backgroundSecondary: c.backgroundSecondary,
        border: c.border,
        danger: c.danger,
        success: c.success,
      },
    },
    rules: {
      PrimaryButton: {
        borderRadius: "999px",
        colors: { background: c.button, text: c.buttonText },
      },
    },
  };
}

/**
 * Protected store inputs share the fonts and variables but take no
 * per-element rules, so spacing and border are tuned here to match our own
 * 40px text inputs: Crossmint pads the field by 4.3 spacing units. Their text
 * is 16px (fontSizeUnit x4), or iOS zooms in when the field gets focus.
 */
export function protectedAppearance(
  theme: Theme = "light",
): ProtectedInputAppearance {
  const base = variables(theme);
  return {
    fonts: [font],
    variables: {
      ...base,
      fontSizeUnit: "4px",
      spacingUnit: "2.8px",
      colors: {
        ...base.colors,
        borderPrimary: colorsFor(theme).protectedBorder,
      },
    },
  };
}

export const quietButton =
  "h-11 flex-none px-1 text-[13px] text-muted underline decoration-line-strong underline-offset-[3px] hover:text-ink";

/** One saved card: brand art, "Visa •••• 4242", expiry; a radio when it can be picked. */
export function CardRow({
  card,
  selected,
  disabled,
  onSelect,
}: {
  card: SavedCard;
  selected: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const body = <CardFace card={card} />;
  const row = `relative flex h-12 min-w-0 items-center gap-3 rounded-[12px] border bg-surface px-3.5 ${
    selected ? "border-ink text-ink" : "border-line-card text-quiet"
  }`;
  return onSelect ? (
    <CardOption row={row} body={body} {...{ selected, disabled, onSelect }} />
  ) : (
    <div className={row}>{body}</div>
  );
}

/**
 * A card's brand art, label and expiry, for a row or the picker. With
 * `picker`, its label is 16px on phones, as the picker menu's options are.
 */
function CardFace({
  card,
  picker = false,
}: {
  card: SavedCard;
  picker?: boolean;
}) {
  const expiry = expiryOf(card, useUi());
  return (
    <>
      <svg
        viewBox="0 0 34 22"
        width="34"
        height="22"
        aria-hidden="true"
        className="flex-none"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: our own static brand art (card-brands.ts)
        dangerouslySetInnerHTML={{ __html: cardBrandArt(card.brand) }}
      />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span
          className={`truncate ${picker ? "text-[16px] sm:text-sm" : "text-sm"}`}
        >
          {cardLabel(card)}
        </span>
        {expiry ? <span className="text-xs text-muted">{expiry}</span> : null}
      </span>
    </>
  );
}

function CardOption({
  row,
  body,
  selected,
  disabled,
  onSelect,
}: {
  row: string;
  body: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`${row} cursor-pointer has-[:disabled]:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent`}
    >
      <input
        type="radio"
        name="payment-card"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      {body}
      <span
        aria-hidden="true"
        className={`size-4 flex-none rounded-full ${
          selected
            ? "border-[5px] border-ink"
            : "border-[1.5px] border-line-card"
        }`}
      />
    </label>
  );
}

/**
 * A dropdown's panel: in the browser's top layer, so a modal's scrolling never
 * cuts it. It fades in and out from its row (`menu-panel`, theme.css).
 */
export const menuPanel =
  "menu-panel m-0 max-h-[280px] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-[14px] border border-line-card bg-surface p-1.5 text-ink shadow-[0_18px_40px_-18px_rgb(0_0_0/35%)] [&:popover-open]:flex";

/**
 * A row's dropdown as a native popover, placed under its row (or above it,
 * where there's more room there), fixed to the viewport. A click outside or
 * Escape closes it.
 */
export function useMenu() {
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  /** When it last closed: a tap on its own row closes it first, then mustn't reopen it. */
  const closedAt = useRef(0);
  useEffect(() => {
    const element = list.current;
    const toggled = (event: Event) => {
      const opened = (event as ToggleEvent).newState === "open";
      if (!opened) {
        closedAt.current = Date.now();
      }
      setOpen(opened);
    };
    element?.addEventListener("toggle", toggled);
    return () => element?.removeEventListener("toggle", toggled);
  }, []);
  function toggle() {
    const element = list.current;
    const row = button.current?.getBoundingClientRect();
    if (!element || !row) {
      return;
    }
    if (open || Date.now() - closedAt.current < 300) {
      element.hidePopover();
      return;
    }
    const below = window.innerHeight - row.bottom;
    const up = below < 300 && row.top > below;
    // Every side named on each open, never the `inset` shorthand: React clears
    // a side the next style leaves out, and the popover's own `inset: 0` would
    // then pin an upward menu to the top of the screen.
    setStyle({
      position: "fixed",
      left: row.left + 8,
      right: "auto",
      width: row.width - 16,
      top: up ? "auto" : row.bottom + 4,
      bottom: up ? window.innerHeight - row.top + 4 : "auto",
    });
    // It grows from its row: down from below it, up from above it. Set on the
    // element itself, not through React's style: scrollIntoView below reads
    // the panel's style before React commits, and that read fixes where its
    // entrance starts (theme.css).
    element.style.transformOrigin = up ? "bottom center" : "top center";
    element.style.setProperty("--menu-from", up ? "4px" : "-4px");
    element.showPopover();
    // A long list (currencies) opens on the chosen one.
    element
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "center" });
  }
  return {
    button,
    list,
    open,
    toggle,
    close: () => list.current?.hidePopover(),
    style,
  };
}

/** The card picker's words; the web app passes its translations. */
export interface CardWords {
  readonly choose: string;
  readonly add: string;
}

function cardWordsOf(ui: Ui): CardWords {
  return { choose: ui.m.approval.chooseCard, add: ui.m.approval.addCard };
}

/**
 * The selected card as a dropdown: the list, and "Add a card" at its end,
 * open under it. For a request made for one payment, where the card is
 * already chosen (the default) and changing it is the exception.
 */
function CardPicker({
  cards,
  selected,
  disabled,
  label,
  words: given,
  onSelect,
  onAdd,
}: {
  /** Drawn as a details row: this name on the left, the card on the right. */
  label?: string;
  words?: CardWords;
  cards: readonly SavedCard[];
  selected: SavedCard | undefined;
  disabled: boolean;
  onSelect: (paymentMethodId: string) => void;
  onAdd: () => void;
}) {
  const ui = useUi();
  const words = given ?? cardWordsOf(ui);
  const { button, list, open, toggle, close, style } = useMenu();
  const item =
    "flex min-h-11 w-full min-w-0 items-center gap-3 rounded-[10px] px-2.5 text-left transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none";
  return (
    <div className="relative min-w-0">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className={
          label
            ? "flex min-h-[52px] w-full min-w-0 items-center gap-3.5 rounded-[20px] bg-stage px-4.5 py-3 text-left text-[16px] transition-colors sm:text-[15px] hover:bg-black/[0.06] disabled:opacity-60"
            : "flex h-12 w-full min-w-0 items-center gap-3 rounded-[12px] border border-line-card bg-surface px-3.5 text-left text-ink transition-colors hover:border-ink disabled:opacity-60 aria-expanded:border-ink"
        }
      >
        {label ? (
          <>
            <span className="flex-none text-soft">{label}</span>
            <span className="ml-auto flex min-w-0 items-center gap-2.5 text-ink">
              {selected ? (
                <>
                  <svg
                    viewBox="0 0 34 22"
                    width="30"
                    height="19"
                    aria-hidden="true"
                    className="flex-none"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: our own static brand art (card-brands.ts)
                    dangerouslySetInnerHTML={{
                      __html: cardBrandArt(selected.brand),
                    }}
                  />
                  <span className="truncate">{cardLabel(selected)}</span>
                </>
              ) : (
                <span className="text-quiet">{words.choose}</span>
              )}
            </span>
          </>
        ) : selected ? (
          <CardFace card={selected} picker />
        ) : (
          <span className="flex-1 text-sm text-quiet">{words.choose}</span>
        )}
        <Chevron
          width={14}
          height={14}
          aria-hidden="true"
          className={`flex-none text-muted transition-transform ${open ? "-rotate-90" : "rotate-90"}`}
        />
      </button>
      <div
        ref={list}
        popover="auto"
        role="listbox"
        aria-label={ui.m.approval.payWith}
        style={style}
        className={menuPanel}
      >
        {cards.map((card) => {
          const chosen = card.paymentMethodId === selected?.paymentMethodId;
          return (
            <button
              key={card.paymentMethodId}
              type="button"
              role="option"
              aria-selected={chosen}
              onClick={() => {
                onSelect(card.paymentMethodId);
                close();
              }}
              className={item}
            >
              <CardFace card={card} picker />
              {chosen ? (
                <Check width={14} height={14} className="flex-none" />
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            close();
            onAdd();
          }}
          className={`${item} text-[16px] text-quiet sm:text-[13.5px]`}
        >
          <span
            aria-hidden="true"
            className="inline-flex w-[34px] justify-center text-lg leading-none text-muted"
          >
            +
          </span>
          {words.add}
        </button>
      </div>
    </div>
  );
}

/**
 * Crossmint's add-card form with our Save button under it (its SDK 5 draws
 * none): Save waits for the form to load and be complete, billing address
 * included (it shows once the card is filled in), and shows what a save
 * couldn't do. The card comes back through `onSaved`.
 */
function NewCard({
  jwt,
  appearance,
  onSaved,
}: {
  jwt: string;
  appearance: PaymentMethodManagementAppearance;
  onSaved: NonNullable<
    ComponentProps<
      typeof CrossmintPaymentMethodManagement
    >["onPaymentMethodSelected"]
  >;
}) {
  const { m } = useUi();
  const form = useRef<CrossmintPaymentMethodManagementRef>(null);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  /** onSaved is keeping a card (enrolling it): only it turns Save back on. */
  const keeping = useRef(false);
  const [message, setMessage] = useState("");
  async function save() {
    if (!form.current || saving) {
      return;
    }
    setSaving(true);
    setMessage("");
    const result = await form.current.submit();
    // Saved: onSaved lists the card and closes the form; Save stays busy until it's done.
    if (
      keeping.current ||
      result.status === "saved" ||
      result.status === "selected"
    ) {
      return;
    }
    setSaving(false);
    if (
      result.status === "invalid" ||
      result.status === "failed" ||
      result.status === "unavailable"
    ) {
      setMessage(result.message);
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <CrossmintPaymentMethodManagement
        ref={form}
        jwt={jwt}
        allowedModes={["new"]}
        allowedPaymentMethodTypes={["card"]}
        fields={{ billingDetails: { address: true } }}
        appearance={appearance}
        onReady={() => setReady(true)}
        onChange={(event) => {
          setComplete(event.complete);
          setMessage("");
        }}
        onPaymentMethodSelected={(method) => {
          setSaving(true);
          keeping.current = true;
          return Promise.resolve(onSaved(method)).finally(() => {
            keeping.current = false;
            setSaving(false);
          });
        }}
      />
      {message ? (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {message}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!ready || !complete || saving}
        aria-busy={saving}
        onClick={() => void save()}
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-medium text-on-ink ${
          ready && complete ? "raised-ink bg-ink" : "bg-line-strong"
        }`}
      >
        {saving ? (
          <span className="spinner border-on-ink/40 border-t-on-ink" />
        ) : null}
        {saving ? m.approval.savingCard : m.approval.saveCard}
      </button>
    </div>
  );
}

/**
 * The approval view for one payment, around the flow from `useCardApproval`:
 * the security code when the card's rail asks for it, Crossmint's add-card
 * form, or the list and "Approve $X" (with the network's verification when
 * it asks). `onReload` offers to read the saved cards again when they didn't
 * load. With `onAddCard` the caller adds cards its own way (the web app's
 * modal) and the inline form never shows.
 */
export function ApprovalView({
  flow,
  jwt,
  cards,
  amount,
  theme = "light",
  compact = false,
  compactLabel,
  words,
  cardNote,
  approveLabel,
  blocked = false,
  onReload,
  onAddCard,
}: {
  flow: ReturnType<typeof useCardApproval>;
  jwt: string;
  /** The cards as listed; null when they couldn't be read. */
  cards: readonly SavedCard[] | null;
  amount: { readonly value: string; readonly currency: string };
  theme?: Theme;
  /** Only the selected card, with Change to pick another (a request made for one payment). */
  compact?: boolean;
  /** With `compact`: the card drawn as a details row with this name. */
  compactLabel?: string;
  /** "Choose a card" and "Add a card", translated. */
  words?: CardWords;
  /** With `compact`: a line under the card row, before Approve. */
  cardNote?: ReactNode;
  /** The button's words in place of "Approve $X". */
  approveLabel?: string;
  /** Approve waits: the form above isn't complete yet. */
  blocked?: boolean;
  onReload?: () => void;
  /** Adds a card elsewhere; it comes back through `flow.added`. */
  onAddCard?: () => void;
}) {
  const ui = useUi();
  const { m, f } = ui;
  const { step, selected } = flow;
  const appearance = paymentAppearance(theme);

  if (step.kind === "cvc" && selected) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <CardRow card={selected} selected />
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">
            {m.approval.securityCode}
          </span>
          <span className="text-xs text-muted">{cvcHintOf(selected, ui)}</span>
        </div>
        <CrossmintCvcRecollection
          jwt={jwt}
          paymentMethodId={selected.paymentMethodId}
          appearance={appearance}
          onComplete={flow.checked}
          onError={(failure) => {
            if (!failure.retriable) {
              flow.reset(approvalMessages.check);
            }
          }}
        />
        <span className="flex gap-2 text-xs text-muted">
          <Lock width={12} height={12} className="mt-0.5 flex-none" />
          {m.approval.cvcNote}
        </span>
        <button
          type="button"
          onClick={() => flow.reset()}
          className={`${quietButton} self-start`}
        >
          {m.approval.useDifferentCard}
        </button>
      </div>
    );
  }

  if (flow.adding && !onAddCard) {
    const listed = flow.cards.length > 0;
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {words?.add ?? m.approval.addCard}
          </span>
          {listed ? (
            <button
              type="button"
              onClick={() => flow.setAdding(false)}
              className={quietButton}
            >
              {m.common.cancel}
            </button>
          ) : null}
        </div>
        {cards === null && !listed ? (
          <p className="m-0 text-xs text-muted">
            {m.approval.cardsDidntLoad}{" "}
            {onReload ? (
              <>
                <button
                  type="button"
                  onClick={onReload}
                  className="text-ink underline underline-offset-2"
                >
                  {m.common.tryAgain}
                </button>{" "}
                {m.approval.orAddHere}
              </>
            ) : (
              m.approval.addHereOrMenta
            )}
          </p>
        ) : null}
        <NewCard jwt={jwt} appearance={appearance} onSaved={flow.added} />
      </div>
    );
  }

  const total = money({ amount: amount.value, currency: amount.currency }, ui);
  const error =
    step.kind === "select" && step.error
      ? approvalErrorText(step.error, ui)
      : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="sr-only">{m.approval.payWith}</legend>
        {compact && flow.cards.length === 0 ? (
          // No saved card yet: adding one is the next step, so it's a button, not an empty picker.
          <button
            type="button"
            disabled={flow.busy}
            onClick={() => (onAddCard ? onAddCard() : flow.setAdding(true))}
            className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[20px] border border-dashed border-line-strong bg-transparent px-4.5 text-[15px] text-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
            {(words ?? cardWordsOf(ui)).add}
          </button>
        ) : compact ? (
          <CardPicker
            cards={flow.cards}
            selected={selected}
            disabled={flow.busy}
            label={compactLabel}
            words={words}
            onSelect={flow.select}
            onAdd={() => (onAddCard ? onAddCard() : flow.setAdding(true))}
          />
        ) : (
          flow.cards.map((card) => (
            <CardRow
              key={card.paymentMethodId}
              card={card}
              selected={card.paymentMethodId === selected?.paymentMethodId}
              disabled={flow.busy}
              onSelect={() => flow.select(card.paymentMethodId)}
            />
          ))
        )}
        {compact ? cardNote : null}
        {compact ? null : (
          <button
            type="button"
            disabled={flow.busy}
            onClick={() => (onAddCard ? onAddCard() : flow.setAdding(true))}
            className="flex h-10 items-center gap-2.5 rounded-[12px] border border-dashed border-line-card bg-transparent px-3.5 text-left text-[13.5px] text-quiet hover:border-ink disabled:opacity-60 disabled:hover:border-line-card"
          >
            <span
              aria-hidden="true"
              className="text-lg leading-none text-muted"
            >
              +
            </span>
            {(words ?? cardWordsOf(ui)).add}
          </button>
        )}
      </fieldset>
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!selected || flow.busy || blocked}
        aria-busy={flow.busy}
        onClick={flow.approve}
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-medium text-on-ink ${
          selected ? "raised-ink bg-ink" : "bg-line-strong"
        }`}
      >
        {flow.busy && step.kind !== "done" ? (
          <span className="spinner border-on-ink/40 border-t-on-ink" />
        ) : null}
        {step.kind === "working"
          ? m.approval.approving
          : step.kind === "verify"
            ? m.approval.waitingCheck
            : step.kind === "confirming"
              ? m.approval.confirming
              : step.kind === "done"
                ? m.approval.approved
                : (approveLabel ?? f(m.approval.approve, { amount: total }))}
      </button>
      {step.kind === "verify" ? (
        <OrderIntentVerification
          orderIntent={step.orderIntent}
          displayName="Menta"
          appearance={verificationAppearance(theme)}
          onVerificationComplete={flow.checked}
          onVerificationError={flow.unverified}
        />
      ) : null}
    </div>
  );
}

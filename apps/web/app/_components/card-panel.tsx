"use client";

import { CrossmintCvcRecollection } from "@crossmint/client-sdk-react-ui";
import { cardBrandArt, type SavedCard } from "@oca/agent/approval";
import { cardBrandMark, cardBrandName } from "@oca/agent/card-brands";
import { paymentAppearance } from "@oca/agent/ui/approval";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../lib/i18n/client";
import { ListGroup, ListRow } from "../(app)/list";
import { Card, Check, Pencil, Star, Trash } from "./icons";
import { CloseButton, Modal, ModalHeader } from "./modal";
import { DetailPane } from "./pane";
import { PoweredByCrossmint } from "./powered-by";
import { Switch } from "./switch";

/** A card's name in Menta, else its brand ("Visa"). */
export function cardTitle(card: SavedCard) {
  return card.name || cardBrandName(card.brand);
}

/**
 * The card itself, at a real card's proportions (85.6 × 53.98 mm): black,
 * with only the brand's logo in the middle, tilting toward the pointer with
 * a moving shine. Still with reduced motion or touch.
 */
export function TiltCard({ card }: { card: SavedCard }) {
  const face = useRef<HTMLDivElement>(null);
  const still = useRef(false);
  useEffect(() => {
    still.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);
  function tilt(event: PointerEvent<HTMLDivElement>) {
    const element = face.current;
    if (!element || still.current || event.pointerType !== "mouse") {
      return;
    }
    const box = element.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    element.style.setProperty("--rx", `${(-y * 14).toFixed(2)}deg`);
    element.style.setProperty("--ry", `${(x * 18).toFixed(2)}deg`);
    element.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    element.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
    element.style.setProperty("--shine", "1");
  }
  function rest() {
    const element = face.current;
    element?.style.setProperty("--rx", "0deg");
    element?.style.setProperty("--ry", "0deg");
    element?.style.setProperty("--shine", "0");
  }
  const mark = cardBrandMark(card.brand);
  return (
    <div
      className="mx-auto w-full max-w-[300px] [perspective:900px]"
      onPointerMove={tilt}
      onPointerLeave={rest}
    >
      <div
        ref={face}
        aria-hidden="true"
        className="relative flex aspect-[85.6/53.98] w-full items-center justify-center overflow-hidden rounded-[16px] bg-[radial-gradient(90%_80%_at_35%_20%,#262626_0%,#0a0a0a_60%,#000_100%)] shadow-[0_24px_48px_-16px_rgb(0_0_0/45%),0_2px_6px_rgb(0_0_0/18%)] transition-transform duration-200 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] [transform-style:preserve-3d] motion-reduce:transition-none"
      >
        {/* The shine follows the pointer. */}
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_var(--gx,50%)_var(--gy,0%),rgb(255_255_255/18%),transparent_70%)] opacity-[var(--shine,0)] transition-opacity duration-200" />
        {mark ? (
          <svg
            viewBox="0 0 34 22"
            className="relative w-[46%]"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: our own static brand marks (card-brands.ts)
            dangerouslySetInnerHTML={{ __html: mark }}
          />
        ) : (
          <Card
            width={56}
            height={56}
            strokeWidth={1.25}
            className="relative text-white/70"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Its name, with a pencil that turns it into a field that looks the same:
 * empty, with the current name as its placeholder. Leaving it saves; empty
 * keeps the name, Escape keeps it too.
 */
function CardName({
  card,
  onEditing,
  onRename,
}: {
  card: SavedCard;
  onEditing: (editing: boolean) => void;
  onRename: (name: string) => Promise<boolean>;
}) {
  const { m } = useI18n();
  const t = m.settings.cardManager;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelled = useRef(false);
  const title = cardTitle(card);
  function edit(on: boolean) {
    setEditing(on);
    onEditing(on);
  }
  async function finish() {
    const name = draft.trim();
    if (cancelled.current || !name || name === title) {
      cancelled.current = false;
      edit(false);
      return;
    }
    setSaving(true);
    setFailed(false);
    const ok = await onRename(name);
    setSaving(false);
    setFailed(!ok);
    edit(false);
  }
  const heading =
    "m-0 min-w-0 text-center text-[22px] font-semibold tracking-[-0.03em]";
  return (
    <div className="flex w-full flex-col items-center gap-1">
      {editing ? (
        <>
          {/* The panel stays named while the name is a field. */}
          <h2 id="card-panel-title" className="sr-only">
            {title}
          </h2>
          <input
            autoFocus
            aria-label={t.cardName}
            value={draft}
            maxLength={40}
            placeholder={title}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void finish()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                // Escape cancels the rename, not the panel.
                event.preventDefault();
                event.stopPropagation();
                cancelled.current = true;
                event.currentTarget.blur();
              }
            }}
            className={`${heading} w-full max-w-[300px] border-0 bg-transparent p-0 text-ink outline-none placeholder:text-faint`}
          />
        </>
      ) : (
        <div className="flex max-w-full items-center justify-center gap-1">
          <h2 id="card-panel-title" className={`${heading} truncate`}>
            {title}
          </h2>
          <button
            type="button"
            aria-label={t.rename}
            onClick={() => {
              setDraft("");
              setFailed(false);
              edit(true);
            }}
            className="tap relative inline-flex size-9 flex-none items-center justify-center rounded-full text-soft transition-colors hover:bg-black/[0.04] hover:text-ink"
          >
            <Pencil width={17} height={17} />
          </button>
        </div>
      )}
      {failed ? (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {t.renameFailed}
        </p>
      ) : null}
    </div>
  );
}

/** Updating a card's security code in Crossmint's own field: the digits never reach Menta. */
function UpdateCvc({
  card,
  jwt,
  onClose,
}: {
  card: SavedCard;
  jwt: string;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const t = m.settings.cardManager;
  const [state, setState] = useState<"open" | "done" | "failed">("open");
  return (
    <Modal labelledBy="update-cvc-title" onClose={onClose}>
      {(close) => (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <ModalHeader
            id="update-cvc-title"
            title={t.updateCvc}
            close={close}
          />
          <div className="well flex items-center gap-3 rounded-[14px] px-4 py-3">
            <svg
              viewBox="0 0 34 22"
              width="34"
              height="22"
              aria-hidden="true"
              className="flex-none"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: our own static brand art (card-brands.ts)
              dangerouslySetInnerHTML={{ __html: cardBrandArt(card.brand) }}
            />
            <span className="font-medium">{cardTitle(card)}</span>
            <span className="ml-auto text-quiet tabular-nums">
              •••• {card.last4}
            </span>
          </div>
          {state === "done" ? (
            <p
              role="status"
              className="m-0 flex items-center gap-2 text-[15px] font-medium text-leaf"
            >
              <Check width={18} height={18} />
              {t.cvcDone}
            </p>
          ) : state === "failed" ? (
            <p role="alert" className="m-0 text-[13px] text-danger">
              {t.cvcFailed}
            </p>
          ) : (
            <CrossmintCvcRecollection
              jwt={jwt}
              paymentMethodId={card.paymentMethodId}
              appearance={paymentAppearance()}
              onComplete={() => setState("done")}
              onError={(failure) => {
                if (!failure.retriable) {
                  setState("failed");
                }
              }}
            />
          )}
          <PoweredByCrossmint />
        </div>
      )}
    </Modal>
  );
}

/**
 * One card, from Wallet: the card, its name (to change), making it the
 * default, a new security code, removing it, and below, its spending limits.
 * While the name is being changed, everything else holds still.
 */
export function CardPanel({
  card,
  jwt,
  limits,
  onRename,
  onDefault,
  onRemove,
  onClose,
}: {
  card: SavedCard;
  jwt: string;
  /** This card's spending limits, and making one. */
  limits?: ReactNode;
  onRename: (name: string) => Promise<boolean>;
  onDefault: () => Promise<boolean>;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const t = m.settings.cardManager;
  const [cvc, setCvc] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [defaulting, setDefaulting] = useState(false);
  const [defaultFailed, setDefaultFailed] = useState(false);
  const icon = { width: 20, height: 20 };
  const held = `transition-opacity duration-150 ${renaming ? "pointer-events-none opacity-40" : ""}`;
  return (
    <DetailPane labelledBy="card-panel-title" onClose={onClose}>
      {(close) => (
        <div className="flex flex-col gap-6 p-5 sm:p-6">
          {close ? (
            <div inert={renaming} className={`flex justify-end ${held}`}>
              <CloseButton label={t.close} onClick={close} />
            </div>
          ) : null}
          <div inert={renaming} className={held}>
            <TiltCard card={card} />
          </div>
          <div className="flex flex-col items-center gap-0.5 text-center">
            <CardName card={card} onEditing={setRenaming} onRename={onRename} />
            <p className="m-0 text-[15px] text-quiet tabular-nums">
              •••• {card.last4}
            </p>
          </div>
          <div inert={renaming} className={`flex flex-col gap-6 ${held}`}>
            <ListGroup>
              <div className="flex min-h-[52px] items-center gap-3.5 px-4.5 py-3 text-[15px]">
                <Star
                  {...icon}
                  aria-hidden="true"
                  className="flex-none text-muted"
                />
                <span className="text-soft">{t.setDefault}</span>
                <span className="ml-auto">
                  <Switch
                    checked={card.isDefault === true}
                    // Crossmint keeps one default: another card takes it over, none turns it off.
                    disabled={card.isDefault === true}
                    busy={defaulting}
                    label={t.setDefault}
                    onChange={() => {
                      setDefaulting(true);
                      setDefaultFailed(false);
                      void onDefault().then((ok) => {
                        setDefaulting(false);
                        setDefaultFailed(!ok);
                      });
                    }}
                  />
                </span>
              </div>
              <ListRow
                icon={<Card {...icon} />}
                label={t.updateCvc}
                onClick={() => setCvc(true)}
                dialog
              />
              <ListRow
                icon={<Trash {...icon} />}
                label={t.remove}
                onClick={onRemove}
                dialog
                danger
              />
            </ListGroup>
            {defaultFailed ? (
              <p role="alert" className="-mt-3 m-0 text-[13px] text-danger">
                {t.defaultFailed}
              </p>
            ) : null}
            {limits}
          </div>
          {cvc ? (
            <UpdateCvc card={card} jwt={jwt} onClose={() => setCvc(false)} />
          ) : null}
        </div>
      )}
    </DetailPane>
  );
}

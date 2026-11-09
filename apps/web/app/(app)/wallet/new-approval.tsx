"use client";

import type { ApprovalStep } from "@oca/agent/approval";
import { useState } from "react";
import { useI18n } from "../../../lib/i18n/client";
import { Bag } from "../../_components/icons";
import { LimitForm } from "../../_components/limit-form";
import { Modal, ModalHeader } from "../../_components/modal";

/** An approval with no store: a quiet bag, where a store's would show its icon. */
export function ApprovalTile({ faded = false }: { faded?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-chip text-muted ring-1 ring-black/[0.04] ${faded ? "opacity-60" : ""}`}
    >
      <Bag width={16} height={16} />
    </span>
  );
}

/**
 * Making a spending limit in Wallet: the same form as an assistant's request
 * (the amount, large; name, store and expiry as rows; the card as a row),
 * with the currency to pick and the store typed in. Only the user's click on
 * Approve makes it. Menta keeps nothing about it.
 */
export function NewApproval({
  currencies,
  currency,
  card,
  onClose,
  onMade,
}: {
  /** The card it starts on, when made from that card's details. */
  card?: string;
  /** The currencies of every market, as ISO 4217 codes. */
  currencies: readonly string[];
  /** The one it starts in: the visitor's. */
  currency: string;
  onClose: () => void;
  /** Made: reload the list. */
  onMade: () => void;
}) {
  const { m } = useI18n();
  const t = m.app.wallet.create;
  /**
   * Where Crossmint's flow is. While it creates the approval or confirms a
   * card check there's no leaving; during the check itself (the bank's or the
   * security code) the user may give up.
   */
  const [step, setStep] = useState<ApprovalStep["kind"]>("select");
  const approving = step === "working" || step === "confirming";
  return (
    <Modal
      labelledBy="new-approval-title"
      busy={approving}
      // Crossmint's card verification opens on the page: it must show above the modal.
      under={step === "verify"}
      onClose={onClose}
    >
      {(close) => (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <ModalHeader
            id="new-approval-title"
            title={t.title}
            lede={t.lede}
            close={close}
          />
          <LimitForm
            start={{ currency }}
            currencies={currencies}
            card={card}
            onStep={setStep}
            onApproved={() => {
              onMade();
            }}
            onCancel={close}
          />
        </div>
      )}
    </Modal>
  );
}

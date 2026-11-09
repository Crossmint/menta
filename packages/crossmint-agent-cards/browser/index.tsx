"use client";

import {
  CrossmintPaymentMethodManagement,
  type CrossmintPaymentMethodManagementRef,
  type PaymentMethodManagementAppearance,
} from "@crossmint/client-sdk-react-ui";
import { type ComponentProps, useRef, useState } from "react";
import { z } from "zod";

export interface SelectedCard {
  readonly paymentMethodId: string;
  readonly brand: string;
  readonly last4: string;
}

export interface CardManagementProps {
  readonly jwt: string;
  readonly appearance?: PaymentMethodManagementAppearance;
  readonly onCardSelected: (card: SelectedCard) => void | Promise<void>;
  /** The button under the form (Crossmint's SDK 5 draws none). */
  readonly submitLabel?: string;
  readonly buttonClassName?: string;
}

const selectedCardSchema = z.object({
  type: z.literal("card"),
  paymentMethodId: z
    .string()
    .min(1)
    .refine((value) => value === value.trim()),
  card: z.object({
    brand: z.string().min(1).max(64),
    last4: z.string().regex(/^\d{4}$/),
  }),
});

/**
 * Requires a CrossmintProvider configured by the authenticated consuming UI.
 * A new card needs its billing address (Crossmint shows the fields once the
 * card is filled in). Its button submits the picked or new card once the form
 * is complete, and what a submit couldn't do shows under it.
 */
export function CardManagement({
  jwt,
  appearance,
  onCardSelected,
  submitLabel = "Use this card",
  buttonClassName,
}: CardManagementProps) {
  const form = useRef<CrossmintPaymentMethodManagementRef>(null);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  /** onCardSelected is running: only it turns the button back on. */
  const keeping = useRef(false);
  const [message, setMessage] = useState("");
  async function submit() {
    if (!form.current || busy) {
      return;
    }
    setBusy(true);
    setMessage("");
    const result = await form.current.submit();
    if (
      keeping.current ||
      result.status === "saved" ||
      result.status === "selected"
    ) {
      return;
    }
    setBusy(false);
    if (
      result.status === "invalid" ||
      result.status === "failed" ||
      result.status === "unavailable"
    ) {
      setMessage(result.message);
    }
  }
  const selectCard: ComponentProps<
    typeof CrossmintPaymentMethodManagement
  >["onPaymentMethodSelected"] = async (paymentMethod) => {
    setBusy(true);
    keeping.current = true;
    try {
      const selected = selectedCardSchema.parse(paymentMethod);
      await onCardSelected({
        paymentMethodId: selected.paymentMethodId,
        brand: selected.card.brand,
        last4: selected.card.last4,
      });
    } catch {
      throw new Error("Card selection unavailable");
    } finally {
      keeping.current = false;
      setBusy(false);
    }
  };
  return (
    <div>
      <CrossmintPaymentMethodManagement
        ref={form}
        jwt={jwt}
        appearance={appearance}
        allowedModes={["existing", "new"]}
        allowedPaymentMethodTypes={["card"]}
        fields={{ billingDetails: { address: true } }}
        onReady={() => setReady(true)}
        onChange={(event) => {
          setComplete(event.complete);
          setMessage("");
        }}
        onPaymentMethodSelected={selectCard}
      />
      {message ? <p role="alert">{message}</p> : null}
      <button
        type="button"
        className={buttonClassName}
        disabled={!ready || !complete || busy}
        aria-busy={busy}
        onClick={() => void submit()}
      >
        {submitLabel}
      </button>
    </div>
  );
}

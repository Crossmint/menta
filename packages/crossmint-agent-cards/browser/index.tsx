"use client";

import {
  CrossmintPaymentMethodManagement,
  type PaymentMethodManagementAppearance,
} from "@crossmint/client-sdk-react-ui";
import type { ComponentProps } from "react";
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

/** Requires a CrossmintProvider configured by the authenticated consuming UI. */
export function CardManagement({
  jwt,
  appearance,
  onCardSelected,
}: CardManagementProps) {
  const selectCard: ComponentProps<
    typeof CrossmintPaymentMethodManagement
  >["onPaymentMethodSelected"] = async (paymentMethod) => {
    try {
      const selected = selectedCardSchema.parse(paymentMethod);
      await onCardSelected({
        paymentMethodId: selected.paymentMethodId,
        brand: selected.card.brand,
        last4: selected.card.last4,
      });
    } catch {
      throw new Error("Card selection unavailable");
    }
  };
  return (
    <CrossmintPaymentMethodManagement
      jwt={jwt}
      appearance={appearance}
      allowedModes={["existing", "new"]}
      allowedPaymentMethodTypes={["card"]}
      onPaymentMethodSelected={selectCard}
    />
  );
}

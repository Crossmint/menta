"use client";

import { addressLabels } from "@oca/crossmint-agent-checkouts/address-labels";
import { useEffect, useRef, useState } from "react";
import {
  type BuyerDraft,
  buyerDraft,
  type DraftErrors,
  draftErrors,
  LABEL_SUGGESTIONS,
  type SavedAddress,
  toDraft,
} from "../../lib/buyer-details";
import { useAccount } from "../../lib/client/account";
import { type Saved, saveAddress } from "../../lib/client/addresses";
import { useI18n } from "../../lib/i18n/client";
import { primary, secondaryButton } from "../(app)/settings/section";
import { AddressField, CountrySelect, railInput } from "./address-form";
import { PhoneField, phoneLooksValid, RegionField } from "./address-inputs";
import { ModalActions } from "./modal";

const input = railInput;

function Field({
  label,
  name,
  form,
  draft,
  errors,
  onChange,
  ...props
}: {
  label: string;
  name: keyof BuyerDraft;
  /** Keeps IDs unique while one form closes and another opens. */
  form: string;
  draft: BuyerDraft;
  errors: DraftErrors;
  onChange: (name: keyof BuyerDraft, value: string) => void;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "onChange" | "id" | "value"
>) {
  return (
    <AddressField
      label={label}
      id={`address-${form}-${name}`}
      name={name}
      value={draft[name]}
      error={errors[name]}
      onValue={(value) => onChange(name, value)}
      {...props}
    />
  );
}

/** The fields each step of the address form holds; Continue checks only the first's. */
const STEPS: readonly (readonly (keyof BuyerDraft)[])[] = [
  ["label", "firstName", "lastName", "email", "phone"],
  ["country", "address1", "address2", "city", "postalCode", "region"],
];

/**
 * The address form, for a new address or one being edited (in the app's
 * modal), in two steps short enough for a phone, each one autofill: who it's
 * for (what to call it, their name, email and phone), then where it goes.
 */
export function AddressForm({
  address,
  contact,
  start,
  hasDefault,
  onSaved,
  onCancel,
  onBusy,
}: {
  address: SavedAddress | null;
  /** Prefills a new address's email and phone. */
  contact: { email?: string | null; phone?: string | null };
  /** Fields a new address starts with (the chat's first address: "Home" and the user's name). */
  start?: Partial<BuyerDraft>;
  /** A new address offers to become the default, ticked while there is none. */
  hasDefault: boolean;
  onSaved: (saved: Saved) => void;
  onCancel: () => void;
  /** Saving: the modal around it holds still until it's done. */
  onBusy?: (busy: boolean) => void;
}) {
  const { m, f } = useI18n();
  const t = m.settings.addresses;
  const { country: visitorCountry } = useAccount();
  const form = address?.id ?? "new";
  const [draft, setDraft] = useState(() => ({
    ...toDraft(address, contact),
    ...(address ? {} : start),
  }));
  const labels = addressLabels(draft.country);
  const [step, setStep] = useState(0);
  /** Which way the last step change went, for its slide; none on first open. */
  const [moved, setMoved] = useState<"in" | "back" | null>(null);
  const go = (next: number) => {
    if (next !== step) {
      setMoved(next > step ? "in" : "back");
      setStep(next);
    }
  };
  const [errors, setErrors] = useState<DraftErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [makeDefault, setMakeDefault] = useState<boolean | null>(null);
  const body = useRef<HTMLDivElement>(null);

  // Each step starts on its first field (the first one to fix, after an error).
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step's fields mount
  useEffect(() => {
    const fields = body.current?.querySelectorAll<HTMLElement>(
      "input:not([type=checkbox]), select",
    );
    const invalid = body.current?.querySelector<HTMLElement>(
      "[aria-invalid=true]",
    );
    // A frame later: on first open the modal around it isn't shown yet.
    const frame = requestAnimationFrame(() =>
      (invalid ?? fields?.[0])?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [step]);

  function change(name: keyof BuyerDraft, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  /** The draft's errors for the fields of the given steps. */
  function problems(steps: number[]): DraftErrors {
    // Checking the first step alone, the address (still to come) stands in as valid.
    const checked = steps.includes(1)
      ? draft
      : {
          ...draft,
          country: "US",
          address1: "-",
          city: "-",
          region: "",
          postalCode: "",
        };
    const parsed = buyerDraft.safeParse(checked);
    const all: DraftErrors = parsed.success ? {} : draftErrors(parsed.error);
    if (!phoneLooksValid(draft.phone, draft.country)) {
      all.phone = m.settings.addressForm.invalidPhone;
    }
    const fields = new Set(steps.flatMap((index) => STEPS[index]));
    return Object.fromEntries(
      Object.entries(all).filter(([field]) =>
        fields.has(field as keyof BuyerDraft),
      ),
    );
  }

  async function next() {
    if (step === 0) {
      const found = problems([0]);
      setErrors(found);
      if (Object.keys(found).length === 0) {
        go(1);
      }
      return;
    }
    const found = problems([0, 1]);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // Back to the step that holds the first problem.
      go(STEPS[0].some((field) => found[field]) ? 0 : 1);
      return;
    }
    setSaving(true);
    onBusy?.(true);
    setError("");
    const result = await saveAddress(draft, {
      ...(address ? { id: address.id } : {}),
      makeDefault: !address && (makeDefault ?? !hasDefault),
    });
    setSaving(false);
    onBusy?.(false);
    if (result.ok) {
      onSaved({ id: result.id, addresses: result.addresses });
      return;
    }
    setErrors(result.fields);
    setError(result.error);
    if (STEPS[0].some((field) => result.fields[field])) {
      go(0);
    }
  }

  const fieldProps = { form, draft, errors, onChange: change };
  const stepNames = [t.stepContact, t.stepAddress];

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void next();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) {
          onCancel();
        }
      }}
      // The steps slide sideways: no scrollbar while they do.
      className="flex flex-col gap-5 overflow-x-clip"
    >
      <div className="flex flex-col gap-2">
        <div aria-hidden="true" className="grid grid-cols-2 gap-1.5">
          {stepNames.map((name, index) => (
            <span
              key={name}
              className={`h-1 rounded-full transition-colors ${index <= step ? "bg-ink" : "bg-black/[0.08]"}`}
            />
          ))}
        </div>
        <p className="m-0 text-[13px] text-muted" aria-live="polite">
          {f(t.step, { n: String(step + 1), total: String(STEPS.length) })} ·{" "}
          <span className="font-medium text-ink">{stepNames[step]}</span>
        </p>
      </div>
      <div
        ref={body}
        key={step}
        // A step slides in from the side it comes from: forward from the right, back from the left.
        className={`flex flex-col gap-3 ${moved === "in" ? "motion-safe:animate-[step-in_240ms_cubic-bezier(0.22,1,0.36,1)]" : moved === "back" ? "motion-safe:animate-[step-back_240ms_cubic-bezier(0.22,1,0.36,1)]" : ""}`}
      >
        {step === 0 ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`address-${form}-label`}
                className="text-[13px] text-muted"
              >
                {t.label}
              </label>
              <input
                id={`address-${form}-label`}
                // Not an address field: keep autofill and password managers out of it.
                name="save-as"
                data-1p-ignore=""
                data-lpignore="true"
                data-form-type="other"
                value={draft.label}
                onChange={(event) => change("label", event.target.value)}
                placeholder={t.labelPlaceholder}
                maxLength={40}
                autoComplete="off"
                aria-invalid={errors.label ? true : undefined}
                aria-describedby={
                  errors.label ? `address-${form}-label-error` : undefined
                }
                className={input}
              />
              <div className="flex flex-wrap gap-1.5">
                {LABEL_SUGGESTIONS.map((suggestion) => {
                  const picked =
                    draft.label.trim().toLowerCase() ===
                    suggestion.toLowerCase();
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => change("label", suggestion)}
                      className="h-8 flex-none rounded-full border border-line-card bg-white px-3 text-[13px] font-medium text-soft transition-colors hover:text-ink aria-pressed:border-ink aria-pressed:text-ink pointer-coarse:h-10"
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
              {errors.label ? (
                <span
                  id={`address-${form}-label-error`}
                  className="text-[12px] text-danger"
                >
                  {errors.label}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t.firstName}
                name="firstName"
                autoComplete="given-name"
                {...fieldProps}
              />
              <Field
                label={t.lastName}
                name="lastName"
                autoComplete="family-name"
                {...fieldProps}
              />
            </div>
            <Field
              label={t.email}
              name="email"
              type="email"
              autoComplete="email"
              {...fieldProps}
            />
            <PhoneField
              id={`address-${form}-phone`}
              label={t.phone}
              country={visitorCountry ?? draft.country}
              value={draft.phone}
              error={errors.phone}
              onValue={(value) => change("phone", value)}
            />
          </>
        ) : (
          <>
            <CountrySelect
              id={`address-${form}-country`}
              value={draft.country}
              onValue={(value) => change("country", value)}
            />
            <Field
              label={t.address}
              name="address1"
              autoComplete="address-line1"
              {...fieldProps}
            />
            <Field
              label={t.address2}
              name="address2"
              autoComplete="address-line2"
              {...fieldProps}
            />
            <div className="grid grid-cols-[3fr_2fr] gap-3">
              <Field
                label={t.city}
                name="city"
                autoComplete="address-level2"
                {...fieldProps}
              />
              <Field
                label={labels.postalCode}
                name="postalCode"
                autoComplete="postal-code"
                {...fieldProps}
              />
            </div>
            <RegionField
              id={`address-${form}-region`}
              label={labels.region}
              example={labels.regionExample}
              country={draft.country}
              value={draft.region}
              error={errors.region}
              onValue={(value) => change("region", value)}
            />
            {address ? null : (
              // Untick it for someone else's address: the default is the user's own place.
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-soft select-none">
                <input
                  type="checkbox"
                  checked={makeDefault ?? !hasDefault}
                  disabled={saving}
                  onChange={(event) => setMakeDefault(event.target.checked)}
                  className="size-4 accent-ink"
                />
                {t.defaultForMe}
              </label>
            )}
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <ModalActions>
        <button
          type="button"
          onClick={step === 0 ? onCancel : () => go(0)}
          disabled={saving}
          className={secondaryButton}
        >
          {step === 0 ? t.cancel : t.back}
        </button>
        <button
          type="submit"
          disabled={saving}
          onClick={(event) => {
            // Continue becomes Save in place: a double click mustn't save unseen.
            if (event.detail > 1) {
              event.preventDefault();
            }
          }}
          className={primary}
        >
          {saving ? (
            <span className="spinner border-white/40 border-t-white" />
          ) : null}
          {step === 0 ? t.continue : t.save}
        </button>
      </ModalActions>
    </form>
  );
}

"use client";

import { COUNTRY_CODES } from "@oca/crossmint-agent-checkouts/address-labels";
import { type InputHTMLAttributes, useMemo } from "react";
import { useI18n } from "../../lib/i18n/client";

/** Every country, named and sorted in the page's language. */
export function useCountries() {
  const { tag } = useI18n();
  return useMemo(() => {
    const names = new Intl.DisplayNames([tag], { type: "region" });
    return COUNTRY_CODES.map((code) => ({
      code,
      name: names.of(code) ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name, tag));
  }, [tag]);
}

/**
 * The settings page's inputs: white with a hairline that turns ink on focus.
 * 16px text on touch screens, so iOS doesn't zoom in on focus; 14px only with a mouse.
 */
export const railInput =
  "h-11 w-full min-w-0 rounded-[12px] border border-line-card bg-white px-3.5 text-[16px] outline-none transition-colors placeholder:text-placeholder focus:border-ink aria-[invalid=true]:border-danger sm:pointer-fine:h-10 sm:pointer-fine:text-[14px]";

/** One labelled address input with its error underneath. */
export function AddressField({
  label,
  id,
  value,
  error,
  onValue,
  className = "",
  inputClassName = railInput,
  labelClassName = "text-[13px] text-muted",
  ...props
}: {
  label: string;
  id: string;
  value: string;
  error?: string;
  onValue: (value: string) => void;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">) {
  return (
    <label
      htmlFor={id}
      className={`flex min-w-0 flex-col gap-1.5 ${className}`}
    >
      <span className={labelClassName}>{label}</span>
      <input
        id={id}
        value={value}
        onChange={(event) => onValue(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClassName}
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="text-[12px] text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function CountrySelect({
  id,
  value,
  onValue,
  className = "",
  selectClassName = railInput,
  labelClassName = "text-[13px] text-muted",
}: {
  id: string;
  value: string;
  onValue: (value: string) => void;
  className?: string;
  selectClassName?: string;
  labelClassName?: string;
}) {
  const { m } = useI18n();
  const countries = useCountries();
  return (
    <label
      htmlFor={id}
      className={`flex min-w-0 flex-col gap-1.5 ${className}`}
    >
      <span className={labelClassName}>{m.settings.addressForm.country}</span>
      <select
        id={id}
        name="country"
        autoComplete="country"
        value={value}
        onChange={(event) => onValue(event.target.value)}
        className={selectClassName}
      >
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
    </label>
  );
}

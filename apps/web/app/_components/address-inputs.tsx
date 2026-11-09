"use client";

import { iso31662 } from "iso-3166";
import {
  AsYouType,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  type PhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js/min";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n/client";
import { railInput } from "./address-form";

/**
 * ISO lists some names index-style ("Madrid, Comunidad de"); people read
 * them the other way round ("Comunidad de Madrid"). Two-name entries like
 * "Valle d'Aosta, Vallée d'Aoste" or "Trentino-Alto Adige, Trentino-Südtirol"
 * stay as they are, and so does "Diekirch (de, lb)".
 */
function readingOrder(name: string) {
  const index = /^(.+), ((?:\S+ )*(?:de|del|de la|do|da|di)|\p{L}+)$/u.exec(
    name,
  );
  return index ? `${index[2]} ${index[1]}` : name;
}

/**
 * A country's first-level ISO 3166-2 subdivisions: the states of the US, the
 * autonomous communities of Spain (Catalunya is ES-CT, not its provinces like
 * ES-B), the regions of France. Null where a list doesn't help (none, or the
 * UK's 200-odd council areas), so the form falls back to a text field.
 */
function useSubdivisions(country: string) {
  const { tag } = useI18n();
  return useMemo(() => {
    const top = iso31662.filter(
      (subdivision) => subdivision.parent === country,
    );
    if (top.length === 0 || top.length > 60) {
      return null;
    }
    return top
      .map((subdivision) => ({
        code: subdivision.code.slice(country.length + 1),
        name: readingOrder(subdivision.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, tag));
  }, [country, tag]);
}

/** Lowercase, without accents or punctuation, for matching what autofill or a person typed. */
function plain(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The listed subdivision a typed or autofilled region means: by code or name
 * at any ISO level, walked up to the first level. Autofill gives Spain's
 * province ("Barcelona", ES-B), which is in Catalunya (CT).
 */
function resolveRegion(
  country: string,
  text: string,
  listed: readonly { code: string }[] | null,
) {
  const wanted = plain(text.replace(new RegExp(`^${country}-`, "i"), ""));
  if (!wanted) {
    return null;
  }
  const prefix = `${country}-`;
  const match = iso31662.find(
    (subdivision) =>
      subdivision.code.startsWith(prefix) &&
      (plain(subdivision.code.slice(prefix.length)) === wanted ||
        [subdivision.name, readingOrder(subdivision.name)]
          .flatMap((name) => [name, ...name.split(/, | \/ /)])
          .some((name) => plain(name) === wanted)),
  );
  if (!match) {
    return null;
  }
  let top = match;
  while (listed && top.parent !== country) {
    const parent = iso31662.find((item) => item.code === top.parent);
    if (!parent) {
      break;
    }
    top = parent;
  }
  const code = top.code.slice(prefix.length);
  return !listed || listed.some((item) => item.code === code) ? code : null;
}

/**
 * State, province or region: a text field that suggests the country's
 * first-level ISO subdivisions and takes any level by name or code (so
 * autofill works whichever it fills, and in either order with the country).
 * The value is the code without the country ("CT" for ES-CT); text that
 * matches nothing is passed on as typed, for the form to flag.
 */
export function RegionField({
  id,
  label,
  example,
  country,
  value,
  error,
  disabled,
  onValue,
}: {
  id: string;
  label: string;
  example: string;
  country: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onValue: (value: string) => void;
}) {
  const subdivisions = useSubdivisions(country);
  const nameOf = (code: string) =>
    subdivisions?.find((item) => item.code === code)?.name ?? code;
  // A saved code shows by name; text typed before (the step was left) as typed.
  const [text, setText] = useState(
    () =>
      subdivisions?.find(
        (item) => item.code === value.toUpperCase().replace(`${country}-`, ""),
      )?.name ?? value,
  );
  const input = useRef<HTMLInputElement>(null);
  /** The country the text was last taken for. */
  const takenFor = useRef(country);

  /** Takes text as the region: its code when it means one, shown by name when `tidy`. */
  function take(next: string, tidy: boolean) {
    const code = resolveRegion(country, next, subdivisions);
    setText(code && tidy ? nameOf(code) : next);
    onValue(code ?? next.trim());
  }

  // Another country: keep the region if it means one there (autofill may have
  // filled it first), else start over where there's a list, or pass the text
  // on as typed where there isn't (not the last country's code). Not on mount:
  // coming back to this step keeps what was there, and its error.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the country changes
  useEffect(() => {
    if (takenFor.current === country) {
      return;
    }
    takenFor.current = country;
    if (!text.trim()) {
      return;
    }
    if (resolveRegion(country, text, subdivisions)) {
      take(text, true);
    } else if (subdivisions) {
      setText("");
      onValue("");
    } else {
      onValue(text.trim());
    }
  }, [country]);

  const list = subdivisions ? `${id}-list` : undefined;
  const described = error ? `${id}-error` : undefined;
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <input
        ref={input}
        id={id}
        name="region"
        autoComplete="address-level1"
        list={list}
        value={text}
        placeholder={subdivisions ? subdivisions[0]?.name : example}
        disabled={disabled}
        // Autofill fills it without focus: show the name it means right away.
        onChange={(event) =>
          take(event.target.value, document.activeElement !== input.current)
        }
        onBlur={() => take(text, true)}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={railInput}
      />
      {subdivisions ? (
        <datalist id={list}>
          {subdivisions.map((item) => (
            <option key={item.code} value={item.name} />
          ))}
        </datalist>
      ) : null}
      {error ? (
        <span id={described} className="text-[12px] text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const phoneCountries = getCountries();

function isPhoneCountry(code: string): code is CountryCode {
  return (phoneCountries as readonly string[]).includes(code);
}

/** The number in its country's format, without any extension: there's no field for one. */
function nationalOf(parsed: PhoneNumber) {
  return (
    parsePhoneNumberFromString(parsed.number)?.formatNational() ??
    parsed.nationalNumber
  );
}

/** A saved phone ("+34 612 34 56 78") split into its calling code's country and the number. */
function splitPhone(value: string, fallback: CountryCode) {
  const parsed = value
    ? parsePhoneNumberFromString(value, fallback)
    : undefined;
  if (!parsed) {
    return { country: fallback, national: value };
  }
  return {
    country: parsed.country ?? fallback,
    // A number no country claims (+1 555…, +800…) keeps its own code.
    national: parsed.country ? nationalOf(parsed) : parsed.number,
  };
}

/** The phone as stored: E.164, or as typed if it doesn't parse. */
function joinPhone(country: CountryCode, national: string) {
  if (!national.trim()) {
    return "";
  }
  return parsePhoneNumberFromString(national, country)?.number ?? national;
}

/**
 * A whole number with its calling code: "+34 648…", "0034 648…", or the
 * code as plain digits ("34 648…"), the way some password managers fill it
 * when it isn't a valid number without it.
 */
function international(typed: string, country: CountryCode) {
  if (/^\s*(\+|00)/.test(typed)) {
    return parsePhoneNumberFromString(typed.replace(/^\s*00/, "+"));
  }
  // libphonenumber reads a leading calling code off a national number itself
  // when what's left is valid there: take that reading.
  const digits = typed.replace(/\D/g, "");
  const code = getCountryCallingCode(country);
  const parsed = parsePhoneNumberFromString(digits, country);
  return digits.startsWith(code) &&
    parsed?.isValid() &&
    parsed.nationalNumber === digits.slice(code.length)
    ? parsed
    : undefined;
}

/** Whether a stored phone is one that could be dialled (empty is fine: it's optional). */
export function phoneLooksValid(value: string, country: string) {
  if (!value.trim()) {
    return true;
  }
  const parsed = parsePhoneNumberFromString(
    value,
    isPhoneCountry(country) ? country : undefined,
  );
  return Boolean(parsed?.isPossible());
}

/**
 * Phone: the calling code (shown as "+34", picked by country) and the number
 * formatted for that country. Autofill can fill the number whole, with its
 * code ("+1 415…" or "34 648…" set the code too).
 */
export function PhoneField({
  id,
  label,
  country,
  value,
  error,
  disabled,
  onValue,
}: {
  id: string;
  label: string;
  /** Where the visitor is (else the address's country): the calling code until the number says otherwise. */
  country: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onValue: (value: string) => void;
}) {
  const { m, tag } = useI18n();
  const fallback: CountryCode = isPhoneCountry(country) ? country : "US";
  const [parts, setParts] = useState(() => splitPhone(value, fallback));

  // A new address's phone follows its country until a number is typed.
  useEffect(() => {
    setParts((current) =>
      current.national ? current : { ...current, country: fallback },
    );
  }, [fallback]);

  const options = useMemo(() => {
    const names = new Intl.DisplayNames([tag], { type: "region" });
    return phoneCountries
      .map((code) => ({
        code,
        name: `${names.of(code) ?? code} (+${getCountryCallingCode(code)})`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, tag));
  }, [tag]);

  function update(next: typeof parts) {
    setParts(next);
    onValue(joinPhone(next.country, next.national));
  }

  function typeNumber(typed: string) {
    // A whole international number (autofill, paste) carries its own code.
    const whole = international(typed, parts.country);
    if (whole?.country) {
      update({ country: whole.country, national: nationalOf(whole) });
      return;
    }
    // Format as typed, but not while deleting, so backspace isn't fought.
    const national =
      typed.length > parts.national.length
        ? new AsYouType(parts.country).input(typed)
        : typed;
    update({ ...parts, national });
  }

  const described = error ? `${id}-error` : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-muted">
        {label}
      </label>
      <div className="flex min-w-0 gap-2">
        {/* The select is invisible over its "+34", so the field stays narrow. */}
        <div className="relative w-[76px] flex-none [&:focus-within>span]:border-ink">
          <span
            aria-hidden="true"
            className={`${railInput} pointer-events-none flex items-center justify-between gap-1 tabular-nums`}
          >
            +{getCountryCallingCode(parts.country)}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="flex-none text-muted"
              aria-hidden="true"
            >
              <path
                d="M2 3.5 5 6.5 8 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <select
            aria-label={m.settings.addressForm.phoneCountry}
            autoComplete="tel-country-code"
            value={parts.country}
            disabled={disabled}
            onChange={(event) => {
              const next = event.target.value;
              if (isPhoneCountry(next)) {
                update({ ...parts, country: next });
              }
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {options.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <input
          id={id}
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={parts.national}
          disabled={disabled}
          onChange={(event) => typeNumber(event.target.value)}
          onBlur={() => {
            const parsed = parsePhoneNumberFromString(
              parts.national,
              parts.country,
            );
            if (parsed && parsed.country === parts.country) {
              update({ ...parts, national: nationalOf(parsed) });
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`${railInput} flex-1`}
        />
      </div>
      {error ? (
        <span id={described} className="text-[12px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

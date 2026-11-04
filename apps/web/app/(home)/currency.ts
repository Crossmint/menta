/**
 * Prices on the homepage in the reader's currency: their country's (markets.ts)
 * where we know it, else their language's. Made-up dollar prices at rough
 * rates, rounded the way stores price.
 */

interface Currency {
  readonly code: string;
  /** Roughly how many of it to a US dollar. */
  readonly rate: number;
  /** Prices round up to a multiple of `step`, then drop `less`, as stores price. */
  readonly step: number;
  readonly less: number;
}

const euro: Currency = { code: "EUR", rate: 0.92, step: 1, less: 0.01 };

const CURRENCIES: Readonly<Record<string, Currency>> = {
  en: { code: "USD", rate: 1, step: 1, less: 0.01 },
  es: euro,
  fr: euro,
  de: euro,
  it: euro,
  nl: euro,
  "pt-BR": { code: "BRL", rate: 5.4, step: 1, less: 0.01 },
  pl: { code: "PLN", rate: 4, step: 1, less: 0.01 },
  sv: { code: "SEK", rate: 10.6, step: 10, less: 1 },
  nb: { code: "NOK", rate: 10.8, step: 10, less: 1 },
  da: { code: "DKK", rate: 6.9, step: 10, less: 1 },
  fi: euro,
  hi: { code: "INR", rate: 84, step: 10, less: 1 },
  ja: { code: "JPY", rate: 150, step: 100, less: 0 },
  ko: { code: "KRW", rate: 1380, step: 1000, less: 0 },
  "zh-CN": { code: "CNY", rate: 7.2, step: 1, less: 0.01 },
};

/** Currencies by code, for a country's (markets.ts). */
const BY_CODE: Readonly<Record<string, Currency>> = {
  ...Object.fromEntries(
    Object.values(CURRENCIES).map((currency) => [currency.code, currency]),
  ),
  GBP: { code: "GBP", rate: 0.79, step: 1, less: 0.01 },
  CAD: { code: "CAD", rate: 1.37, step: 1, less: 0.01 },
  AUD: { code: "AUD", rate: 1.52, step: 1, less: 0.01 },
  MXN: { code: "MXN", rate: 18, step: 10, less: 1 },
  COP: { code: "COP", rate: 4000, step: 1000, less: 100 },
  CLP: { code: "CLP", rate: 950, step: 1000, less: 10 },
  PEN: { code: "PEN", rate: 3.75, step: 1, less: 0.1 },
  UYU: { code: "UYU", rate: 40, step: 100, less: 10 },
  CRC: { code: "CRC", rate: 510, step: 100, less: 10 },
  DOP: { code: "DOP", rate: 59, step: 100, less: 5 },
  GTQ: { code: "GTQ", rate: 7.7, step: 1, less: 0.01 },
};

/** Every currency a market or a language prices in (ISO 4217 codes). */
export const CURRENCY_CODES: readonly string[] = Object.keys(BY_CODE);

/** The currency for a page: `code` (the visitor's country's) if given, else the language's. */
export function currencyFor(tag: string, code?: string | null) {
  return (code && BY_CODE[code]) || CURRENCIES[tag] || euro;
}

/** Where the visitor is (markets.ts): their country and its currency. */
export interface Place {
  readonly country: string | null;
  readonly currency: string | null;
}

/**
 * The page's language as written in the visitor's country, for prices:
 * Spanish in Peru reads "S/ 149.90", in Colombia "$ 560.000".
 */
export function regional(tag: string, country?: string | null) {
  return country ? `${tag.split("-")[0]}-${country}` : tag;
}

export function localPrice(tag: string, usd: number, place?: Place) {
  const currency = currencyFor(tag, place?.currency);
  // Prices in whole units read "899 kr", not "899,00 kr".
  const digits = Number.isInteger(currency.less) ? 0 : undefined;
  return new Intl.NumberFormat(regional(tag, place?.country), {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(
    Math.ceil((usd * currency.rate) / currency.step) * currency.step -
      currency.less,
  );
}

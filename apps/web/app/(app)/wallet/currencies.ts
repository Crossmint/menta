import { headers } from "next/headers";
import { getI18n } from "../../../lib/i18n/server";
import { CURRENCY_CODES, currencyFor } from "../../(home)/currency";
import { COUNTRIES, marketFor } from "../../(home)/markets";

/**
 * What a new spending limit can be in (the currency of any country Menta has
 * a market for) and what it starts in: the visitor's country's, else their
 * language's.
 */
export async function limitCurrencies() {
  const { tag } = await getI18n();
  const country = (await headers()).get("x-vercel-ip-country");
  const currencies = [
    ...new Set([
      ...COUNTRIES.flatMap((code) => marketFor(code).currency ?? []),
      ...CURRENCY_CODES,
    ]),
  ];
  return {
    currencies,
    // No country header (local dev, other hosts): the language's, not the US plan's.
    currency: (country && marketFor(country).currency) || currencyFor(tag).code,
  };
}

/**
 * Address field wording by country, for every address form (web and the
 * in-host card). Crossmint's shipping address is international: the region is
 * an optional ISO 3166-2 subdivision code, the postal code is optional, and
 * any country works. No dependencies, so the card can bundle it.
 */
export interface AddressLabels {
  /** "State", "Province", "County (optional)", "Region (optional)". */
  readonly region: string;
  /** An example subdivision code, or "" where people don't use one. */
  readonly regionExample: string;
  /** "ZIP", "Postcode", "Postal code", "PIN code", "CEP". */
  readonly postalCode: string;
}

const byCountry: Record<string, AddressLabels> = {
  US: { region: "State", regionExample: "CA", postalCode: "ZIP" },
  CA: { region: "Province", regionExample: "ON", postalCode: "Postal code" },
  AU: { region: "State", regionExample: "NSW", postalCode: "Postcode" },
  MX: { region: "State", regionExample: "CMX", postalCode: "Postal code" },
  BR: { region: "State", regionExample: "SP", postalCode: "CEP" },
  IN: { region: "State", regionExample: "MH", postalCode: "PIN code" },
  GB: {
    region: "County (optional)",
    regionExample: "",
    postalCode: "Postcode",
  },
  IE: { region: "County (optional)", regionExample: "", postalCode: "Eircode" },
  NZ: {
    region: "Region (optional)",
    regionExample: "",
    postalCode: "Postcode",
  },
};

const fallback: AddressLabels = {
  region: "Region (optional)",
  regionExample: "",
  postalCode: "Postal code",
};

export function addressLabels(country: string): AddressLabels {
  return byCountry[country.toUpperCase()] ?? fallback;
}

/**
 * The country a new address starts with: the browser's region ("en-GB" →
 * "GB"), else the US. Saved addresses keep their own country.
 */
export function defaultCountry(): string {
  try {
    const language =
      typeof navigator === "undefined" ? "" : (navigator.language ?? "");
    const region = language ? new Intl.Locale(language).maximize().region : "";
    return region && /^[A-Z]{2}$/.test(region) ? region : "US";
  } catch {
    return "US";
  }
}

/** ISO 3166-1 alpha-2 codes every address form offers; names come from Intl. */
export const COUNTRY_CODES: readonly string[] =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );

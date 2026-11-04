/**
 * The ways to pay the homepage's "any method" card cycles through after
 * cards, by the visitor's country: the local way most people pay first,
 * then what works across borders. Each one the user finishes on their own
 * phone, never through the agent: they type their number and approve in
 * the app (Bizum, MB WAY, Swish…), open a link or code we hand them (Pix,
 * iDEAL, UPI, Mercado Pago…), or type a one-time code into the secure page,
 * which keeps it in the vault (BLIK, Yape). Each is the method's own logo
 * in public/payments, or its app icon beside its name where it has no
 * wordmark we can use (sources in public/payments/CREDITS.md).
 */

type Look =
  | {
      /** The wordmark, `width` × `height` at its own proportions, drawn at `size`. */
      readonly logo: string;
      readonly width: number;
      readonly height: number;
      readonly size: string;
    }
  | { readonly icon: string };

export const PAYMENTS = {
  klarna: {
    name: "Klarna",
    logo: "klarna.svg",
    width: 1448,
    height: 609,
    size: "h-8",
  },
  shoppay: {
    name: "Shop Pay",
    logo: "shoppay.svg",
    width: 683,
    height: 164,
    size: "h-6",
  },
  paypal: {
    name: "PayPal",
    logo: "paypal.svg",
    width: 124,
    height: 33,
    size: "h-6",
  },
  bizum: {
    name: "Bizum",
    logo: "bizum.svg",
    width: 122,
    height: 36,
    size: "h-7",
  },
  satispay: {
    name: "Satispay",
    logo: "satispay.svg",
    width: 128,
    height: 30,
    size: "h-6",
  },
  mbway: { name: "MB WAY", icon: "mbway.png" },
  swish: {
    name: "Swish",
    logo: "swish.svg",
    width: 578,
    height: 176,
    size: "h-8",
  },
  vipps: {
    name: "Vipps",
    logo: "vipps.svg",
    width: 164,
    height: 66,
    size: "h-9",
  },
  mobilepay: {
    name: "MobilePay",
    logo: "mobilepay.svg",
    width: 215,
    height: 69,
    size: "h-8",
  },
  pix: { name: "Pix", logo: "pix.svg", width: 238, height: 84, size: "h-10" },
  nequi: {
    name: "Nequi",
    logo: "nequi.svg",
    width: 104,
    height: 33,
    size: "h-6",
  },
  kakaopay: {
    name: "Kakao Pay",
    logo: "kakaopay.png",
    width: 200,
    height: 72,
    size: "h-7",
  },
  ideal: {
    name: "iDEAL",
    logo: "ideal.svg",
    width: 165,
    height: 144,
    size: "h-10",
  },
  blik: { name: "BLIK", logo: "blik.svg", width: 136, height: 64, size: "h-8" },
  mercadopago: {
    name: "Mercado Pago",
    logo: "mercadopago.png",
    width: 284,
    height: 74,
    size: "h-8",
  },
  modo: { name: "MODO", icon: "modo.png" },
  pse: { name: "PSE", logo: "pse.svg", width: 522, height: 192, size: "h-7" },
  mach: { name: "MACH", icon: "mach.png" },
  yape: {
    name: "Yape",
    logo: "yape.svg",
    width: 510,
    height: 269,
    size: "h-9",
  },
  deuna: { name: "Deuna", icon: "deuna.png" },
  upi: { name: "UPI", logo: "upi.svg", width: 281, height: 99, size: "h-7" },
  phonepe: {
    name: "PhonePe",
    logo: "phonepe.svg",
    width: 230,
    height: 70,
    size: "h-8",
  },
  paytm: {
    name: "Paytm",
    logo: "paytm.svg",
    width: 48,
    height: 15,
    size: "h-6",
  },
  paypay: {
    name: "PayPay",
    logo: "paypay.svg",
    width: 3517,
    height: 882,
    size: "h-7",
  },
  naverpay: {
    name: "Naver Pay",
    logo: "naverpay.png",
    width: 160,
    height: 71,
    size: "h-8",
  },
} as const satisfies Record<string, { readonly name: string } & Look>;

export type PaymentId = keyof typeof PAYMENTS;
export type Payment = (typeof PAYMENTS)[PaymentId];

/** Three, so the card's loop (art-pay in style.css) has four stops with cards. */
type Three = readonly [PaymentId, PaymentId, PaymentId];

/** Everywhere else: what works across borders. */
const DEFAULT: Three = ["klarna", "shoppay", "paypal"];

/** The countries with a way to pay most people there use. */
const BY_COUNTRY: Partial<Record<string, Three>> = {
  ES: ["bizum", "paypal", "klarna"],
  PT: ["mbway", "paypal", "klarna"],
  IT: ["satispay", "paypal", "klarna"],
  NL: ["ideal", "paypal", "klarna"],
  PL: ["blik", "paypal", "klarna"],
  SE: ["swish", "klarna", "paypal"],
  NO: ["vipps", "klarna", "paypal"],
  DK: ["mobilepay", "klarna", "paypal"],
  FI: ["mobilepay", "klarna", "paypal"],
  BR: ["pix", "mercadopago", "paypal"],
  MX: ["mercadopago", "paypal", "klarna"],
  AR: ["mercadopago", "modo", "paypal"],
  CO: ["nequi", "pse", "mercadopago"],
  CL: ["mercadopago", "mach", "paypal"],
  PE: ["yape", "mercadopago", "paypal"],
  EC: ["deuna", "paypal", "shoppay"],
  UY: ["mercadopago", "paypal", "shoppay"],
  PA: ["nequi", "paypal", "shoppay"],
  IN: ["upi", "phonepe", "paytm"],
  JP: ["paypay", "paypal", "shoppay"],
  KR: ["naverpay", "kakaopay", "paypal"],
};

export function paymentsFor(country: string | null): Three {
  return (country && BY_COUNTRY[country]) || DEFAULT;
}

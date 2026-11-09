import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { z } from "zod";

/**
 * A spending limit an assistant asks the user to approve, carried in the
 * link it gives them (`/spending-limit/<token>`) instead of the query string:
 * sealed with AES-256-GCM, so the link says nothing about it (not in browser
 * history, logs or the chat), bound to the user it's for, and short-lived.
 * Menta stores nothing: the page opens the token and fills the form.
 */

export const limitRequest = z.object({
  name: z.string().trim().min(1).max(255),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  /** week or month, or the day it ends (2026-12-24). */
  expires: z.union([
    z.enum(["week", "month"]),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ]),
  /** The store it's for ("amazon.es"); left out for any store. */
  store: z.string().trim().min(1).max(200).optional(),
  /** The checkout waiting to pay with it. */
  runId: z.string().min(1).max(200).optional(),
  /** Which assistant asked: chatgpt, claude or grok. */
  via: z.string().max(20).optional(),
});

export type LimitRequest = z.infer<typeof limitRequest>;

/** How long a request link works. */
export const LIMIT_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

/** The sealing key, derived from the Stytch secret; null without it. */
export function limitRequestKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Buffer | null {
  const secret = env.STYTCH_SECRET?.trim();
  return secret
    ? createHmac("sha256", secret).update("menta/limit-request/v1").digest()
    : null;
}

const AAD = Buffer.from("menta-limit-request");

export function sealLimitRequest(
  key: Buffer,
  userId: string,
  request: LimitRequest,
  now = Date.now(),
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const body = Buffer.concat([
    cipher.update(
      JSON.stringify({ u: userId, e: now + LIMIT_REQUEST_TTL_MS, r: request }),
      "utf8",
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

const sealed = z.object({ u: z.string(), e: z.number(), r: limitRequest });

/** The request, if the token is ours, unexpired and for this user; else null. */
export function openLimitRequest(
  key: Buffer,
  userId: string,
  token: string,
  now = Date.now(),
): LimitRequest | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 12 + 16 + 1) {
      return null;
    }
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAAD(AAD);
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const plain = Buffer.concat([
      decipher.update(raw.subarray(12, raw.length - 16)),
      decipher.final(),
    ]).toString("utf8");
    const parsed = sealed.safeParse(JSON.parse(plain));
    if (!parsed.success || parsed.data.u !== userId || parsed.data.e < now) {
      return null;
    }
    return parsed.data.r;
  } catch {
    return null;
  }
}

/** What the model fills in: the request, without who asked (the server knows). */
export const limitRequestInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe(
      'A short, generic name for what it\'s for, in the user\'s language: "Groceries", "Dinner delivery", "Peru trip". A few words, not a sentence or a description. Not a product or store name, unless that\'s what the budget is for.',
    ),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/)
    .describe(
      'How much it allows in total, as a decimal ("150" or "80.50"). For one checkout, its ceiling; for repeat buys, what the user wants to allow, or a round sum that fits.',
    ),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .describe(
      "ISO 4217 code, in the store's or the user's currency: USD, EUR.",
    ),
  expires: z
    .union([z.enum(["week", "month"]), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .describe(
      'When the limit expires, a week or a month from now ("week", "month", the usual) or on a day (2026-12-24) for a trip or event. It is one amount for that whole time and never resets: not a weekly or monthly budget.',
    ),
  store: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe(
      'The one store it works at ("amazon.es"). Leave it out for any store.',
    ),
  runId: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe(
      "A checkout waiting for payment that this limit should pay once the user approves it. Then currency must be that payment's, amount at least its amount, and store, if given, its store.",
    ),
});

export const LIMIT_REQUEST_DESCRIPTION =
  "Ask the user to approve a spending limit: one amount on one of their saved cards that Menta pays checkouts from, for a store or any store, until it runs out or expires; it never resets. Use it when a checkout's payment step tells you to, or when the user asks for a budget ahead of time (groceries this month, a trip). When the user wants to buy something, never call it before the checkout starts: start the checkout first, and at its payment step, when the store is ready to charge, either one of their limits pays or you ask for one then. Fill in what you can infer (a generic name, an amount that fits, a month) instead of asking: the link opens a Menta page where the user checks the details, can change any of them, picks one of their saved cards and approves it in Crossmint's form. Ask only if you can't tell what it's for. Nothing is approved until they do; you can't approve, create or raise a limit.";

/** A payment's amount as a request takes it: at most two decimals, rounded up so it covers. */
export function requestAmount(amount: string) {
  if (/^\d+(\.\d{1,2})?$/.test(amount)) {
    return amount;
  }
  const value = Number(amount);
  return Number.isFinite(value) && value > 0
    ? (Math.ceil(value * 100) / 100).toFixed(2)
    : null;
}

/** A store's site ("https://www.Amazon.es/x" or "amazon.es" → "amazon.es"). */
function siteOf(store: string) {
  const raw = store.trim();
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * Why a request can't pay the payment it names, or null when it can:
 * Crossmint pays only from a limit in the payment's currency that covers it,
 * made for any store or for the payment's.
 */
export function shortOfPayment(
  request: Pick<LimitRequest, "amount" | "currency" | "store">,
  payment: {
    readonly amount: { readonly amount: string; readonly currency: string };
    readonly merchant: { readonly url: string };
  },
): string | null {
  const currency = payment.amount.currency.trim().toUpperCase();
  const needed = requestAmount(payment.amount.amount);
  if (request.currency.trim().toUpperCase() !== currency) {
    return `That checkout pays in ${currency}: ask for the spending limit in ${currency}.`;
  }
  if (needed && Number(request.amount) < Number(payment.amount.amount)) {
    return `That checkout's payment is ${needed} ${currency}: ask for at least that amount.`;
  }
  const site = siteOf(payment.merchant.url);
  if (site && request.store && siteOf(request.store) !== site) {
    return `That checkout is at ${site}: leave store out, or set it to ${site}.`;
  }
  return null;
}

/** The page for a sealed request, and what to tell the model about it. */
export function limitRequestResult(
  origin: string,
  token: string,
  /** What to do once the link is given, when it pays a checkout being followed. */
  then = "",
) {
  return {
    url: `${origin}/spending-limit/${token}`,
    next: `Give the user this url exactly as returned, in one short line saying what the limit is for and how much. They review it, pick one of their saved cards and approve it there, signed in to Menta; the link works for 24 hours. Don't say it's approved until they tell you.${then ? ` ${then}` : ""}`,
  };
}

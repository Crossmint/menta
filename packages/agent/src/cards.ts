import { z } from "zod";

export interface PrepareCardsOptions {
  /** Crossmint client key: the registration routes only accept a user JWT. */
  readonly apiKey: string;
  /** The user's Stytch session JWT; Crossmint resolves the user from it. */
  readonly jwt: string;
  /** The buyer's email, which Crossmint needs to enroll a card. */
  readonly email: string | null;
  /** Our web origin. Client keys only answer origins they allow. */
  readonly origin: string;
  /** Budget for the whole preparation. */
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
}

/** What our card list shows: never a card number, CVC, BIN, billing details or token. */
export interface SavedCard {
  readonly paymentMethodId: string;
  /** Crossmint's brand, lower case: "visa", "mastercard", "amex", … */
  readonly brand: string;
  readonly last4: string;
  readonly expiration: { readonly month: string; readonly year: string } | null;
  /** The user's default card: picked first when they approve a payment or make a spending limit. */
  readonly isDefault?: boolean;
  /** The name the user gave it in Menta, when they did. */
  readonly name?: string | null;
  /**
   * `encrypted` once the card network's check failed on one of its spending
   * limits: it pays with the encrypted card from then on, never opening the
   * check again. Null: its approvals run the network's check.
   */
  readonly setup?: "network" | "encrypted" | null;
}

export interface PreparedCards {
  /** The user's saved cards, default first; null when Crossmint couldn't list them. */
  readonly cards: readonly SavedCard[] | null;
  readonly registered: readonly string[];
  readonly failed: readonly string[];
}

const part = z.union([z.string(), z.number()]).transform(String);
const cardList = z.object({
  data: z.array(
    z.object({
      paymentMethodId: z.string(),
      type: z.string(),
      default: z.boolean().optional(),
      card: z
        .object({
          brand: z.string(),
          last4: z.string(),
          expiration: z.object({ month: part, year: part }).nullish(),
        })
        .optional(),
    }),
  ),
});
const errorCode = z.object({ code: z.string() });

/**
 * Lists the user's saved cards for our card list, and enrolls each one for
 * agent payments ("order-intent registration") with their email so the first
 * Approve works: Crossmint can't enroll a card without an email, and doesn't
 * know it for users who sign in through Stytch. Runs on our server because
 * Crossmint's list route doesn't answer browsers. Registration is idempotent:
 * an enrolled card comes back as it is. Never throws; logs only payment method
 * IDs and status codes.
 */
export async function prepareCardsForOrderIntents(
  options: PrepareCardsOptions,
): Promise<PreparedCards> {
  const email = options.email?.trim();
  const send = options.fetch ?? fetch;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 4000);
  const base = `${
    options.apiKey.startsWith("ck_staging")
      ? "https://staging.crossmint.com"
      : "https://www.crossmint.com"
  }/api`;
  const headers = {
    "x-api-key": options.apiKey,
    authorization: `Bearer ${options.jwt}`,
    origin: options.origin,
  };

  let cards: SavedCard[];
  try {
    const response = await send(
      `${base}/2026-09-16/payment-methods?type=card&limit=100`,
      { headers, signal },
    );
    if (!response.ok) {
      console.warn(`Couldn't list cards (${response.status}).`);
      return { cards: null, registered: [], failed: [] };
    }
    cards = cardList
      .parse(await response.json())
      .data.sort((a, b) => Number(b.default ?? 0) - Number(a.default ?? 0))
      .flatMap(({ paymentMethodId, type, card, default: isDefault }) =>
        type === "card" && card
          ? [
              {
                paymentMethodId,
                brand: card.brand.toLowerCase(),
                last4: card.last4.slice(-4),
                expiration: card.expiration ?? null,
                isDefault: isDefault === true,
              },
            ]
          : [],
      );
  } catch (error) {
    console.warn(`Couldn't list cards (${reason(error)}).`);
    return { cards: null, registered: [], failed: [] };
  }
  if (!email) {
    return { cards, registered: [], failed: [] };
  }

  const results = await Promise.all(
    cards.map(async ({ paymentMethodId: id }) => {
      try {
        const response = await send(
          `${base}/unstable/payment-methods/${encodeURIComponent(id)}/order-intent-registration`,
          {
            method: "PUT",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ email }),
            signal,
          },
        );
        if (response.ok) {
          return { id, ok: true };
        }
        const code = errorCode.safeParse(await response.json().catch(() => 0));
        console.warn(
          `Couldn't enroll card ${id} (${response.status}${code.success ? ` ${code.data.code}` : ""}).`,
        );
      } catch (error) {
        console.warn(`Couldn't enroll card ${id} (${reason(error)}).`);
      }
      return { id, ok: false };
    }),
  );
  return {
    cards,
    registered: results.filter((item) => item.ok).map((item) => item.id),
    failed: results.filter((item) => !item.ok).map((item) => item.id),
  };
}

/**
 * Removes one of the user's saved cards. Crossmint resolves the user from the
 * JWT, so a card that isn't theirs is simply not found. Logs only the
 * payment method ID and status code.
 */
export async function removeCard(
  options: Omit<PrepareCardsOptions, "email" | "timeoutMs"> & {
    readonly paymentMethodId: string;
  },
): Promise<boolean> {
  const send = options.fetch ?? fetch;
  const base = options.apiKey.startsWith("ck_staging")
    ? "https://staging.crossmint.com"
    : "https://www.crossmint.com";
  try {
    const response = await send(
      `${base}/api/2026-09-16/payment-methods/${encodeURIComponent(options.paymentMethodId)}`,
      {
        method: "DELETE",
        headers: {
          "x-api-key": options.apiKey,
          authorization: `Bearer ${options.jwt}`,
          origin: options.origin,
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      console.warn(
        `Couldn't remove card ${options.paymentMethodId} (${response.status}).`,
      );
    }
    return response.ok;
  } catch (error) {
    console.warn(
      `Couldn't remove card ${options.paymentMethodId} (${reason(error)}).`,
    );
    return false;
  }
}

/**
 * Makes one of the user's saved cards their default (Crossmint unsets the
 * previous one), so it comes first wherever they pick a card. Logs only the
 * payment method ID and status code.
 */
export async function setDefaultCard(
  options: Omit<PrepareCardsOptions, "email" | "timeoutMs"> & {
    readonly paymentMethodId: string;
  },
): Promise<boolean> {
  const send = options.fetch ?? fetch;
  const base = options.apiKey.startsWith("ck_staging")
    ? "https://staging.crossmint.com"
    : "https://www.crossmint.com";
  try {
    const response = await send(
      `${base}/api/2026-09-16/payment-methods/${encodeURIComponent(options.paymentMethodId)}`,
      {
        method: "PATCH",
        headers: {
          "x-api-key": options.apiKey,
          authorization: `Bearer ${options.jwt}`,
          origin: options.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ default: true }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      console.warn(
        `Couldn't make card ${options.paymentMethodId} the default (${response.status}).`,
      );
    }
    return response.ok;
  } catch (error) {
    console.warn(
      `Couldn't make card ${options.paymentMethodId} the default (${reason(error)}).`,
    );
    return false;
  }
}

/** A failure's kind, never its message (which could echo a request). */
function reason(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") {
    return "timed out";
  }
  return error instanceof z.ZodError ? "unexpected response" : "network error";
}

import { z } from "zod";

/**
 * The user's order intents: what Crossmint creates each time they approve a
 * payment, clearing their card for one store and amount. Read with Crossmint's
 * client key and the user's JWT (Crossmint resolves the user from it), like
 * the card list. Never throws; logs only IDs and status codes.
 */

export interface OrderIntentsOptions {
  /** Crossmint client key. */
  readonly apiKey: string;
  /** The user's Stytch session JWT. */
  readonly jwt: string;
  /** Our web origin. Client keys only answer origins they allow. */
  readonly origin: string;
  readonly fetch?: typeof fetch;
}

/** What Wallet shows of an approval: no card data, credentials or verification config. */
export interface OrderIntentView {
  readonly orderIntentId: string;
  readonly paymentMethodId: string;
  readonly description: string;
  readonly merchant: {
    readonly name: string | null;
    readonly url: string | null;
    readonly countryCode: string | null;
  } | null;
  readonly amount: {
    readonly total: string;
    readonly spent: string;
    readonly available: string;
    readonly currency: string;
  };
  readonly status: "active" | "cancelled" | "expired";
  readonly expiresAt: string;
  /**
   * Whether its card can pay now: a rail that gives a card credential is
   * active, or it has no network rail (the encrypted card, used inside
   * Crossmint). False while a rail waits on a check or a CVC.
   */
  readonly cardReady: boolean;
}

const rail = z.object({
  status: z.string(),
  credentialFormats: z.array(z.string()).catch([]),
});

const intent = z.object({
  orderIntentId: z.string(),
  paymentMethodId: z.string(),
  description: z.string().catch(""),
  merchant: z
    .object({
      name: z.string().nullish(),
      url: z.string().nullish(),
      countryCode: z.string().nullish(),
    })
    .nullish(),
  amount: z.object({
    total: z.string(),
    spent: z.string(),
    available: z.string(),
    currency: z.string(),
  }),
  status: z.enum(["active", "cancelled", "expired"]),
  expiresAt: z.string(),
  rails: z.array(rail).catch([]),
});

function cardReady(rails: readonly z.infer<typeof rail>[]) {
  const card = rails.filter((item) => item.credentialFormats.includes("card"));
  return card.length === 0 || card.some((item) => item.status === "active");
}

function base(apiKey: string) {
  return apiKey.startsWith("ck_staging")
    ? "https://staging.crossmint.com"
    : "https://www.crossmint.com";
}

function headers(options: OrderIntentsOptions) {
  return {
    "x-api-key": options.apiKey,
    authorization: `Bearer ${options.jwt}`,
    origin: options.origin,
  };
}

/**
 * The user's approvals, active ones first, each group by latest expiry;
 * null when Crossmint couldn't list them. Crossmint returns no creation time,
 * and approvals can have different lifetimes, so expiry alone isn't age: the
 * ones that can still be charged lead instead.
 */
export async function listOrderIntents(
  options: OrderIntentsOptions,
): Promise<OrderIntentView[] | null> {
  const send = options.fetch ?? fetch;
  try {
    const response = await send(
      `${base(options.apiKey)}/api/unstable/order-intents`,
      { headers: headers(options), signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) {
      console.warn(`Couldn't list order intents (${response.status}).`);
      return null;
    }
    const body: unknown = await response.json();
    // Unknown shapes (a new rail, a new status) skip that one approval, not the list.
    return (Array.isArray(body) ? body : [])
      .flatMap((item) => {
        const parsed = intent.safeParse(item);
        if (!parsed.success) {
          return [];
        }
        const { merchant, rails, ...rest } = parsed.data;
        return [
          {
            ...rest,
            cardReady: cardReady(rails),
            merchant: merchant
              ? {
                  name: merchant.name ?? null,
                  url: merchant.url ?? null,
                  countryCode: merchant.countryCode ?? null,
                }
              : null,
          },
        ];
      })
      .sort(
        (a, b) =>
          Number(b.status === "active") - Number(a.status === "active") ||
          Date.parse(b.expiresAt) - Date.parse(a.expiresAt),
      );
  } catch (error) {
    console.warn(`Couldn't list order intents (${reason(error)}).`);
    return null;
  }
}

/** Cancels one of the user's active approvals, so nothing more can be charged on it. */
export async function cancelOrderIntent(
  options: OrderIntentsOptions & { readonly orderIntentId: string },
): Promise<boolean> {
  const send = options.fetch ?? fetch;
  try {
    const response = await send(
      `${base(options.apiKey)}/api/unstable/order-intents/${encodeURIComponent(options.orderIntentId)}`,
      {
        method: "DELETE",
        headers: headers(options),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      console.warn(
        `Couldn't cancel order intent ${options.orderIntentId} (${response.status}).`,
      );
    }
    return response.ok;
  } catch (error) {
    console.warn(
      `Couldn't cancel order intent ${options.orderIntentId} (${reason(error)}).`,
    );
    return false;
  }
}

/** A failure's kind, never its message (which could echo a request). */
function reason(error: unknown) {
  return error instanceof Error && error.name === "TimeoutError"
    ? "timed out"
    : "network error";
}

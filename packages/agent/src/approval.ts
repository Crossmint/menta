/**
 * Approving a payment with a saved card: the core behind our own card list in
 * the web dock, the secure page and the ChatGPT/Claude card. It mirrors what
 * Crossmint's `CrossmintAgentCardAuthorization` does after a card is picked
 * (create the order intent, pick its card rail, then verify or re-collect the
 * CVC when the rail asks), so the list and the button can be ours. Card
 * numbers and CVCs stay in Crossmint's frames; this only sees IDs.
 *
 * `approve` is the only way in, and each surface calls it from the user's
 * click on Approve; `onAuthorized` fires only once Crossmint reports the
 * card's rail active.
 */
import {
  type AgentCardRail,
  type CrossmintPaymentMethod,
  createOrderIntentsApi,
  findCardRail,
  type OrderIntent,
  OrderIntentsApiError,
  type OrderIntentWithVerification,
  selectCardRail,
  toAgentCardRail,
} from "@crossmint/client-sdk-base";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SavedCard } from "./cards.js";

export type { SavedCard } from "./cards.js";

export interface PaymentRequest {
  readonly amount: { readonly value: string; readonly currency: string };
  /** Where it can be spent; an approval made in Wallet may leave it open. */
  readonly merchant?: {
    readonly name: string;
    readonly url: string;
    readonly countryCode: string;
  };
  readonly description: string;
  readonly expiresAt?: string;
}

export type ApprovalApi = Pick<
  ReturnType<typeof createOrderIntentsApi>,
  "createOrderIntent" | "getOrderIntent" | "register"
>;

export type Outcome =
  | { readonly kind: "done"; readonly orderIntentId: string }
  | {
      readonly kind: "verify";
      readonly orderIntent: OrderIntentWithVerification;
      readonly rail: AgentCardRail;
    }
  | {
      readonly kind: "cvc";
      readonly orderIntentId: string;
      readonly rail: AgentCardRail;
    }
  | { readonly kind: "failed"; readonly message: string };

export const approvalMessages = {
  noRail: "This card can't be used for agent payments yet. Try another card.",
  storeRefused: {
    vic: "Visa didn't accept this store for agent payments. Try another card.",
    agentpay:
      "Mastercard didn't accept this store for agent payments. Try another card.",
  },
  expired: "This approval expired. Ask your assistant to try again.",
  create: "Couldn't start the payment with this card. Try again.",
  register: "Couldn't set up this card for agent payments. Try again.",
  check: "The card check didn't go through. Try again or use another card.",
  slow: "Your card hasn't confirmed yet. Try again in a moment.",
  notRevoked:
    "Couldn't cancel this spending limit. Revoke it in Spending limits on Menta.",
} as const;

const DAY = 24 * 60 * 60 * 1000;

function failed(message: string): Outcome {
  return { kind: "failed", message };
}

function stale(intent: OrderIntent) {
  const expires = Date.parse(intent.expiresAt);
  return (
    intent.status !== "active" ||
    (Number.isFinite(expires) && expires <= Date.now())
  );
}

/**
 * The card network that turned down this merchant, when that is why no rail
 * is usable: its agentic-token rail failed to get an allowance (seen for a
 * store the network doesn't know). The card itself is fine elsewhere.
 */
function storeRefused(intent: OrderIntent) {
  for (const rail of intent.rails) {
    if (
      rail.rail === "agentic-token" &&
      rail.status === "error" &&
      rail.error.code === "PROVIDER_ALLOWANCE_FAILED"
    ) {
      return approvalMessages.storeRefused[rail.provider];
    }
  }
  return null;
}

/** What the user still has to do for an order intent, by its card rail (Crossmint's own policy). */
export function settle(
  intent: OrderIntent,
  { encryptedOnly = false }: { encryptedOnly?: boolean } = {},
): Outcome {
  if (stale(intent)) {
    return failed(approvalMessages.expired);
  }
  const rail = selectCardRail(intent.rails, {
    canVerify: intent.verificationConfig != null && !encryptedOnly,
  });
  // A card that pays with the encrypted card only never opens the network's
  // check: Agent Checkouts uses the encrypted card even where our reads don't
  // list its rail. Not when they list it failed: then nothing can pay.
  if (encryptedOnly && !rail) {
    return intent.rails.some(
      (listed) => listed.rail === "encrypted-card" && listed.status === "error",
    )
      ? failed(storeRefused(intent) ?? approvalMessages.noRail)
      : { kind: "done", orderIntentId: intent.orderIntentId };
  }
  if (!rail) {
    return failed(storeRefused(intent) ?? approvalMessages.noRail);
  }
  if (rail.status === "active") {
    return { kind: "done", orderIntentId: intent.orderIntentId };
  }
  if (rail.status === "pending_verification") {
    return intent.verificationConfig
      ? { kind: "verify", orderIntent: intent, rail: toAgentCardRail(rail) }
      : failed(approvalMessages.noRail);
  }
  if (rail.status === "pending_cvc_recollection") {
    return {
      kind: "cvc",
      orderIntentId: intent.orderIntentId,
      rail: toAgentCardRail(rail),
    };
  }
  return failed(approvalMessages.noRail);
}

function apiError(error: unknown, status: number, pattern: RegExp) {
  return (
    error instanceof OrderIntentsApiError &&
    error.status === status &&
    pattern.test(error.message)
  );
}

/**
 * Creates the order intent for a card (or re-reads one made for it earlier) and
 * settles it. A card Crossmint hasn't enrolled is enrolled with the buyer's
 * email and tried once more.
 */
export async function startApproval(
  api: ApprovalApi,
  options: {
    readonly paymentMethodId: string;
    readonly request: PaymentRequest;
    readonly email: string | null;
    /** An order intent this card already has for this request. */
    readonly existing?: string | null;
    /** The card pays with the encrypted card only: no network check. */
    readonly encryptedOnly?: boolean;
  },
): Promise<Outcome> {
  const { paymentMethodId, request, email, existing } = options;
  const check = { encryptedOnly: options.encryptedOnly === true };
  if (existing) {
    try {
      const intent = await api.getOrderIntent(existing);
      if (!stale(intent)) {
        return settle(intent, check);
      }
    } catch {
      // Make a new one.
    }
  }
  const create = () =>
    api.createOrderIntent({
      paymentMethodId,
      amount: request.amount,
      merchant: request.merchant,
      description: request.description,
      expiresAt: request.expiresAt ?? new Date(Date.now() + DAY).toISOString(),
    });
  try {
    return settle(await create(), check);
  } catch (error) {
    if (apiError(error, 400, /no active order-intent rails/i)) {
      return failed(approvalMessages.noRail);
    }
    if (!apiError(error, 404, /order-intent registration/i) || !email) {
      return failed(approvalMessages.create);
    }
  }
  try {
    await api.register(paymentMethodId, { email });
  } catch {
    return failed(approvalMessages.register);
  }
  try {
    return settle(await create(), check);
  } catch (error) {
    return failed(
      apiError(error, 400, /no active order-intent rails/i)
        ? approvalMessages.noRail
        : approvalMessages.create,
    );
  }
}

/**
 * After a verification or a new CVC, re-reads the order intent until its rail
 * is active (Crossmint's SDK polls every 2s for up to 60s). A card network
 * rail (Visa, Mastercard) that fails or never turns active isn't the end:
 * the order intent then pays with the encrypted card, which Agent Checkouts
 * uses with no verification: it's done, after the encrypted card's own CVC
 * when it lists one, and failed when it lists that card failed too.
 */
export async function confirmRail(
  api: ApprovalApi,
  orderIntentId: string,
  rail: AgentCardRail,
  {
    attempts = 30,
    sleep = (ms: number) => new Promise((done) => setTimeout(done, ms)),
    signal,
  }: {
    attempts?: number;
    sleep?: (ms: number) => Promise<unknown>;
    signal?: AbortSignal;
  } = {},
): Promise<Outcome> {
  /** The last read, for the encrypted card's own step (its CVC) when the network's rail gives out. */
  let last: OrderIntent | null = null;
  for (let attempt = 0; attempt < attempts && !signal?.aborted; attempt++) {
    if (attempt > 0) {
      await sleep(2000);
    }
    let intent: OrderIntent;
    try {
      intent = await api.getOrderIntent(orderIntentId);
    } catch (error) {
      const passing =
        !(error instanceof OrderIntentsApiError) ||
        error.status == null ||
        error.status >= 500;
      if (passing) {
        continue;
      }
      return failed(approvalMessages.check);
    }
    if (stale(intent)) {
      return failed(approvalMessages.expired);
    }
    last = intent;
    const found = findCardRail(intent.rails, rail);
    if (!found || found.status === "error") {
      return rail.rail === "agentic-token"
        ? settle(intent, { encryptedOnly: true })
        : failed(approvalMessages.check);
    }
    if (found.status === "active") {
      return { kind: "done", orderIntentId };
    }
  }
  if (rail.rail === "agentic-token" && !signal?.aborted) {
    return last
      ? settle(last, { encryptedOnly: true })
      : { kind: "done", orderIntentId };
  }
  return failed(approvalMessages.slow);
}

/**
 * The card network's check was closed by the user (Cancel, Escape, closing
 * its window), not failed: Visa's verification library names these errors.
 */
export function closedByUser(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "VerificationCancelledError" ||
      error.name === "PopupClosedError")
  );
}

/** Revokes a spending limit the user backed out of, so nothing can pay from it. */
export function revokeOrderIntent(
  apiKey: string,
  jwt: string,
  orderIntentId: string,
) {
  const base = apiKey.startsWith("ck_staging")
    ? "https://staging.crossmint.com"
    : "https://www.crossmint.com";
  return fetch(
    `${base}/api/unstable/order-intents/${encodeURIComponent(orderIntentId)}`,
    {
      method: "DELETE",
      headers: { "x-api-key": apiKey, authorization: `Bearer ${jwt}` },
      // The card list waits on this: a stalled request counts as not revoked.
      signal: AbortSignal.timeout(8000),
    },
  ).then(
    (response) => response.ok,
    () => false,
  );
}

/**
 * Crossmint's order-intent routes, called with the client key and the user's
 * JWT.
 */
export function orderIntentsApi(apiKey: string, jwt: string): ApprovalApi {
  const base = apiKey.startsWith("ck_staging")
    ? "https://staging.crossmint.com"
    : "https://www.crossmint.com";
  const send =
    (method: string) =>
    (path: string, init: Omit<RequestInit, "method"> = {}) =>
      fetch(`${base}${path}`, {
        ...init,
        method,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          "x-api-key": apiKey,
          authorization: `Bearer ${jwt}`,
        },
      });
  // createOrderIntentsApi only calls get/post/put(path, init) and reads the
  // Response; Crossmint's full API client would bring a second copy of its base SDK.
  const apiClient = {
    get: send("GET"),
    post: send("POST"),
    put: send("PUT"),
  } as unknown as Parameters<typeof createOrderIntentsApi>[0]["apiClient"];
  return createOrderIntentsApi({ apiClient });
}

export type ApprovalStep =
  /** Picking a card; `error` is why the last try didn't go through. */
  | { readonly kind: "select"; readonly error?: string }
  /** Creating the order intent. */
  | { readonly kind: "working" }
  /** Render Crossmint's `OrderIntentVerification` for `orderIntent`. */
  | {
      readonly kind: "verify";
      readonly orderIntent: OrderIntentWithVerification;
    }
  /** Render Crossmint's `CrossmintCvcRecollection` for the selected card. */
  | { readonly kind: "cvc" }
  /** Waiting for the rail to turn active after a check. */
  | { readonly kind: "confirming" }
  | { readonly kind: "done" };

export interface CardApprovalOptions {
  readonly apiKey: string;
  readonly jwt: string;
  readonly email: string | null;
  /** The saved cards to start with (null: they couldn't be listed). */
  readonly cards: readonly SavedCard[] | null;
  readonly request: PaymentRequest;
  readonly onAuthorized: (orderIntentId: string) => void;
  /** The card network's check failed for this card: remember it pays with the encrypted card only. */
  readonly onEncryptedOnly?: (paymentMethodId: string) => void;
}

/** Which order intent a retry may reuse: the same card for the same request. */
function intentKey(paymentMethodId: string, request: PaymentRequest) {
  return `${paymentMethodId}\0${JSON.stringify(request)}`;
}

/**
 * Our card list and the approval flow as React state: the cards, the selected
 * one (the first, or a card just added), whether the add-card form is open
 * (always, with no saved cards) and the step. Surfaces draw their own markup.
 */
export function useCardApproval(options: CardApprovalOptions) {
  const { apiKey, jwt, email } = options;
  const api = useMemo(() => orderIntentsApi(apiKey, jwt), [apiKey, jwt]);
  const [cards, setCards] = useState<readonly SavedCard[]>(
    () => options.cards ?? [],
  );
  const [selectedId, select] = useState(
    () => options.cards?.[0]?.paymentMethodId ?? null,
  );
  const [adding, setAdding] = useState(() => !options.cards?.length);
  const [step, setStep] = useState<ApprovalStep>({ kind: "select" });
  const latest = useRef(options);
  latest.current = options;
  const current = useRef(step);
  current.current = step;
  /**
   * Order intents already made for a card and request, so a retry doesn't
   * make another; a changed request (an edited amount or date) makes its own.
   */
  const intents = useRef(new Map<string, string>());
  const check = useRef<{ orderIntentId: string; rail: AgentCardRail } | null>(
    null,
  );
  const run = useRef<AbortController | null>(null);
  useEffect(() => () => run.current?.abort(), []);

  const move = useCallback((next: ApprovalStep) => {
    current.current = next;
    setStep(next);
  }, []);
  const restart = useCallback(() => {
    run.current?.abort();
    run.current = new AbortController();
    return run.current.signal;
  }, []);

  const apply = useCallback(
    (outcome: Outcome, paymentMethodId: string, signal: AbortSignal) => {
      if (signal.aborted) {
        return;
      }
      if (outcome.kind === "failed") {
        move({ kind: "select", error: outcome.message });
        return;
      }
      if (outcome.kind === "done") {
        move({ kind: "done" });
        latest.current.onAuthorized(outcome.orderIntentId);
        return;
      }
      const orderIntentId =
        outcome.kind === "verify"
          ? outcome.orderIntent.orderIntentId
          : outcome.orderIntentId;
      intents.current.set(
        intentKey(paymentMethodId, latest.current.request),
        orderIntentId,
      );
      check.current = { orderIntentId, rail: outcome.rail };
      move(
        outcome.kind === "verify"
          ? { kind: "verify", orderIntent: outcome.orderIntent }
          : { kind: "cvc" },
      );
    },
    [move],
  );

  /** Call only from the user's click on Approve. */
  const approve = useCallback(() => {
    const paymentMethodId = selectedId;
    if (current.current.kind !== "select" || !paymentMethodId) {
      return;
    }
    const signal = restart();
    move({ kind: "working" });
    void startApproval(api, {
      paymentMethodId,
      request: latest.current.request,
      email,
      existing:
        intents.current.get(
          intentKey(paymentMethodId, latest.current.request),
        ) ?? null,
      encryptedOnly: cards.some(
        (card) =>
          card.paymentMethodId === paymentMethodId &&
          card.setup === "encrypted",
      ),
    }).then((outcome) => apply(outcome, paymentMethodId, signal));
  }, [api, apply, cards, email, move, restart, selectedId]);

  /** Crossmint's verification or CVC form finished: wait for the rail to turn active. */
  const checked = useCallback(() => {
    const pending = check.current;
    const paymentMethodId = selectedId;
    const kind = current.current.kind;
    if ((kind !== "verify" && kind !== "cvc") || !pending || !paymentMethodId) {
      return;
    }
    const signal = restart();
    move({ kind: "confirming" });
    void confirmRail(api, pending.orderIntentId, pending.rail, {
      signal,
    }).then((outcome) => apply(outcome, paymentMethodId, signal));
  }, [api, apply, move, restart, selectedId]);

  /**
   * The card network's check ended without passing. Closed by the user: they
   * backed out, so the spending limit is revoked (nothing can pay from it,
   * their assistant included) and they're back at the card list. Failed: the order
   * intent still pays with the encrypted card (Crossmint's fallback for a
   * card with no usable network rail), so the approval goes through instead
   * of failing, after the encrypted card's own step (its CVC) when it lists
   * one, and the card skips the check from now on.
   */
  const unverified = useCallback(
    (error?: unknown) => {
      const pending = check.current;
      const paymentMethodId = selectedId;
      if (current.current.kind !== "verify" || !pending || !paymentMethodId) {
        return;
      }
      const signal = restart();
      if (closedByUser(error)) {
        check.current = null;
        const key = intentKey(paymentMethodId, latest.current.request);
        // Until it's revoked, an assistant could still pay from it: try twice,
        // and say so if it's still there. Still there, Approve picks it up
        // again instead of making a second one.
        move({ kind: "confirming" });
        void revokeOrderIntent(apiKey, jwt, pending.orderIntentId)
          .then(
            (revoked) =>
              revoked || revokeOrderIntent(apiKey, jwt, pending.orderIntentId),
          )
          .then((revoked) => {
            if (revoked) {
              intents.current.delete(key);
            }
            if (!signal.aborted) {
              move(
                revoked
                  ? { kind: "select" }
                  : { kind: "select", error: approvalMessages.notRevoked },
              );
            }
          });
        return;
      }
      move({ kind: "confirming" });
      // This card skips the check from now on: here, and (saved) everywhere else.
      setCards((list) =>
        list.map((card) =>
          card.paymentMethodId === paymentMethodId
            ? { ...card, setup: "encrypted" }
            : card,
        ),
      );
      latest.current.onEncryptedOnly?.(paymentMethodId);
      void api
        .getOrderIntent(pending.orderIntentId)
        .then((intent) => settle(intent, { encryptedOnly: true }))
        .catch(
          (): Outcome => ({
            kind: "done",
            orderIntentId: pending.orderIntentId,
          }),
        )
        .then((outcome) => apply(outcome, paymentMethodId, signal));
    },
    [api, apiKey, apply, jwt, move, restart, selectedId],
  );

  /** Back to the list, with an error line when there is one. */
  const reset = useCallback(
    (error?: string) => {
      restart();
      move(error ? { kind: "select", error } : { kind: "select" });
    },
    [move, restart],
  );

  /** Crossmint's add-card form saved a card: enroll it, list it first and select it. */
  const added = useCallback(
    async (paymentMethod: CrossmintPaymentMethod) => {
      const card = savedCard(paymentMethod);
      if (!card) {
        return;
      }
      if (email) {
        // Approve enrolls it again if this fails.
        await api.register(card.paymentMethodId, { email }).catch(() => null);
      }
      setCards((list) => [
        card,
        ...list.filter((item) => item.paymentMethodId !== card.paymentMethodId),
      ]);
      select(card.paymentMethodId);
      setAdding(false);
      move({ kind: "select" });
    },
    [api, email, move],
  );

  const busy = step.kind !== "select";
  return {
    cards,
    selected: cards.find((card) => card.paymentMethodId === selectedId),
    select: (paymentMethodId: string) => {
      if (!busy) {
        select(paymentMethodId);
      }
    },
    adding,
    /** Opens or closes the add-card form; it can't close with no saved cards. */
    setAdding: (open: boolean) => {
      if (!busy) {
        setAdding(open || cards.length === 0);
      }
    },
    added,
    step,
    busy,
    approve,
    checked,
    unverified,
    reset,
  };
}

// ---------------------------------------------------------------------------
// Display helpers shared by every card list.

/** "Expires 08/29", or null when Crossmint didn't say. */
export function cardExpiry(card: SavedCard) {
  const { month, year } = card.expiration ?? {};
  return month && year
    ? `Expires ${month.padStart(2, "0")}/${year.slice(-2)}`
    : null;
}

/** Where the security code is printed, for the CVC step. */
export function cvcHint(card: SavedCard | undefined) {
  return card?.brand === "amex" || card?.brand === "american-express"
    ? "Enter the 4-digit code on the front of your card."
    : "Enter the 3-digit code on the back of your card.";
}

/** A card Crossmint's add-card form just saved, as our list shows it (never its token). */
export function savedCard(
  paymentMethod: CrossmintPaymentMethod,
): SavedCard | null {
  if (paymentMethod.type !== "card") {
    return null;
  }
  const { brand, last4, expiration } = paymentMethod.card;
  return {
    paymentMethodId: paymentMethod.paymentMethodId,
    brand: brand.toLowerCase(),
    last4: last4.slice(-4),
    expiration: expiration
      ? { month: expiration.month, year: expiration.year }
      : null,
  };
}
export { cardBrandArt, cardBrandName, cardLabel } from "./card-brands.js";

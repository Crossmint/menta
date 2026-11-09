import { neon } from "@neondatabase/serverless";
import { requireEnv } from "./env.js";

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * How a saved card pays for spending limits. Approvals save `encrypted` when
 * the card network's check fails on one, so the card never opens it again
 * and pays with the encrypted card. `network` is kept for a passed check.
 */
export type CardSetup = "network" | "encrypted";

/** Each card's setup, by payment method; no entry means not set up yet. Crossmint has no field for it. */
export interface CardSetups {
  of(userId: string): Promise<Map<string, CardSetup>>;
  set(userId: string, paymentMethodId: string, setup: CardSetup): Promise<void>;
}

export function createSqlCardSetups(query: Query): CardSetups {
  return {
    async of(userId) {
      const rows = await query(
        "SELECT payment_method_id, status FROM card_setup WHERE user_id = $1",
        [userId],
      );
      return new Map(
        rows.flatMap((row) =>
          row.status === "network" || row.status === "encrypted"
            ? [
                [
                  String(row.payment_method_id),
                  row.status as CardSetup,
                ] as const,
              ]
            : [],
        ),
      );
    },
    async set(userId, paymentMethodId, setup) {
      await query(
        `INSERT INTO card_setup (user_id, payment_method_id, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, payment_method_id) DO UPDATE
         SET status = EXCLUDED.status, updated_at = now()`,
        [userId, paymentMethodId, setup],
      );
    },
  };
}

let setups: CardSetups | undefined;
/** Created on first use, so DATABASE_URL is read only when cards are. */
export function getCardSetups() {
  if (!setups) {
    const sql = neon(requireEnv("DATABASE_URL"));
    setups = createSqlCardSetups(
      (text, parameters) =>
        sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
    );
  }
  return setups;
}

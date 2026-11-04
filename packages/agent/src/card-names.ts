import { neon } from "@neondatabase/serverless";
import { requireEnv } from "./env.js";

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * The names users give their saved cards, by payment method. Crossmint keeps
 * the cards and has no name field for them; no row means no name.
 */
export interface CardNames {
  /** This user's names, by payment method ID. */
  of(userId: string): Promise<Map<string, string>>;
  /** Names a card, or clears its name with null. */
  set(
    userId: string,
    paymentMethodId: string,
    name: string | null,
  ): Promise<void>;
}

export function createSqlCardNames(query: Query): CardNames {
  return {
    async of(userId) {
      const rows = await query(
        "SELECT payment_method_id, name FROM card_names WHERE user_id = $1",
        [userId],
      );
      return new Map(
        rows.map((row) => [String(row.payment_method_id), String(row.name)]),
      );
    },
    async set(userId, paymentMethodId, name) {
      if (name === null) {
        await query(
          "DELETE FROM card_names WHERE user_id = $1 AND payment_method_id = $2",
          [userId, paymentMethodId],
        );
        return;
      }
      await query(
        `INSERT INTO card_names (user_id, payment_method_id, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, payment_method_id) DO UPDATE
         SET name = EXCLUDED.name, updated_at = now()`,
        [userId, paymentMethodId, name],
      );
    },
  };
}

let names: CardNames | undefined;
/** Created on first use, so DATABASE_URL is read only when cards are. */
export function getCardNames() {
  if (!names) {
    const sql = neon(requireEnv("DATABASE_URL"));
    names = createSqlCardNames(
      (text, parameters) =>
        sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
    );
  }
  return names;
}

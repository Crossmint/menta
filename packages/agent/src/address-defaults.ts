import { neon } from "@neondatabase/serverless";
import type { AddressDefaults } from "@oca/crossmint-agent-checkouts/checkouts";

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * Each user's default address (a Crossmint buyer profile ID), keyed by the
 * Stytch user ID. Crossmint keeps the addresses; this is only the choice, and
 * no row means no default.
 */
export function createSqlAddressDefaults(query: Query): AddressDefaults {
  return {
    async get(userId) {
      const [row] = await query(
        "SELECT buyer_profile_id FROM default_addresses WHERE user_id = $1",
        [userId],
      );
      return row ? String(row.buyer_profile_id) : null;
    },
    async set(userId, buyerProfileId) {
      if (buyerProfileId === null) {
        await query("DELETE FROM default_addresses WHERE user_id = $1", [
          userId,
        ]);
        return;
      }
      await query(
        `INSERT INTO default_addresses (user_id, buyer_profile_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
         SET buyer_profile_id = EXCLUDED.buyer_profile_id, updated_at = now()`,
        [userId, buyerProfileId],
      );
    },
  };
}

export function createNeonAddressDefaults(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return createSqlAddressDefaults(
    (text, parameters) =>
      sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
  );
}

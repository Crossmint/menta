import { neon } from "@neondatabase/serverless";
import { requireEnv } from "./env.js";

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/** Whose rows to delete: the Stytch user ID, and the principal web sessions are owned by. */
export interface ForgottenUser {
  readonly id: string;
  readonly principal: { readonly issuer: string; readonly subject: string };
}

/**
 * Every table in migrations/ that holds a row per user. `web_push_deliveries`
 * cascades from its subscription; `mcp_clients` is per OAuth client, not user.
 */
const byUserId = [
  "default_addresses",
  "mcp_event_subscriptions",
  "grok_bot_offers",
  "grok_bot_routines",
  "user_memories",
  "web_push_subscriptions",
  "checkout_agents",
  "card_names",
  "card_setup",
  "agent_use",
] as const;

/**
 * Deletes every row Menta keeps for the user, for account deletion. Crossmint,
 * Eve and Stytch keep their own data; the caller removes what it can there.
 * Idempotent, so a failed run can simply be retried.
 */
export function createSqlForgetUser(query: Query) {
  return async (user: ForgottenUser) => {
    for (const table of byUserId) {
      await query(`DELETE FROM ${table} WHERE user_id = $1`, [user.id]);
    }
    await query(
      "DELETE FROM web_session_owners WHERE issuer = $1 AND subject = $2",
      [user.principal.issuer, user.principal.subject],
    );
  };
}

let forget: ((user: ForgottenUser) => Promise<void>) | undefined;
/** Created on first use, so DATABASE_URL is read only when an account is deleted. */
export function forgetUser(user: ForgottenUser) {
  if (!forget) {
    const sql = neon(requireEnv("DATABASE_URL"));
    forget = createSqlForgetUser(
      (text, parameters) =>
        sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
    );
  }
  return forget(user);
}

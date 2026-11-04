import { neon } from "@neondatabase/serverless";
import type { Checkouts } from "@oca/crossmint-agent-checkouts/checkouts";
import { notStarted } from "@oca/crossmint-agent-checkouts/checkouts";

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * Which agent started each checkout, by run ID ("Grok Bot", "Menta chat").
 * Crossmint keeps the checkout and has no field for this, so it's the one
 * fact about a run Menta keeps; Transactions shows it. Runs from before it
 * existed have none.
 */
export interface CheckoutAgents {
  record(userId: string, runId: string, agent: string): Promise<void>;
  /** The agent of each of these runs that has one, for this user only. */
  of(userId: string, runIds: readonly string[]): Promise<Map<string, string>>;
}

export function createSqlCheckoutAgents(query: Query): CheckoutAgents {
  return {
    async record(userId, runId, agent) {
      await query(
        `INSERT INTO checkout_agents (run_id, user_id, agent) VALUES ($1, $2, $3)
         ON CONFLICT (run_id) DO NOTHING`,
        [runId, userId, agent.slice(0, 200)],
      );
    },
    async of(userId, runIds) {
      if (runIds.length === 0) {
        return new Map();
      }
      const rows = await query(
        "SELECT run_id, agent FROM checkout_agents WHERE user_id = $1 AND run_id = ANY($2)",
        [userId, [...runIds]],
      );
      return new Map(
        rows.map((row) => [String(row.run_id), String(row.agent)]),
      );
    },
  };
}

export function createNeonCheckoutAgents(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return createSqlCheckoutAgents(
    (text, parameters) =>
      sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
  );
}

let agents: CheckoutAgents | null | undefined;
/** The store, when Neon is configured; built on first use. */
export function getCheckoutAgents(): CheckoutAgents | null {
  if (agents === undefined) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    agents = databaseUrl ? createNeonCheckoutAgents(databaseUrl) : null;
  }
  return agents;
}

/**
 * Checkouts that note which agent started each new run. The name is looked up
 * only once a run starts; a failed note never fails the checkout.
 */
export function attributedCheckouts(
  checkouts: Checkouts,
  agent: () => Promise<string | null>,
  store: CheckoutAgents | null = getCheckoutAgents(),
): Checkouts {
  if (!store) {
    return checkouts;
  }
  return {
    ...checkouts,
    async create(...args: Parameters<Checkouts["create"]>) {
      const started = await checkouts.create(...args);
      if (!notStarted(started)) {
        try {
          const name = await agent();
          if (name) {
            await store.record(args[0], started.runId, name);
          }
        } catch {
          console.warn("Couldn't note which agent started a checkout.");
        }
      }
      return started;
    },
  };
}

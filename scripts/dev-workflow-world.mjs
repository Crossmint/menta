import { spawnSync } from "node:child_process";
import { Client } from "@neondatabase/serverless";

// Session advisory lock naming "the dev server that owns this database's
// Postgres Workflow world".
const OWNER_LOCK = 4_357_001;

/**
 * Chooses eve's Workflow world for `eve dev` and returns the env to start it
 * with. Postgres (the default when DATABASE_URL is set) keeps conversations,
 * including a turn interrupted mid-step, across dev restarts;
 * OCA_DEV_WORKFLOW_WORLD=local keeps eve's file-based world, whose unfinished
 * runs only come back via `eve dev --resume`. packages/agent/agent/agent.ts
 * reads OCA_DEV_WORKFLOW_WORLD when eve compiles the agent. Call `release`
 * when stopping; it ends the connection that holds the Postgres world.
 */
export async function prepareDevWorkflowWorld(baseEnv) {
  const requested =
    baseEnv.OCA_DEV_WORKFLOW_WORLD ??
    (baseEnv.DATABASE_URL ? "postgres" : "local");
  if (requested === "local") {
    return local(baseEnv);
  }
  if (requested !== "postgres") {
    throw new Error("OCA_DEV_WORKFLOW_WORLD must be postgres or local.");
  }
  const env = { ...baseEnv, OCA_DEV_WORKFLOW_WORLD: "postgres" };
  env.WORKFLOW_POSTGRES_URL ??= directUrl(env.DATABASE_URL);
  // Dev-sized queue: the defaults (50 workers, 10 connections) warn and hold
  // more Neon connections than one developer needs.
  env.WORKFLOW_POSTGRES_WORKER_CONCURRENCY ??= "10";
  env.WORKFLOW_POSTGRES_MAX_POOL_SIZE ??= "12";

  // Idempotent: creates or upgrades the world's `workflow`, `workflow_drizzle`
  // and `graphile_worker` schemas, apart from the app's public tables.
  const setup = spawnSync(
    process.execPath,
    ["node_modules/@workflow/world-postgres/bin/setup.js"],
    { cwd: "packages/agent", env, stdio: ["ignore", "ignore", "inherit"] },
  );
  if (setup.status !== 0) {
    throw new Error("Could not set up the Postgres Workflow world.");
  }

  // Every dev server on a database would share one queue and run each
  // other's workflows, so only one may use it. The lock lives as long as this
  // process's connection.
  const client = new Client(env.WORKFLOW_POSTGRES_URL);
  client.on("error", () => {
    console.warn("Lost the Postgres Workflow world lock connection.");
  });
  await client.connect();
  const { rows } = await client.query(
    "select pg_try_advisory_lock($1) as locked",
    [OWNER_LOCK],
  );
  if (!rows[0]?.locked) {
    await client.end();
    console.warn(
      "Another dev server is using the Postgres Workflow world on this database; this one uses eve's local world.",
    );
    return local(baseEnv);
  }
  // Holding the lock means no live worker owns a job, so locks left by a dev
  // server that stopped mid-step are stale. Graphile Worker would otherwise
  // wait four hours before retrying them.
  await client.query(
    "select graphile_worker.force_unlock_workers(array(select distinct locked_by from graphile_worker.jobs where locked_by is not null))",
  );
  return { world: "postgres", env, release: () => client.end() };
}

function local(baseEnv) {
  return {
    world: "local",
    env: { ...baseEnv, OCA_DEV_WORKFLOW_WORLD: "local" },
    release: async () => {},
  };
}

function directUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("Set DATABASE_URL or WORKFLOW_POSTGRES_URL.");
  }
  // Graphile Worker LISTENs and the owner lock is session-scoped; Neon's
  // transaction-mode pooler supports neither, so use the direct endpoint.
  const url = new URL(databaseUrl);
  url.hostname = url.hostname.replace("-pooler.", ".");
  // node-postgres already treats `require` as verify-full and warns about it.
  if (url.searchParams.get("sslmode") === "require") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

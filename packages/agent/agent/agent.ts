import { defineAgent } from "eve";

// Local dev keeps Workflow state in Postgres so conversations survive
// `pnpm dev` restarts. eve evaluates this file when it compiles the agent
// (`eve dev` start and rebuilds, `eve build`) and bakes the selected world
// into the generated runtime, so only the compiling process's environment
// matters. `pnpm dev` (scripts/dev-workflow-world.mjs) sets
// OCA_DEV_WORKFLOW_WORLD=postgres for `eve dev`; nothing sets it for
// `eve build`, and the VERCEL guard keeps Vercel builds on eve's default
// Vercel Workflow world even if the variable leaks there. The world reads
// WORKFLOW_POSTGRES_URL at runtime, which that script also supplies.
const devPostgresWorld =
  process.env.OCA_DEV_WORKFLOW_WORLD === "postgres" && !process.env.VERCEL;

export default defineAgent({
  description:
    "Menta buys things online for the user through Crossmint checkouts. Payments come only from spending limits the user approves on a secure Menta page.",
  // Only the tools a shopping agent needs: its own, plus web_search/web_fetch.
  defaultTools: false,
  model: "anthropic/claude-haiku-5.5",
  modelOptions: {
    providerOptions: {
      anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
    },
  },
  ...(devPostgresWorld
    ? {
        experimental: { workflow: { world: "@workflow/world-postgres" } },
        // pg and graphile-worker load with normal Node resolution, not bundled.
        build: { externalDependencies: ["@workflow/world-postgres"] },
      }
    : {}),
});

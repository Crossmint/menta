import { steer } from "@oca/crossmint-agent-checkouts/tools";
import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { crossmintUserId, getCheckouts } from "../../src/crossmint.js";

// Application override: Eve retains the first observed target across retries.
export default defineWorkflowTool({
  description: steer.description,
  inputSchema: steer.inputSchema,
  label: steer.label,
  async execute(input, ctx) {
    "use workflow";
    const requestId = await readTarget(input.runId, ctx);
    return sendInstruction(input, requestId, ctx);
  },
});

async function readTarget(runId: string, ctx: WorkflowStepToolContext) {
  "use step";
  const user = crossmintUserId(ctx.session.auth.current);
  if (!user) {
    throw new Error("Sign in to use checkouts.");
  }
  const run = await getCheckouts().get(user, runId);
  if (
    run.status !== "queued" &&
    run.status !== "running" &&
    run.status !== "awaiting_input"
  ) {
    throw new Error(
      "That checkout has ended. Start a new one if the user wants to try again.",
    );
  }
  return run.pending?.requestId ?? null;
}

async function sendInstruction(
  input: { runId: string; text: string },
  requestId: string | null,
  ctx: WorkflowStepToolContext,
) {
  "use step";
  const user = crossmintUserId(ctx.session.auth.current);
  if (!user) {
    throw new Error("Sign in to use checkouts.");
  }
  return getCheckouts().steer(
    user,
    input.runId,
    ctx.callId,
    input.text,
    requestId,
  );
}

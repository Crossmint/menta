import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { prepareDevWorkflowWorld } from "./dev-workflow-world.mjs";

const evePort = process.env.EVE_PORT ?? "4357";
const webPort = process.env.PORT ?? "3000";
const children = [];
let stopping = false;
let releaseWorkflowWorld = async () => {};
function stop(code = 0) {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
    }
  }
  releaseWorkflowWorld().catch(() => {});
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop());
}
function run(args, cwd, env = process.env) {
  const child = spawn(
    resolve(cwd, "node_modules/.bin", args[0]),
    args.slice(1),
    { cwd, env, stdio: "inherit", detached: true },
  );
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", (code) => {
    if (!stopping) {
      stop(code ?? 1);
    }
  });
  return child;
}
// Keep conversations going across dev restarts (see dev-workflow-world.mjs).
const workflowWorld = await prepareDevWorkflowWorld(process.env);
releaseWorkflowWorld = workflowWorld.release;
if (stopping) {
  await releaseWorkflowWorld();
  process.exit();
}
run(
  [
    "eve",
    "dev",
    "--no-ui",
    "--no-default-extensions",
    // eve rejects --resume for custom worlds; Postgres re-enqueues on start.
    ...(workflowWorld.world === "local" ? ["--resume"] : []),
    "--host",
    "127.0.0.1",
    "--port",
    evePort,
  ],
  "packages/agent",
  workflowWorld.env,
);
const host = `http://127.0.0.1:${evePort}`;
let ready = false;
for (let attempt = 0; attempt < 1200; attempt++) {
  if (stopping) {
    break;
  }
  try {
    if (
      (
        await fetch(`${host}/eve/v1/health`, {
          signal: AbortSignal.timeout(1000),
        })
      ).ok
    ) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (ready) {
  run(
    ["next", "dev", "--hostname", "127.0.0.1", "--port", webPort],
    "apps/web",
    {
      ...process.env,
      EVE_BASE_URL: host,
      // Pinned Next records query tokens in its internal performance traces.
      // Exclude diagnostic spans as well as suppressing callback console logs.
      // The native OAuth canary case must pass when upgrading Next.
      NEXT_TRACE_SPAN_THRESHOLD_MS: String(Number.MAX_SAFE_INTEGER),
    },
  );
} else {
  console.error("Eve did not become ready within 5 minutes.");
  stop(1);
}

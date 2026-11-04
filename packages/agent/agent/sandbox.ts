import { defineSandbox } from "eve/sandbox";
import { JustBashSandbox } from "eve/sandbox/just-bash";
import { VercelSandbox } from "eve/sandbox/vercel";

// The agent runs no commands; its sandbox only holds the photos users attach
// (eve stores every message attachment there and reads it back on later
// turns). just-bash keeps those files on the local disk, which a Vercel
// function doesn't have, so deployments use Vercel Sandbox with no network.
export const environment = process.env.VERCEL
  ? VercelSandbox.environment()
  : JustBashSandbox.environment({ autoInstall: false });

export default defineSandbox(() =>
  process.env.VERCEL
    ? environment.open({ networkPolicy: "deny-all" })
    : environment.open(),
);

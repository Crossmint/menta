// Regenerates the parts of plugins/menta that come from elsewhere:
// its logo (the icon, apps/web/public/brand/icon.png) and the buy skill
// (the MCP server's own instructions). `pnpm plugin:sync` builds the packages
// first; apps/web/lib/plugin.unit.test.ts fails while they're out of date.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { instructions } from "@oca/agent/mcp";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = resolve(root, "plugins/menta");

// apps/web/lib/plugin.ts is app code (extensionless imports): bundle it in memory.
const bundled = await build({
  entryPoints: [resolve(root, "apps/web/lib/plugin.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { pluginFiles } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const logo = readFileSync(resolve(root, "apps/web/public/brand/icon.png"));
for (const [path, content] of Object.entries(pluginFiles(instructions, logo))) {
  const target = resolve(plugin, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(`wrote plugins/menta/${path}`);
}

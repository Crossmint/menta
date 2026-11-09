// Prints the sign-in code email for every language as JSON
// ({ locale: { subject, html, text } }), to paste into Stytch's custom HTML
// templates (docs/CREDENTIALS.md, "Sign-in code emails").
// Usage: node scripts/code-emails.mjs [origin]  (default http://localhost:3000)
import { build } from "esbuild";

const origin = new URL(process.argv[2] ?? "http://localhost:3000").origin;
const { outputFiles } = await build({
  stdin: {
    contents: `export { codeEmail } from "./apps/web/lib/auth/code-email.ts";
export { LOCALES } from "./apps/web/lib/i18n/locales.ts";`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { codeEmail, LOCALES } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);
const emails = {};
for (const locale of LOCALES) {
  emails[locale] = await codeEmail(locale, origin);
}
console.log(JSON.stringify(emails, null, 2));

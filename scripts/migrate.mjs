import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL (apps/web/.env.local) before migrating.");
}
// Resolved from this file so it also runs from apps/web during the Vercel build.
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const sql = neon(process.env.DATABASE_URL);
for (const file of (await readdir(dir)).sort()) {
  const text = await readFile(`${dir}${file}`, "utf8");
  for (const statement of text.split(";").map((part) => part.trim())) {
    if (statement) {
      await sql.query(statement);
    }
  }
  console.log(`applied ${file}`);
}

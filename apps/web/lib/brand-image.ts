import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** An image in public/ (a brand image from lib/brand.ts, a logo) as a data URI, for `<img>` in ImageResponse. */
export async function brandImage({ src }: { src: string }) {
  const bytes = await readFile(join(process.cwd(), "public", src));
  const type = src.endsWith(".svg") ? "image/svg+xml" : "image/png";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

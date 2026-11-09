import { checkoutCardFonts } from "@oca/agent/mcp";

/**
 * Geist for the ChatGPT/Claude checkout card, which loads it from our origin
 * (a resource domain in the card's CSP). File names carry a content hash, so
 * they are cached for good. Fonts are fetched in CORS mode from the host's
 * sandbox origin, hence `Access-Control-Allow-Origin: *`. Public files, no data.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const font = Object.hasOwn(checkoutCardFonts, file)
    ? checkoutCardFonts[file]
    : undefined;
  if (!font) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(Buffer.from(font, "base64"), {
    headers: {
      "Content-Type": "font/woff2",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

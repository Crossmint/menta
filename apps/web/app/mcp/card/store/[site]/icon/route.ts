import { getStoreBrands, siteOf } from "@oca/agent/mcp";

/**
 * A store's app icon for the checkout card, copied from its own site and
 * served from our origin (a resource domain in the card's CSP). The bytes are
 * the store's, so the response is locked down: a strict CSP and sandbox (an
 * SVG opened directly can't run anything on our origin), no sniffing, and
 * opened directly it downloads instead of rendering (images ignore that).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ site: string }> },
) {
  const site = siteOf(decodeURIComponent((await params).site));
  const icon = site ? (await getStoreBrands()(site)).icon : null;
  if (!icon) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
  }
  return new Response(new Uint8Array(icon.bytes), {
    headers: {
      "Content-Type": icon.type,
      "Cache-Control":
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'attachment; filename="icon"',
    },
  });
}

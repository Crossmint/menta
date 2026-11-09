import { getStoreBrands, siteOf } from "@oca/agent/mcp";

/**
 * A store's name for the ChatGPT/Claude checkout card, read from its own site
 * (packages/agent/src/mcp/store-brand.ts), and whether we have its icon. The
 * card fetches it from the host's sandbox, hence `Access-Control-Allow-Origin: *`.
 * Public facts about a public site; no user data in or out.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ site: string }> },
) {
  const site = siteOf(decodeURIComponent((await params).site));
  if (!site) {
    return new Response("Not found", { status: 404 });
  }
  const brand = await getStoreBrands()(site);
  return Response.json(
    { site, name: brand.name, icon: Boolean(brand.icon) },
    {
      headers: {
        "Cache-Control":
          brand.name || brand.icon
            ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
            : "public, max-age=300, s-maxage=600",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

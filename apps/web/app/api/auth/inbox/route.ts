import { resolveMx } from "node:dns/promises";
import { z } from "zod";
import { providerForDomain, providerForMx } from "../../../../lib/inbox";

export const runtime = "nodejs";

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/);

/**
 * Which webmail a sign-in email's domain is read in, so the code step can link
 * to it: well-known domains by name, custom ones by their mail servers. Only
 * the domain comes in, never the address.
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = domain.safeParse(
    new URL(request.url).searchParams.get("domain"),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Send a domain." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const known = providerForDomain(parsed.data);
  const provider =
    known ??
    providerForMx(
      await Promise.race([
        resolveMx(parsed.data).then((records) =>
          records.map((record) => record.exchange),
        ),
        new Promise<string[]>((resolve) => setTimeout(resolve, 2000, [])),
      ]).catch(() => []),
    );
  return Response.json(
    { provider: provider ?? null },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}

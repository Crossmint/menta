import { getCheckoutAgents, getCheckouts } from "@oca/agent/crossmint";
import { currentUser, unauthorized } from "../../../lib/server/user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const url = new URL(request.url);
  try {
    const page = await getCheckouts().list(user.id, {
      limit: Math.min(Number(url.searchParams.get("limit")) || 20, 50),
      ...(url.searchParams.get("cursor")
        ? { cursor: String(url.searchParams.get("cursor")) }
        : {}),
    });
    // Which agent started each run, when Menta noted it (Transactions' Agent column).
    const agents = await (getCheckoutAgents()
      ?.of(
        user.id,
        page.runs.map((run) => run.runId),
      )
      .catch(() => null) ?? null);
    return Response.json(
      {
        ...page,
        runs: page.runs.map((run) => ({
          ...run,
          agent: agents?.get(run.runId) ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unavailable" },
      { status: 502 },
    );
  }
}

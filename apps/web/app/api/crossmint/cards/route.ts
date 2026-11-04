import {
  type CardSetup,
  crossmintKey,
  getCardNames,
  getCardSetups,
  prepareCardsForOrderIntents,
} from "@oca/agent/crossmint";
import {
  currentUser,
  origin,
  sameOrigin,
  unauthorized,
} from "../../../../lib/server/user";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's saved cards for our payment list (brand, last four and
 * expiry only), each enrolled for agent payments with their email so the first
 * Approve works, with the names the user gave them in Menta (none if those
 * can't be read). `cards` is null when Crossmint couldn't list them. The
 * browser can't list cards itself: Crossmint's list route doesn't answer it.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const { cards } = await prepareCardsForOrderIntents({
    apiKey: crossmintKey("CLIENT"),
    jwt: user.jwt,
    email: user.email,
    origin: origin(),
    timeoutMs: 8000,
  });
  const [names, setups] = cards
    ? await Promise.all([
        getCardNames()
          .of(user.id)
          .catch(() => new Map<string, string>()),
        getCardSetups()
          .of(user.id)
          .catch(() => new Map<string, CardSetup>()),
      ])
    : [new Map<string, string>(), new Map<string, CardSetup>()];
  return Response.json(
    {
      cards:
        cards?.map((card) => ({
          ...card,
          name: names.get(card.paymentMethodId) ?? null,
          setup: setups.get(card.paymentMethodId) ?? null,
        })) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * The user's saved cards, listed only (nothing enrolled): Home's setup steps
 * and Spending limits, which shows which card each limit is on.
 */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const { cards } = await prepareCardsForOrderIntents({
    apiKey: crossmintKey("CLIENT"),
    jwt: user.jwt,
    email: null,
    origin: origin(),
    timeoutMs: 8000,
  });
  const [names, setups] = cards
    ? await Promise.all([
        getCardNames()
          .of(user.id)
          .catch(() => new Map<string, string>()),
        getCardSetups()
          .of(user.id)
          .catch(() => new Map<string, CardSetup>()),
      ])
    : [new Map<string, string>(), new Map<string, CardSetup>()];
  return Response.json(
    {
      cards:
        cards?.map((card) => ({
          ...card,
          name: names.get(card.paymentMethodId) ?? null,
          setup: setups.get(card.paymentMethodId) ?? null,
        })) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

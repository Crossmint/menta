import {
  crossmintKey,
  getCardNames,
  getCardSetups,
  prepareCardsForOrderIntents,
  removeCard,
  setDefaultCard,
} from "@oca/agent/crossmint";
import { z } from "zod";
import {
  currentUser,
  origin,
  sameOrigin,
  unauthorized,
} from "../../../../../lib/server/user";

export const dynamic = "force-dynamic";

const change = z
  .object({
    /** The card's name in Menta; an empty one clears it. */
    name: z.string().trim().max(40).optional(),
    /** Make it the default card. */
    default: z.literal(true).optional(),
    /** How it pays for spending limits, once its agent payments setup ran. */
    setup: z.enum(["network", "encrypted"]).optional(),
  })
  .strict()
  .refine((body) => body.name !== undefined || body.default || body.setup, {
    message: "Nothing to change.",
  });

/**
 * Removes one of the signed-in user's saved cards. Crossmint resolves the user
 * from their JWT, so another user's card is simply not found.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const { id } = await params;
  if (!/^[\w-]{1,100}$/.test(id)) {
    return Response.json({ error: "Unknown card." }, { status: 404 });
  }
  const removed = await removeCard({
    apiKey: crossmintKey("CLIENT"),
    jwt: user.jwt,
    origin: origin(),
    paymentMethodId: id,
  });
  if (!removed) {
    return Response.json(
      { error: "Couldn't remove this card." },
      { status: 502 },
    );
  }
  // Its name goes with it; a name left behind names nothing, so a failure here is fine.
  try {
    await getCardNames().set(user.id, id, null);
  } catch {}
  return new Response(null, { status: 204 });
}

/**
 * Renames one of the signed-in user's cards (Menta keeps the name, only for a
 * card Crossmint lists for them) or makes it their default (Crossmint keeps
 * that, from the user's JWT, so another user's card is simply not found).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const { id } = await params;
  if (!/^[\w-]{1,100}$/.test(id)) {
    return Response.json({ error: "Unknown card." }, { status: 404 });
  }
  const body = change.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid change." }, { status: 400 });
  }
  if (body.data.name || body.data.setup) {
    // Only a card the user has gets a name or a mark: Crossmint lists theirs from the JWT.
    const { cards } = await prepareCardsForOrderIntents({
      apiKey: crossmintKey("CLIENT"),
      jwt: user.jwt,
      email: null,
      origin: origin(),
      timeoutMs: 8000,
    });
    if (!cards) {
      return Response.json(
        { error: "Couldn't rename this card." },
        { status: 502 },
      );
    }
    if (!cards.some((card) => card.paymentMethodId === id)) {
      return Response.json({ error: "Unknown card." }, { status: 404 });
    }
  }
  if (body.data.default) {
    const made = await setDefaultCard({
      apiKey: crossmintKey("CLIENT"),
      jwt: user.jwt,
      origin: origin(),
      paymentMethodId: id,
    });
    if (!made) {
      return Response.json(
        { error: "Couldn't make this card the default." },
        { status: 502 },
      );
    }
  }
  if (body.data.name !== undefined) {
    try {
      await getCardNames().set(user.id, id, body.data.name || null);
    } catch {
      return Response.json(
        { error: "Couldn't rename this card." },
        { status: 502 },
      );
    }
  }
  if (body.data.setup) {
    try {
      await getCardSetups().set(user.id, id, body.data.setup);
    } catch {
      return Response.json(
        { error: "Couldn't update this card." },
        { status: 502 },
      );
    }
  }
  return new Response(null, { status: 204 });
}

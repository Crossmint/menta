import {
  cancelOrderIntent,
  crossmintKey,
  getCheckouts,
  listOrderIntents,
  prepareCardsForOrderIntents,
  removeCard,
} from "@oca/agent/crossmint";
import { forgetUser } from "@oca/agent/forget-user";
import { clearWebSessionCookie } from "../../../lib/auth/cookies";
import { notificationCookie } from "../../../lib/server/notification-cookie";
import {
  type CurrentUser,
  currentUser,
  origin,
  sameOrigin,
  stytch,
  unauthorized,
} from "../../../lib/server/user";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  return Response.json(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
    { headers: noStore },
  );
}

/**
 * Deletes the signed-in user's account: their approvals, cards, addresses and
 * store sign-ins at Crossmint, every row Menta keeps for them, and last their
 * Stytch user (which revokes their sessions and connected assistants). Each
 * step is idempotent, so on a failure it stops with a 502 and nothing later
 * runs; trying again picks up where it stopped.
 */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const steps: [string, (user: CurrentUser) => Promise<unknown>][] = [
    ["approvals", cancelApprovals],
    ["cards", removeCards],
    ["addresses", deleteAddresses],
    ["store sign-ins", (user) => getCheckouts().clearSignIns(user.id)],
    ["Menta data", forgetUser],
    ["sign-in", (user) => stytch().users.delete({ user_id: user.id })],
  ];
  for (const [name, step] of steps) {
    try {
      await step(user);
    } catch {
      // The step's name only: provider errors can echo a request.
      console.warn(`Couldn't delete an account's ${name}.`);
      return Response.json(
        { error: "Couldn't delete your account. Try again." },
        { status: 502, headers: noStore },
      );
    }
  }
  const response = new Response(null, { status: 204, headers: noStore });
  clearWebSessionCookie(response, origin());
  return notificationCookie(response, request, null);
}

function crossmintUser(user: CurrentUser) {
  return { apiKey: crossmintKey("CLIENT"), jwt: user.jwt, origin: origin() };
}

/** Cancels every active approval, so nothing more can be charged on one. */
async function cancelApprovals(user: CurrentUser) {
  const intents = await listOrderIntents(crossmintUser(user));
  if (!intents) {
    throw new Error("Couldn't list approvals.");
  }
  for (const intent of intents) {
    if (intent.status !== "active") {
      continue;
    }
    const cancelled = await cancelOrderIntent({
      ...crossmintUser(user),
      orderIntentId: intent.orderIntentId,
    });
    if (!cancelled) {
      throw new Error("Couldn't cancel an approval.");
    }
  }
}

async function removeCards(user: CurrentUser) {
  // No email: list the cards without enrolling them for agent payments.
  const { cards } = await prepareCardsForOrderIntents({
    ...crossmintUser(user),
    email: null,
    timeoutMs: 8000,
  });
  if (!cards) {
    throw new Error("Couldn't list cards.");
  }
  for (const card of cards) {
    const removed = await removeCard({
      ...crossmintUser(user),
      paymentMethodId: card.paymentMethodId,
    });
    if (!removed) {
      throw new Error("Couldn't remove a card.");
    }
  }
}

async function deleteAddresses(user: CurrentUser) {
  const checkouts = getCheckouts();
  for (const address of await checkouts.addresses(user.id)) {
    await checkouts.deleteAddress(user.id, address.id);
  }
}

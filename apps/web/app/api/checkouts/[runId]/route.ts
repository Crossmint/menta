import { getCheckouts, paymentMessageId } from "@oca/agent/crossmint";
import { getCheckoutEvents, getGrokBotUpdates } from "@oca/agent/mcp";
import { after } from "next/server";
import { z } from "zod";
import { currentUser, unauthorized } from "../../../../lib/server/user";

export const dynamic = "force-dynamic";
/** A Grok Bot updates follower may read in the background until shortly before this. */
export const maxDuration = 60;
const FOLLOW_MS = 50_000;

/**
 * Grok Bot updates: keep reading a checkout Grok Bot followed, in the
 * background of this request, so its routine hears what happens next. A
 * no-op for checkouts Grok Bot never read and users without updates.
 */
function followForGrokBot(userId: string, runId: string, started: number) {
  const updates = getGrokBotUpdates();
  if (updates) {
    after(() =>
      updates.follow(userId, runId, getCheckouts(), {
        deadline: started + FOLLOW_MS,
      }),
    );
  }
}

function failed(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status) || 502
      : 502;
  const message =
    error instanceof Error ? error.message : "Crossmint is unavailable.";
  return Response.json(
    { error: message },
    { status: status === 404 ? 404 : status >= 500 ? 502 : status },
  );
}

/**
 * The owner's live view of a run, with its progress (the browser agent's
 * latest steps). Crossmint scopes every read to this user.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const started = Date.now();
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  try {
    const view = await getCheckouts().get(user.id, (await params).runId, {
      progress: true,
    });
    // ChatGPT (MCP Events) hears about changes the dock or secure page sees.
    const events = getCheckoutEvents();
    if (events) {
      after(() => events.observe(user.id, view));
    }
    // So does a Grok Bot routine, for checkouts Grok Bot followed.
    const updates = getGrokBotUpdates();
    if (updates) {
      after(() => updates.observe(user.id, view));
      followForGrokBot(user.id, view.runId, started);
    }
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failed(error);
  }
}

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("approve"),
    requestId: z.string().min(1),
    orderIntentId: z.string().min(1),
  }),
  z.object({
    action: z.literal("answer"),
    requestId: z.string().min(1),
    answers: z.record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.string()),
        z.object({ protectedInputId: z.string().min(1) }),
      ]),
    ),
  }),
  z.object({ action: z.literal("decline"), requestId: z.string().min(1) }),
  z.object({
    action: z.literal("alternative"),
    requestId: z.string().min(1),
    text: z.string().trim().min(1).max(1000),
  }),
  z.object({
    action: z.literal("steer"),
    text: z.string().trim().min(1).max(1000),
  }),
]);

/**
 * Trusted browser actions on the owner's checkout. Payment approval arrives here only as
 * an order intent the user created in Crossmint's UI; the model has no path to this route.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const started = Date.now();
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { runId } = await params;
  const checkouts = getCheckouts();
  const input = parsed.data;
  try {
    if (input.action === "cancel") {
      return Response.json(await checkouts.cancel(user.id, runId));
    }
    if (input.action === "steer") {
      return Response.json(
        await checkouts.steer(user.id, runId, crypto.randomUUID(), input.text),
      );
    }
    const run = await checkouts.get(user.id, runId);
    if (run.pending?.requestId !== input.requestId) {
      // Paid already: the user's assistant paid it from a spending limit (or the one just
      // approved) a moment before this approval arrived. Only a payment
      // Crossmint shows counts, never a decline or an unreadable log.
      if (
        input.action === "approve" &&
        (await checkouts
          .answer(user.id, runId, input.requestId)
          .catch(() => null)) === "payment"
      ) {
        return Response.json({ alreadyAnswered: true });
      }
      return Response.json(
        { error: "This step is no longer open." },
        { status: 409 },
      );
    }
    // What happens next (the order going through) reaches Grok Bot's routine.
    followForGrokBot(user.id, runId, started);
    // A payment request takes one answer: the same ID as every payer's.
    const messageId =
      input.action === "approve"
        ? paymentMessageId(user.id, runId, input.requestId)
        : crypto.randomUUID();
    const part =
      input.action === "approve"
        ? { requestId: input.requestId, orderIntentId: input.orderIntentId }
        : input.action === "decline"
          ? { requestId: input.requestId, decline: true as const }
          : input.action === "alternative"
            ? { requestId: input.requestId, alternative: input.text }
            : { requestId: input.requestId, answers: input.answers };
    return Response.json(
      await checkouts.respond(user.id, runId, messageId, part),
    );
  } catch (error) {
    return failed(error);
  }
}

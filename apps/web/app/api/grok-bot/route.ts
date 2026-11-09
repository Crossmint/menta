import {
  getGrokBotUpdates,
  ROUTINE_INSTRUCTION,
  readRoutineInput,
  routineStatus,
  UPDATES_PHRASE,
} from "@oca/agent/mcp";
import { z } from "zod";
import { testResult } from "../../../lib/server/grok-bot";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../lib/server/user";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function unavailable() {
  return Response.json(
    { error: "Grok Bot updates aren't available right now." },
    { status: 503, headers: noStore },
  );
}

function failed() {
  return Response.json(
    { error: "Couldn't update Grok Bot updates. Try again." },
    { status: 502, headers: noStore },
  );
}

/** What the page shows before setup: the phrase to say in Grok Bot, and the instruction for doing it by hand. */
const setup = { phrase: UPDATES_PHRASE, instruction: ROUTINE_INSTRUCTION };

/** The user's Grok Bot routine: on or off, the URL's host, the key's last four and the last delivery. Never the key. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const updates = getGrokBotUpdates();
  if (!updates) {
    return Response.json(
      { available: false, configured: false, ...setup },
      { headers: noStore },
    );
  }
  updates.forget(user.id);
  try {
    const routine = await updates.routineOf(user.id);
    return Response.json(
      { available: true, ...setup, ...routineStatus(routine) },
      { headers: noStore },
    );
  } catch {
    return failed();
  }
}

const saveBody = z.object({
  url: z.string().max(4096),
  key: z.string().max(4096),
});

/**
 * Saves the routine's webhook URL and key (sealed), turns updates on, and
 * sends the test right away: the reply says whether Grok Bot got it.
 */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const updates = getGrokBotUpdates();
  if (!updates) {
    return unavailable();
  }
  const body = saveBody.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Invalid request." },
      { status: 400, headers: noStore },
    );
  }
  const input = readRoutineInput(body.data.url, body.data.key);
  if (!input.ok) {
    return Response.json(
      { error: input.error, field: input.field },
      { status: 400, headers: noStore },
    );
  }
  try {
    await updates.store.save(user.id, {
      url: input.url,
      key: input.key,
      keyHint: input.keyHint,
    });
    updates.forget(user.id);
    console.info("Grok Bot routine saved", {
      host: new URL(input.url).hostname,
    });
  } catch {
    return failed();
  }
  // Saved either way; the test says whether the URL and key work.
  const test = testResult(await updates.sendTest(user.id));
  updates.forget(user.id);
  try {
    return Response.json(
      {
        available: true,
        ...setup,
        ...routineStatus(await updates.routineOf(user.id)),
        test,
      },
      { headers: noStore },
    );
  } catch {
    return failed();
  }
}

const toggleBody = z.object({ enabled: z.boolean() });

/** Turns updates off or back on, keeping the routine. */
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const updates = getGrokBotUpdates();
  if (!updates) {
    return unavailable();
  }
  const body = toggleBody.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Invalid request." },
      { status: 400, headers: noStore },
    );
  }
  try {
    if (!(await updates.store.setEnabled(user.id, body.data.enabled))) {
      return Response.json(
        { error: "No Grok Bot routine is saved." },
        { status: 404, headers: noStore },
      );
    }
    updates.forget(user.id);
    return Response.json(
      { available: true, ...routineStatus(await updates.routineOf(user.id)) },
      { headers: noStore },
    );
  } catch {
    return failed();
  }
}

/** Forgets the routine: its URL, key and what it was told. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const updates = getGrokBotUpdates();
  if (!updates) {
    return unavailable();
  }
  try {
    await updates.store.remove(user.id);
    updates.forget(user.id);
    return Response.json(
      { available: true, configured: false },
      { headers: noStore },
    );
  } catch {
    return failed();
  }
}

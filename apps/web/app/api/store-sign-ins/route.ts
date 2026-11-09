import { getCheckouts } from "@oca/agent/crossmint";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../lib/server/user";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** Whether checkouts are keeping the user signed in to stores (their Crossmint browser profile). */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  try {
    const saved = await getCheckouts().hasSavedSignIns(user.id);
    return Response.json({ saved }, { headers: noStore });
  } catch {
    return Response.json(
      { error: "Couldn't load store sign-ins." },
      { status: 502, headers: noStore },
    );
  }
}

/**
 * Sign out of every store: Crossmint erases the browser profile once checkouts using it
 * finish. The next checkout starts a fresh one.
 */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  try {
    await getCheckouts().clearSignIns(user.id);
    return new Response(null, { status: 204, headers: noStore });
  } catch {
    return Response.json(
      { error: "Couldn't clear store sign-ins. Try again." },
      { status: 502, headers: noStore },
    );
  }
}

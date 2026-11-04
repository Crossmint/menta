import { getCheckouts } from "@oca/agent/crossmint";
import {
  addressFailure,
  noStore,
  readDraft,
} from "../../../lib/server/addresses";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../lib/server/user";

export const dynamic = "force-dynamic";

/** The user's saved addresses (Crossmint buyer profiles), with the default marked. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  try {
    const addresses = await getCheckouts().addresses(user.id);
    return Response.json({ addresses }, { headers: noStore });
  } catch (error) {
    return addressFailure(error);
  }
}

/** Save a new address; it becomes the default only with `makeDefault: true`. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const draft = await readDraft(request);
  if (draft instanceof Response) {
    return draft;
  }
  try {
    const saved = await getCheckouts().saveAddress(user.id, draft);
    return Response.json(saved, { status: 201, headers: noStore });
  } catch (error) {
    return addressFailure(error);
  }
}

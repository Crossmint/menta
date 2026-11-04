import { getCheckouts } from "@oca/agent/crossmint";
import { z } from "zod";
import {
  addressFailure,
  noStore,
  readDraft,
} from "../../../../lib/server/addresses";
import {
  currentUser,
  sameOrigin,
  unauthorized,
} from "../../../../lib/server/user";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const id = z.uuid();

/** Signed-in, same-origin user and a well-formed address ID, or the Response to send. */
async function caller(request: Request, params: Params["params"]) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) {
    return unauthorized();
  }
  const parsed = id.safeParse((await params).id);
  if (!parsed.success) {
    return Response.json(
      { error: "Unknown address." },
      { status: 404, headers: noStore },
    );
  }
  return { user, id: parsed.data };
}

/** Replace an address. */
export async function PUT(request: Request, { params }: Params) {
  const who = await caller(request, params);
  if (who instanceof Response) {
    return who;
  }
  const draft = await readDraft(request);
  if (draft instanceof Response) {
    return draft;
  }
  try {
    const saved = await getCheckouts().saveAddress(who.user.id, {
      ...draft,
      id: who.id,
    });
    return Response.json(saved, { headers: noStore });
  } catch (error) {
    return addressFailure(error);
  }
}

/** Make this address the default (`{ "default": true }`), or with false, have none. */
export async function PATCH(request: Request, { params }: Params) {
  const who = await caller(request, params);
  if (who instanceof Response) {
    return who;
  }
  const body = z
    .object({ default: z.boolean() })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Nothing to change." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const addresses = await getCheckouts().setDefaultAddress(
      who.user.id,
      who.id,
      body.data.default,
    );
    return Response.json({ addresses }, { headers: noStore });
  } catch (error) {
    return addressFailure(error);
  }
}

/** Delete an address. The newest remaining one becomes the default if this was it. */
export async function DELETE(request: Request, { params }: Params) {
  const who = await caller(request, params);
  if (who instanceof Response) {
    return who;
  }
  try {
    const addresses = await getCheckouts().deleteAddress(who.user.id, who.id);
    return Response.json({ addresses }, { headers: noStore });
  } catch (error) {
    return addressFailure(error);
  }
}

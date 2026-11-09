import { buyerDraft, crossmintError, draftErrors } from "../buyer-details";

export const noStore = { "Cache-Control": "no-store" };

/**
 * Validates a posted address form, plus whether to make it the default
 * (`makeDefault: true`); a Response when it doesn't pass.
 */
export async function readDraft(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = buyerDraft.safeParse(body);
  if (parsed.success) {
    return {
      ...parsed.data,
      makeDefault:
        typeof body === "object" && body !== null && body.makeDefault === true,
    };
  }
  return Response.json(
    {
      error: "Check the highlighted fields.",
      fields: draftErrors(parsed.error),
    },
    { status: 400, headers: noStore },
  );
}

/** A Crossmint or checkouts error as the account form shows it. */
export function addressFailure(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status) || 502
      : 502;
  const code =
    typeof error === "object" && error && "code" in error ? error.code : null;
  if (status === 404) {
    return Response.json(
      { error: "That address is gone. Reload to see your addresses." },
      { status: 404, headers: noStore },
    );
  }
  // Crossmint's 4xx messages explain what to fix (e.g. an unknown region code).
  if (status >= 400 && status < 500 && error instanceof Error) {
    const fields =
      code === "duplicate_label"
        ? { label: "You already have an address with this name." }
        : crossmintError(error.message);
    return Response.json(
      {
        error: Object.keys(fields).length
          ? "Check the highlighted fields."
          : error.message,
        fields,
      },
      { status: 400, headers: noStore },
    );
  }
  return Response.json(
    { error: "Crossmint is unavailable. Try again." },
    { status: 502, headers: noStore },
  );
}

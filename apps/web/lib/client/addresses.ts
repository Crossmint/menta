"use client";

import { useEffect, useState } from "react";
import type { BuyerDraft, DraftErrors, SavedAddress } from "../buyer-details";

export interface Saved {
  readonly id: string;
  readonly addresses: SavedAddress[];
}

/** The address just saved, as the chat may mention it: label and city. */
export function savedAddress({ id, addresses }: Saved) {
  return addresses.find((address) => address.id === id) ?? null;
}

/**
 * Saves a new address (or replaces one by ID) through our server, which
 * validates it again and stores it as a Crossmint buyer profile. It becomes
 * the default only with `makeDefault`.
 */
export async function saveAddress(
  draft: BuyerDraft,
  options: { id?: string; makeDefault?: boolean } = {},
): Promise<
  ({ ok: true } & Saved) | { ok: false; error: string; fields: DraftErrors }
> {
  const { id, makeDefault = false } = options;
  const response = await fetch(
    id ? `/api/addresses/${encodeURIComponent(id)}` : "/api/addresses",
    {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, makeDefault }),
    },
  ).catch(() => null);
  const body = (await response?.json().catch(() => null)) as
    | (Partial<Saved> & { error?: string; fields?: DraftErrors })
    | null;
  if (response?.ok && body?.id && body.addresses) {
    return { ok: true, id: body.id, addresses: body.addresses };
  }
  return {
    ok: false,
    error: body?.error ?? "Couldn't save. Try again.",
    fields: body?.fields ?? {},
  };
}

/** Makes an address the default, or not; the updated list, or null when it failed. */
export async function makeDefaultAddress(id: string, value = true) {
  const response = await fetch(`/api/addresses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ default: value }),
  }).catch(() => null);
  const body = (await response?.json().catch(() => null)) as {
    addresses?: SavedAddress[];
  } | null;
  return response?.ok && body?.addresses ? body.addresses : null;
}

/** The user's saved addresses: undefined while loading, null when they couldn't be read. */
export function useSavedAddresses(enabled = true) {
  const [addresses, setAddresses] = useState<SavedAddress[] | null>();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let live = true;
    void fetch("/api/addresses", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { addresses: SavedAddress[] } | null) => {
        if (live) {
          setAddresses(body?.addresses ?? null);
        }
      })
      .catch(() => {
        if (live) {
          setAddresses(null);
        }
      });
    return () => {
      live = false;
    };
  }, [enabled]);
  return [addresses, setAddresses] as const;
}

export { startingContact } from "@oca/client/buyer-details";

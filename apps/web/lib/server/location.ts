/**
 * How many location lookups (`/api/location`) a user may make per window.
 * Per server instance: enough to stop a runaway client and keep our share of
 * Nominatim small, not a hard quota.
 */
const perWindow = 20;
const windowMs = 10 * 60_000;
const recent = new Map<string, number[]>();

export function allowLookup(userId: string, now = Date.now()) {
  const times = (recent.get(userId) ?? []).filter((at) => now - at < windowMs);
  const allowed = times.length < perWindow;
  if (allowed) {
    times.push(now);
  }
  recent.set(userId, times);
  return allowed;
}

/** Forgets every user's recent lookups (tests). */
export function resetLookupLimits() {
  recent.clear();
}

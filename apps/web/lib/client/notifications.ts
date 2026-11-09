const storageKey = "oca-notifications";
interface Saved {
  readonly userId: string;
  readonly id: string;
  readonly endpointHash?: string;
}

export function supportedNotifications() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function savedNotifications(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return typeof saved?.userId === "string" && typeof saved.id === "string"
      ? saved
      : null;
  } catch {
    return null;
  }
}

function forget() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* Private browsing can disable storage. */
  }
}

async function browserSubscription() {
  return (
    (
      await navigator.serviceWorker.getRegistration("/")
    )?.pushManager.getSubscription() ?? null
  );
}

export async function notificationState(userId: string) {
  const saved = savedNotifications();
  const response = await fetch(
    `/api/notifications${saved?.userId === userId ? `?id=${encodeURIComponent(saved.id)}` : ""}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error("Couldn't load notification settings. Try again.");
  }
  let state = (await response.json()) as {
    id: string | null;
    endpointHash: string | null;
    available: boolean;
    publicKey: string | null;
    subscribed: boolean;
  };
  const subscription = await browserSubscription();
  const allowed = Notification.permission === "granted";
  const keyMatches = Boolean(
    subscription &&
      state.publicKey &&
      sameKey(subscription.options.applicationServerKey, state.publicKey),
  );
  const hash = subscription ? await endpointHash(subscription.endpoint) : null;
  if (
    allowed &&
    keyMatches &&
    subscription &&
    state.subscribed &&
    state.id &&
    hash !== state.endpointHash
  ) {
    // Renewals keep the user's existing opt-in, but the server must receive the new endpoint.
    const id = await enroll(userId, subscription, state.id);
    state = { ...state, id, endpointHash: hash };
  } else if (state.subscribed && state.id && state.endpointHash) {
    remember(userId, state.id, state.endpointHash);
  }
  return {
    ...state,
    enrolled: state.subscribed,
    enabled:
      state.subscribed && allowed && keyMatches && hash === state.endpointHash,
  };
}

/** Called directly from the user's click; permission is requested before any await. */
export async function enableNotifications(userId: string, publicKey: string) {
  if (Notification.permission === "denied") {
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return false;
  }
  const registration = await navigator.serviceWorker.register(
    "/notifications-sw.js",
    { scope: "/", updateViaCache: "none" },
  );
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  const saved = savedNotifications();
  // Explicit enable also replaces an expired provider subscription, even when its VAPID key matches.
  await subscription?.unsubscribe();
  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeKey(publicKey),
  });
  await enroll(
    userId,
    subscription,
    saved?.userId === userId ? saved.id : undefined,
  );
  return true;
}

async function endpointHash(endpoint: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)),
  );
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function remember(userId: string, id: string, hash: string) {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ userId, id, endpointHash: hash }),
  );
}
async function enroll(
  userId: string,
  subscription: PushSubscription,
  replaces?: string,
) {
  let id: string | undefined;
  try {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        subscription: subscription.toJSON(),
        ...(replaces ? { replaces } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error("Couldn't enable notifications. Try again.");
    }
    const result = (await response.json()) as { id: string };
    id = result.id;
    remember(userId, id, await endpointHash(subscription.endpoint));
    return id;
  } catch {
    await subscription.unsubscribe().catch(() => false);
    forget();
    if (id) {
      await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    }
    throw new Error("Couldn't save notification settings. Try again.");
  }
}

export async function disableNotifications() {
  const saved = savedNotifications();
  let browserError: unknown;
  if (supportedNotifications()) {
    try {
      await (await browserSubscription())?.unsubscribe();
    } catch (error) {
      browserError = error;
    }
  }
  if (saved) {
    const response = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: saved.id }),
    });
    if (!response.ok) {
      throw new Error("Couldn't remove notification settings. Try again.");
    }
  }
  forget();
  if (browserError && !saved) {
    throw new Error("Couldn't turn off browser notifications. Try again.");
  }
}

/** A browser subscription belongs to one signed-in person, including on shared computers. */
export async function syncNotificationUser(userId: string) {
  const saved = savedNotifications();
  if (saved && saved.userId !== userId && supportedNotifications()) {
    await (await browserSubscription())?.unsubscribe();
    forget();
  }
}

export async function testNotifications() {
  const saved = savedNotifications();
  if (!saved) {
    return;
  }
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "test", id: saved.id }),
  });
  if (!response.ok) {
    throw new Error("The test couldn't be sent. Try again.");
  }
}

function decodeKey(value: string) {
  const raw = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
function sameKey(key: ArrayBuffer | null, value: string) {
  const decoded = decodeKey(value);
  const current = key ? new Uint8Array(key) : [];
  return (
    current.length === decoded.length &&
    decoded.every((byte, index) => byte === current[index])
  );
}

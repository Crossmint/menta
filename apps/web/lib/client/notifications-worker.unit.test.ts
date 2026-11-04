import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../../public/notifications-sw.js", import.meta.url),
  "utf8",
);
const listeners: Record<string, (event: unknown) => void> = {};
const showNotification = vi.fn(async () => {});
const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
const openWindow = vi.fn(async () => {});
const focus = vi.fn(async () => {});
const matchAll = vi.fn(
  async (): Promise<{ url: string; focus: typeof focus }[]> => [],
);
beforeEach(() => {
  vi.clearAllMocks();
  matchAll.mockResolvedValue([]);
  runInNewContext(source, {
    URL,
    Date,
    Notification: { permission: "granted" },
    fetch: fetchMock,
    self: {
      addEventListener: (kind: string, callback: (event: unknown) => void) => {
        listeners[kind] = callback;
      },
      location: { origin: "https://oca.example" },
      registration: { showNotification },
      clients: { matchAll, openWindow },
    },
  });
});
async function dispatch(kind: string, fields: Record<string, unknown>) {
  let task: Promise<void> | undefined;
  listeners[kind]?.({
    ...fields,
    waitUntil: (promise: Promise<void>) => {
      task = promise;
    },
  });
  await task;
}
function click(url: string) {
  return dispatch("notificationclick", {
    notification: { close: vi.fn(), data: { url } },
  });
}
it("shows push notifications without an open page and opens the original chat on click", async () => {
  await dispatch("push", {
    data: {
      json: () => ({
        body: "A store has a question for you.",
        expiresAt: Date.now() + 60_000,
        tag: "oca-run",
        url: "/c/chat",
      }),
    },
  });
  expect(showNotification).toHaveBeenCalledWith(
    "Menta",
    expect.objectContaining({
      body: "A store has a question for you.",
      data: { url: "/c/chat" },
    }),
  );
  await click("/c/chat");
  expect(openWindow).toHaveBeenCalledWith("https://oca.example/c/chat");
});
it("focuses an existing chat instead of opening another tab", async () => {
  matchAll.mockResolvedValue([{ url: "https://oca.example/c/chat", focus }]);
  await click("/c/chat");
  expect(focus).toHaveBeenCalledOnce();
  expect(openWindow).not.toHaveBeenCalled();
});
it.each([
  "https://evil.invalid/x",
  "//evil.invalid/x",
  "/c/chat?redirect=evil",
  "/checkouts/capability",
])("refuses arbitrary notification destinations: %s", async (url) => {
  await click(url);
  expect(openWindow).toHaveBeenCalledWith(
    "https://oca.example/settings#notifications",
  );
});
it("replaces delayed, expired action copy with a generic update", async () => {
  await dispatch("push", {
    data: {
      json: () => ({
        body: "A checkout is ready for your payment approval.",
        expiresAt: Date.now() - 1,
        url: "/c/chat",
      }),
    },
  });
  expect(showNotification).toHaveBeenCalledWith(
    "Menta",
    expect.objectContaining({
      body: "Open Menta to see the latest checkout update.",
    }),
  );
});
it("does not intercept or cache authenticated requests", () => {
  expect(listeners.fetch).toBeUndefined();
});

it("renews using only an existing enrollment and cookie-bound owner, without asking for permission", async () => {
  const subscription = {
    toJSON: () => ({ endpoint: "https://fcm.googleapis.com/new", keys: {} }),
  };
  await dispatch("pushsubscriptionchange", {
    oldSubscription: { endpoint: "https://fcm.googleapis.com/old" },
    newSubscription: subscription,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/notifications",
    expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        action: "refresh",
        previousEndpoint: "https://fcm.googleapis.com/old",
        subscription: subscription.toJSON(),
      }),
    }),
  );
});

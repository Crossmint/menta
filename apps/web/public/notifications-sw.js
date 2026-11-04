// Notification delivery only: never cache authenticated pages or intercept requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let message;
      try {
        message = event.data?.json();
      } catch {
        return;
      }
      if (
        !message ||
        typeof message.body !== "string" ||
        typeof message.expiresAt !== "number"
      ) {
        return;
      }
      await self.registration.showNotification("Menta", {
        body:
          message.expiresAt <= Date.now()
            ? "Open Menta to see the latest checkout update."
            : message.body,
        icon: "/icon/192",
        badge: "/icon/192",
        tag: typeof message.tag === "string" ? message.tag : "oca",
        data: { url: safePath(message.url) },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(
        safePath(event.notification.data?.url),
        self.location.origin,
      ).href;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = clients.find((client) => client.url === url);
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
function safePath(value) {
  if (typeof value === "string" && /^\/c\/[^/?#]+$/.test(value)) {
    return value;
  }
  return "/settings#notifications";
}

// Provider renewals preserve an existing enrollment only while its owner is still signed in.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      if (!event.oldSubscription || Notification.permission !== "granted") {
        return;
      }
      try {
        const subscription =
          event.newSubscription ??
          (await self.registration.pushManager.subscribe(
            event.oldSubscription.options,
          ));
        await fetch("/api/notifications", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "refresh",
            previousEndpoint: event.oldSubscription.endpoint,
            subscription: subscription.toJSON(),
          }),
        });
      } catch {
        /* The next signed-in visit can reconnect this browser. */
      }
    })(),
  );
});

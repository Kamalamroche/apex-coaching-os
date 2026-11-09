/* APEX service worker: shows push notifications and opens the app when one is tapped.
   It does not cache pages, so the app always loads fresh. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { body: event.data ? event.data.text() : "" }; }
  const title = msg.title || "APEX";
  event.waitUntil(self.registration.showNotification(title, {
    body: msg.body || "You have a new message.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: msg.tag || "apex",
    renotify: true,
    data: { url: msg.url || "/start/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/start/", self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Reuse a tab that already shows that part of the app.
    const same = open.find((c) => c.url.startsWith(url.split("?")[0]));
    if (same) {
      await same.focus();
      same.postMessage({ type: "apex-open", url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});

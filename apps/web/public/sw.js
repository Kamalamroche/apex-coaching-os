/* APEX service worker: shows push notifications, opens the app when one is tapped, and lets the app open with
   no signal (in the gym). Pages always come from the network when there is one; the saved copy is only a fallback.
   Data (Supabase) is never cached here: the app keeps its own copy of the client's program. */
const SHELL = "apex-shell-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("apex-shell-") && k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // App pages: network first, the last copy when offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(url.pathname, res.clone());
        return res;
      } catch {
        const cache = await caches.open(SHELL);
        return (await cache.match(url.pathname, { ignoreVary: true })) || (await cache.match("/client/", { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }
  // Built files have a hash in their name, so a saved copy is always right.
  if (url.pathname.startsWith("/assets/") || /^\/(icon|favicon|apple-touch-icon)[^/]*$/.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req, { ignoreVary: true, ignoreSearch: false });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
  }
});

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

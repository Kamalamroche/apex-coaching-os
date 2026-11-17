/** Lets the client app open in the gym with no signal: registers the service worker and saves this page and the
    files it loaded, so the next open works offline straight away. Production only (the dev server has no built files). */
export function enableOffline() {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(async () => {
      if (!("caches" in window)) return;
      const files = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.startsWith(`${location.origin}/assets/`));
      const cache = await caches.open("apex-shell-v2");
      await Promise.all([location.pathname, ...files].map((u) => cache.add(u).catch(() => undefined)));
    }).catch(() => undefined);
  });
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove old app-shell/runtime caches from previous versions.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("myfinance-") || key === "offline-precache")
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Network only (no cache). If the network fails, the request fails too.
  event.respondWith(fetch(req));
});

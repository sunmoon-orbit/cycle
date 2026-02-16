// bump this when you change files to force refresh
const CACHE_VERSION = "2026-02-16-1";
const CACHE_NAME = `sunmoon-cycle-${CACHE_VERSION}`;

const CORE = [
  "/cycle/app.html",
  "/cycle/index.html",
  "/cycle/draw/index.html",
  "/cycle/vault/index.html",
  "/cycle/manifest.webmanifest",
  "/cycle/icons/icon-192.png",
  "/cycle/icons/icon-512.png",
  "/cycle/icons/apple-touch-icon.png",
  "/cycle/icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("sunmoon-cycle-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // For navigations (HTML pages): Network first, fallback to app.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/cycle/app.html"))
    );
    return;
  }

  // For other assets: Cache first, then network, and update cache
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});

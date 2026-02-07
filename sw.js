/* PWA Service Worker - cute_cycle_tracker */
const CACHE_NAME = "cute-cycle-cache-20260207140000"; // ✅ bump name to force update
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",

  // Pages
  "./draw/index.html",
  "./draw/manifest.webmanifest",
  "./vault/index.html",

  // Icons
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) =>
          k.startsWith("cute-cycle-cache-") && k !== CACHE_NAME
            ? caches.delete(k)
            : Promise.resolve()
        )
      );
      await self.clients.claim();
    })()
  );
});

function isNav(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  if (isNav(req)) {
    // Navigation: network-first, fallback to cache (supports multi-page: /, /draw/, /vault/)
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          // Try exact match first
          let cached = await caches.match(req, { ignoreSearch: true });
          if (cached) return cached;

          // If it's a folder path like /vault/ or /draw/, try /vault/index.html
          if (url.pathname.endsWith("/")) {
            const alt = new Request(url.origin + url.pathname + "index.html");
            cached = await caches.match(alt, { ignoreSearch: true });
            if (cached) return cached;
          }

          // Fallback to root
          return (await caches.match("./index.html")) || (await caches.match("./"));
        }
      })()
    );
    return;
  }

  // Assets: cache-first, revalidate in background
  event.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      const fetchPromise = fetch(req)
        .then((res) => {
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(req, res.clone()))
            .catch(() => {});
          return res;
        })
        .catch(() => null);

      return cached || (await fetchPromise) || cached;
    })()
  );
});

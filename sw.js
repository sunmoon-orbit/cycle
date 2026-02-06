/* PWA Service Worker - cute_cycle_tracker */
const CACHE_NAME = "cute-cycle-cache-2026020601"; // ✅改一个新名字，强制更新
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
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
          (k.startsWith("cute-cycle-cache-") && k !== CACHE_NAME)
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

  // ✅ Navigation: network-first, fallback to cache (but cache by *request*, not "./index.html")
  if (isNav(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, fresh.clone());     // ✅关键：按当前页面 URL 缓存，防止串台
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);  // ✅关键：按当前页面 URL 取缓存
          return cached || (await caches.match("./index.html")) || (await caches.match("./"));
        }
      })()
    );
    return;
  }

  // Assets: cache-first, revalidate in background
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone())).catch(() => {});
          return res;
        })
        .catch(() => null);

      return cached || (await fetchPromise) || cached;
    })()
  );
});

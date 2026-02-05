/* PWA Service Worker - cute_cycle_tracker */
const CACHE_NAME = "cute-cycle-cache-20260205190000"; // ✅ 改个新名字，强制更新
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",

  // ✅ 把 draw 也加入预缓存（离线/回退更稳）
  "./draw/",
  "./draw/index.html",
  "./draw/manifest.webmanifest",

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
    // ✅ Navigation: network-first, cache per-page, fallback per-path
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const fresh = await fetch(req);
          // ✅ 关键修复：不要写进 ./index.html，改为“这个请求自己缓存自己”
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          // ✅ 优先：返回“当前页面”的缓存
          const cachedPage = await caches.match(req);
          if (cachedPage) return cachedPage;

          // ✅ 再按路径回退
          if (url.pathname.startsWith("/cycle/draw/")) {
            return (await caches.match("./draw/index.html")) || (await caches.match("./index.html")) || (await caches.match("./"));
          }
          return (await caches.match("./index.html")) || (await caches.match("./"));
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

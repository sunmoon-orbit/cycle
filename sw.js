/* SunMoon PWA Service Worker (safe precache + correct navigation caching) */

const CACHE_NAME = "sunmoon-cycle-20260216-02";
const APP_SHELL = "./app.html";

const PRECACHE_URLS = [
  "./",
  "./app.html",
  "./index.html",
  "./manifest.webmanifest",

  "./icons/favicon-32.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",

  "./draw/index.html",
  "./draw/manifest.webmanifest",

  "./vault/index.html",
  "./vault/manifest.webmanifest",

  "./oracle/index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 不要让某个资源 404 直接把整个 SW install 搞失败
    await Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Navigation: network-first
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
      const path = url.pathname.replace(/\/$/, "");
      const isScopeRoot = path === scopePath;

      const navReq = isScopeRoot ? new Request(APP_SHELL, { cache: "reload" }) : req;

      try {
        const fresh = await fetch(navReq);
        if (fresh && fresh.ok) {
          // ✅ 缓存“自己”的页面（不要把别的页面覆盖到 app.html）
          await cache.put(navReq, fresh.clone());
          if (isScopeRoot) {
            await cache.put(APP_SHELL, fresh.clone());
          }
        }
        return fresh;
      } catch {
        // offline fallback: exact page -> app shell -> index -> root
        const cached =
          (await caches.match(navReq, { ignoreSearch: true })) ||
          (await caches.match(APP_SHELL, { ignoreSearch: true })) ||
          (await caches.match("./index.html", { ignoreSearch: true })) ||
          (await caches.match("./", { ignoreSearch: true }));
        return cached || Response.error();
      }
    })());
    return;
  }

  // Static: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});          (await cache.match(APP_SHELL)) ||
          (await cache.match(req)) ||
          (await cache.match("./index.html")) ||
          (await cache.match("./"))
        );
      }
    }

    // 其它资源：缓存优先，网络更新
    const cached = await cache.match(req);
    if (cached) {
      // 后台更新（不阻塞）
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        } catch {}
      })());
      return cached;
    }

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) await cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      return cached;
    }
  })());
});

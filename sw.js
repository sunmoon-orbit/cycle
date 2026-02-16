/* SunMoon PWA Service Worker (stable) */
const CACHE_NAME = "sunmoon-cycle-20260216-03";
const SCOPE_ROOT = "/cycle/";
const APP_SHELL = "/cycle/app.html";

const PRECACHE_URLS = [
  "/cycle/",
  "/cycle/app.html",
  "/cycle/index.html",
  "/cycle/manifest.webmanifest",

  "/cycle/icons/favicon-32.png",
  "/cycle/icons/apple-touch-icon.png",
  "/cycle/icons/icon-192.png",
  "/cycle/icons/icon-512.png",

  "/cycle/draw/index.html",
  "/cycle/vault/index.html",
  "/cycle/oracle/index.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 不让某个资源 404 直接导致 install 失败
      await Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) 页面导航：网络优先；离线时回退到 app.html（确保桌面图标打开是 Home）
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        const path = url.pathname.replace(/\/$/, "");
        const scopeRoot = SCOPE_ROOT.replace(/\/$/, "");
        const isScopeRoot = path === scopeRoot;

        // 桌面图标/打开根路径时，强制用 Home 作为导航目标
        const navReq = isScopeRoot ? new Request(APP_SHELL, { cache: "reload" }) : req;

        try {
          const fresh = await fetch(navReq);
          if (fresh && fresh.ok) {
            await cache.put(navReq, fresh.clone());
            // 如果是根路径，额外把 APP_SHELL 也覆盖一份，保证离线稳定
            if (isScopeRoot) await cache.put(APP_SHELL, fresh.clone());
          }
          return fresh;
        } catch (e) {
          // 离线：优先命中当前页 -> Home -> index -> 根
          const cached =
            (await caches.match(navReq, { ignoreSearch: true })) ||
            (await caches.match(APP_SHELL, { ignoreSearch: true })) ||
            (await caches.match("/cycle/index.html", { ignoreSearch: true })) ||
            (await caches.match("/cycle/", { ignoreSearch: true }));

          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 2) 静态资源：缓存优先 + 后台更新
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      if (cached) {
        event.waitUntil(
          (async () => {
            try {
              const fresh = await fetch(req);
              if (fresh && fresh.ok) await cache.put(req, fresh.clone());
            } catch {}
          })()
        );
        return cached;
      }

      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return Response.error();
      }
    })()
  );
});

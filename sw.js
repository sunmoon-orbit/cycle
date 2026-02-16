/* SunMoon Cycle PWA SW (fixed: app.html as shell + root navigation) */
const CACHE_NAME = "sunmoon-cycle-cache-20260216-01";
const APP_SHELL = "./app.html";

const PRECACHE_URLS = [
  "./",
  "./app.html",                 // ✅ 新增：把主菜单页预缓存
  "./index.html",
  "./manifest.webmanifest",

  "./icons/favicon-32.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",

  "./draw/index.html",
  "./vault/index.html",
  "./oracle/index.html",

  "./draw/manifest.webmanifest",
  "./vault/manifest.webmanifest",
  "./oracle/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // ✅ 关键修复：把 /cycle/ 这种“根路径导航”强制当成 app.html
    const scopePath = new URL(self.registration.scope).pathname; // e.g. "/cycle/"
    const isScopeRoot =
      url.pathname === scopePath || url.pathname === scopePath.replace(/\/$/, "");

    // 导航请求：优先网络，失败回落缓存；并且根路径统一回到 app.html
    if (req.mode === "navigate") {
      const navUrl = isScopeRoot ? new URL(APP_SHELL, self.registration.scope).toString() : req.url;
      const navReq = isScopeRoot ? new Request(navUrl, { headers: req.headers, redirect: "follow" }) : req;

      try {
        const fresh = await fetch(navReq);
        if (fresh && fresh.ok) {
          cache.put(APP_SHELL, fresh.clone()); // 让 shell 永远是最新
          if (!isScopeRoot) cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        // ✅ 失败兜底顺序：app.html -> 目标页面 -> index.html -> "./"
        return (
          (await cache.match(APP_SHELL)) ||
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

// PWA Code adapted from https://github.com/pwa-builder/PWABuilder
const CACHE = "pwa-precache-v4";
const CDN_ORIGINS = [
  "https://code.jquery.com",
  "https://cdnjs.cloudflare.com",
];
const precacheFiles = [
  "/index.html",
  "/offline.html",
  "/css/styles.css",
  "/js/predictions.js",
  "/js/scripts.js",
  "/js/menu.js",
  "/js/chart.js",
  "/js/translations.js",
  "/js/themes.js",
  "/manifest.json",
  "/favicon.ico",
  "/locales/en.json",
  "/locales/ca.json",
  "/locales/cs.json",
  "/locales/de.json",
  "/locales/es.json",
  "/locales/fr.json",
  "/locales/gl.json",
  "/locales/hu.json",
  "/locales/id.json",
  "/locales/it.json",
  "/locales/ja.json",
  "/locales/ko.json",
  "/locales/nl.json",
  "/locales/ph.json",
  "/locales/pl.json",
  "/locales/pt-BR.json",
  "/locales/ru.json",
  "/locales/th.json",
  "/locales/ua.json",
  "/locales/zh-CN.json",
  "/locales/zh-TW.json",
  "/img/favicon-192.png",
  "/img/favicon-512.png",
  "/img/favicon-512-maskable.png",
];

self.addEventListener("install", function (event) {
  console.log("[PWA] Install Event processing");

  console.log("[PWA] Skip waiting on install");
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      console.log("[PWA] Caching pages during install");
      return cache.addAll(precacheFiles);
    })
  );
});

// Allow sw to control of current page and clean up old caches
self.addEventListener("activate", function (event) {
  console.log("[PWA] Claiming clients for current page");
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (cacheName) {
            return cacheName !== CACHE;
          })
          .map(function (cacheName) {
            console.log("[PWA] Deleting old cache: " + cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  const url = event.request.url;

  // CDN resources: cache-first (URLs are version-pinned, serve from cache when available)
  if (CDN_ORIGINS.some(function (origin) { return url.startsWith(origin); })) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          event.waitUntil(updateCache(event.request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests: network-first, fall back to cache, then offline page
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("/offline.html");
        });
      })
    );
    return;
  }

  // All other requests: network-first, cache fallback
  event.respondWith(
    (async () => {
      let response;
      try {
        response = await fetch(event.request);
        event.waitUntil(updateCache(event.request, response.clone()));
      } catch (error) {
        try {
          response = await fromCache(event.request);
        } catch (error) {
          console.log("[PWA] Network request failed and no cache." + error);
          throw error;
        }
      }
      return response;
    })()
  );
});

function fromCache(request) {
  // Check to see if you have it in the cache
  // Return response
  // If not in the cache, then return
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (matching) {
      if (!matching || matching.status === 404) {
        return Promise.reject("no-match");
      }

      return matching;
    });
  });
}

function updateCache(request, response) {
  if (!response || !response.ok) return Promise.resolve();
  return caches.open(CACHE).then(function (cache) {
    return cache.put(request, response);
  });
}

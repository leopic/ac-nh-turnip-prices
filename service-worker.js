// PWA Code adapted from https://github.com/pwa-builder/PWABuilder
const CACHE = "pwa-precache-v2";
const precacheFiles = [
  "/index.html",
  "/css/styles.css",
  "/js/predictions.js",
  "/js/scripts.js",
  "/js/chart.js",
  "/js/translations.js",
  "/js/themes.js",
  "/js/contributors.js",
  "/manifest.json",
  "/favicon.ico",
  "/locales/en.json",
  "/img/favicon-192.png",
  "/img/favicon-512.png",
  "https://code.jquery.com/jquery-3.7.1.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/i18next/25.5.2/i18next.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.3/Chart.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/i18next-http-backend/3.0.2/i18nextHttpBackend.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/i18next-browser-languagedetector/8.2.0/i18nextBrowserLanguageDetector.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jquery-i18next/1.2.1/jquery-i18next.min.js",
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

// If any fetch fails, it will look for the request in the cache and serve it from there first
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      let response;
      try {
        // Fetch from network first.
        response = await fetch(event.request);
        event.waitUntil(updateCache(event.request, response.clone()));
      } catch (error) {
        try {
          // Try if there's locally cached version.
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
  return caches.open(CACHE).then(function (cache) {
    return cache.put(request, response);
  });
}

const CACHE_NAME = 'manager-cache-v4.16';

const ASSETS = [
  '/manager/',
  '/manager/index.html',
  '/manager/manifest.json',
  '/manager/css/global.css',
  '/manager/css/dashboard.css',
  '/manager/css/spotlight.css',
  '/manager/js/app.js',
  '/manager/js/attendance/engine.js',
  '/manager/js/attendance/attendance.js',
  '/manager/settings.html',
  '/manager/js/spotlight/spotlight.js',
  '/manager/js/spotlight/parser.js',
  '/manager/js/spotlight/datetime.js',
  '/manager/js/spotlight/confidence.js',
  '/manager/js/spotlight/extractor.js',
  '/manager/js/spotlight/formatter.js',
  '/manager/js/services/spotlightService.js',
  '/manager/js/notifications/manager.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const shouldRefresh = request.mode === 'navigate' || ['script', 'style'].includes(request.destination);

  if (shouldRefresh) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      let response;
      try {
        response = await fetch(request);
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
      if (response.ok) {
        try {
          await cache.put(request, response.clone());
        } catch (error) {
          console.warn('Unable to update cached app asset:', error);
        }
      }
      return response;
    })());
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request);
    })
  );
});

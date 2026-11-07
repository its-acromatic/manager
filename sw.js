const CACHE_NAME = 'manager-cache-v4.14';

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
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

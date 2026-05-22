const CACHE_NAME = 'manager';

const urlsToCache = [
	'/manager/',
	'/manager/index.html',
	'/manager/manifest.json',

	'/manager/css/global.css',
	'/manager/css/dashboard.css',

	'/manager/js/app.js',

	'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js',
	'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.css'
];

self.addEventListener('install', (event) => {

	event.waitUntil(

		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(urlsToCache))

	);

	self.skipWaiting();

});

self.addEventListener('activate', (event) => {

	event.waitUntil(

		caches.keys().then((keys) => {

			return Promise.all(

				keys.map((key) => {

					if(key !== CACHE_NAME) {
						return caches.delete(key);
					}

				})

			);

		})

	);

	self.clients.claim();

});

self.addEventListener('fetch', (event) => {

	event.respondWith(

		caches.match(event.request)
			.then((response) => {

				return response || fetch(event.request);

			})

	);

});

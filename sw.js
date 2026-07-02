const CACHE_NAME = "greed0-v1.0.3";
const STATIC_ASSETS = [
	// Page
	"./",
	"./index.html",
	"./css/style.css",
	"./js/main.js",
	"./manifest.json",

	// App Icons
	"./assets/opengraph/logo.png",

	// UI Icons
	"./assets/icons/cloud-arrow-down-bold.svg",
	"./assets/icons/cloud-arrow-up-bold.svg",

	// Typography
	"./typography/Orbitron-Regular.woff2",
	"./typography/Orbitron-Bold.woff2",
	"./typography/Orbitron-SemiBold.woff2",
];

// Install
self.addEventListener("install", (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS);
		}),
	);
});

// Activate
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				);
			})
			.then(() => self.clients.claim()),
	);
});

// Fetch (cache-first)
self.addEventListener("fetch", (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			return response || fetch(event.request);
		}),
	);
});

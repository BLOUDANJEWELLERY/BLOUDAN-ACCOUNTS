const CACHE_NAME = 'nextjs-pwa-cache-v1';
const OFFLINE_URL = '/offline.html'; // <-- absolute path

const FILES_TO_CACHE = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/Favicon.PNG',
  '/icons/icons-192x192.PNG',
  '/icons/icons-512x512.PNG',
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(FILES_TO_CACHE);
    })()
  );
  self.skipWaiting();
});

// Fetch
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

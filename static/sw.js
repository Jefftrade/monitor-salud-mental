// Service Worker básico para el Asistente Virtual 3CB
const CACHE_NAME = '3cb-assistant-v1';
const urlsToCache = [
  '/',
  '/static/styles.css',
  '/static/js/chat.js',
  '/static/logo.svg'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        return response || fetch(event.request);
      }
    )
  );
});
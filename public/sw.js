const CACHE = 'cucu-v2';
const ASSETS = ['/', '/index.html', '/styles.css', '/client.js', '/manifest.json', '/icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
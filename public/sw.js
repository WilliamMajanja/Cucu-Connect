const CACHE = 'cucu-v5';
const ASSETS = ['./', './index.html', './styles.css', './client.js', './demo.js', './seed.json', './manifest.json', './icon.svg', './offline.html'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./offline.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('./offline.html'))));
});

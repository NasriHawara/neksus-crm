const CACHE_NAME = 'crm-v2'; // bumped version to force fresh install
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/calendar.js',
  '/js/clients.js',
  '/js/finances.js',
  '/js/invoices.js',
  '/js/projects.js',
  '/js/reports.js',
  '/js/tasks.js',
  '/js/utils.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // 👈 activate immediately, don't wait
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    // 👈 delete old caches from previous versions
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // 👈 take control of page right away
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response; // serve from cache if available

        return fetch(event.request).catch(() => {
          // 👈 if fetch fails (offline) and it's a page navigation, serve index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

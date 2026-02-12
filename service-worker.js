const CACHE_NAME = 'crm-v1';
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
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
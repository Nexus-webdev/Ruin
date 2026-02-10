// Not my code.

const CACHE_NAME = 'ruin_cache_v4';
const ASSETS = [
  '/Ruin/',
  '/Ruin/index.html',
  '/Ruin/Output.html',
  '/Ruin/Manager.html',
  '/Ruin/Editor.html',
  '/Ruin/file_opener.html',
  '/Ruin/manager-styles.css',
  '/Ruin/editor-styles.css',
  '/Ruin/output-styles.css',
  '/Ruin/syntax.js',
  '/Ruin/page.js',
  '/Ruin/addons/dom_flux.$',
  '/Ruin/bootstrapper.$',
  '/Ruin/flux.$',
  '/Ruin/icons/rre.png',
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

// Fetch: serve cache instantly, update in background
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For documents, ignore query params when caching
  const cacheKey = event.request.destination === 'document'
    ? url.pathname
    : url.pathname + url.search;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(cacheKey).then(cached => {
        // Kick off network fetch in background
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.ok) {
            cache.put(cacheKey, response.clone());
          }
          return response;
        }).catch(() => cached);

        // If we have cached content, return it immediately
        if (cached) {
          return cached;
        }

        // Otherwise, wait for network
        return networkFetch;
      })
    )
  );
});
// Not my code, AI made this.

const CACHE_NAME = 'ruin_cache_v5';
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

// Install: cache core assets and activate immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .catch(err => console.error('Cache install failed:', err))
  );
  self.skipWaiting();
});

// Activate: claim clients and clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  clients.claim();
});

// Fetch: stale‑while‑revalidate with fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For documents, ignore query params when caching
  const cacheKey = event.request.destination === 'document'
    ? url.pathname
    : url.pathname + url.search;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(cacheKey).then(cached => {
        // Start network fetch in background
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.ok) {
            cache.put(cacheKey, response.clone());
          }
          return response;
        }).catch(() => {
          // If network fails, fall back to cached or index.html
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return cache.match('/Ruin/index.html');
          }
        });

        // Serve cached immediately if available
        return cached || networkFetch;
      })
    )
  );
});
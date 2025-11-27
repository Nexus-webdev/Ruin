const prechache = 'precache-v1';
const runtime = 'runtime-v1';

"Predefined paths and URLs to precache";
const prechache_urls = [
 './',
 './index.html',
];

"Install: precache critical files";
self.addEventListener('install', e => {
 e.waitUntil(caches.open(prechache).then(cache => cache.addAll(prechache_urls)));
});

"Activate: cleanup old caches";
self.addEventListener('activate', e => {
 const cacheWhitelist = [prechache, runtime];
 e.waitUntil(caches.keys().then(keys =>
  Promise.all(keys.map(key => {
   if (cacheWhitelist.includes(key)) return;
   return caches.delete(key);
  }))
 ));
});

"Fetch: serve from cache, else fetch and cache dynamically";
self.addEventListener('fetch', e => {
 e.respondWith(caches.match(e.request).then(cachedResponse => {
  if (cachedResponse) return cachedResponse;
 
  "Otherwise, fetch from network and cache it";
  return caches.open(runtime).then(cache => {
   return fetch(e.request).then(response => {
    "Only cache valid responses (status 200, type basic)";
    if (response && response.status == 200 && response.type == 'basic')
    cache.put(e.request, response.clone());
    
    return response;
   }).catch(() => {
    "Optional: fallback for offline errors";
    if (e.request.destination == 'document')
    return caches.match('./index.html');
   })
  });
 }));
});
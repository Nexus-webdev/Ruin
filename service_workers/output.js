const cache_name = 'rre_cache_v1';
const assets = [
 '/Ruin/',
 '/Ruin/Output.html',
 '/Ruin/syntax.js',
 '/Ruin/page.js',
 
 '/Ruin/bootstrapper.$',
 '/Ruin/addons/foxx@dom.$',
 '/Ruin/addons/foxx.$',
 
 '/Ruin/icons/rre.png',
];

"Install event: cache files";
self.addEventListener('install', e => {
 e.waitUntil(caches.open(cache_name).then(cache => {
  return cache.addAll(assets);
 }));
});

"Fetch event: serve cached files";
self.addEventListener('fetch', e => {
 e.respondWith(caches.match(e.request).then(response => {
  return response || fetch(e.request);
 }));
});
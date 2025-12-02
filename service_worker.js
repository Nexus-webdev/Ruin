const cache_name = 'ruin_cache_v1';
const assets = [
 '/Ruin/',
 '/Ruin/index.html',
 '/Ruin/Output.html',
 '/Ruin/Manager.html',
 '/Ruin/Editor.html',
 
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
 console.log(e.request);
 e.respondWith(caches.match(e.request).then(response => {
  return response || fetch(e.request);
 }));
});
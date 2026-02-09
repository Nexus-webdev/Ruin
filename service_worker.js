const CACHE_NAME = 'ruin_cache_v1';
let offline = false;
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

"Install event: cache files";
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

"Activate event: cleanup old caches";
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key != CACHE_NAME).map(key => caches.delete(key)))));
});

"Fetch event: serve cached files";
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 const cache_key = url.pathname;
 
 console.log('Request: ', event.request);
 console.log('Cached Key: ', cached_key);
 console.log('Url: ', url);

 event.respondWith(caches.match(cache_key).then(cached => {
  console.log('Cached: ', cached);
  if (cached) return cached;
  
  return fetch(event.request).catch(() => {
   if (event.request.destination == 'document') return caches.match(cache_key) || caches.match('/Ruin/index.html');
  });
 }));
});
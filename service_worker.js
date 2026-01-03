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

"Fetch event: serve cached files ignoring query params";
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 const stripped = new Request(url.origin +url.pathname, { method: event.request.method, headers: event.request.headers });

 event.respondWith(caches.match(stripped).then(cached => {
  if (cached)
  {
   fetch(event.request).then(response => {
    if (response.ok)
    {
     caches.open(CACHE_NAME).then(cache => cache.put(stripped, response.clone()));
     offline = false;
    }
   }).catch(e => {
    if (!offline)
    {
     console.log('User Offline, falling back to cached resources');
     console.log(`%cEncountered Error: ${e.message}`, 'color: red');
    }
    
    offline = true;
   })
   
   return cached;
  }
  
  return fetch(event.request).catch(x => {
   if (event.request.destination == 'document') return caches.match('/Ruin/index.html');
  });
 }));
});
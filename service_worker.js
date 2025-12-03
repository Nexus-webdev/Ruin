const cache_name = 'ruin_cache_v1';
const assets = [
 '/Ruin/',
 '/Ruin/index.html',
 '/Ruin/Output.html',
 '/Ruin/Manager.html',
 '/Ruin/Editor.html',
 
 '/Ruin/manager-styles.css',
 '/Ruin/editor-styles.css',
 '/Ruin/output-styles.css',
 
 '/Ruin/syntax.js',
 '/Ruin/page.js',
 
 '/Ruin/bootstrapper.$',
 '/Ruin/addons/foxx@dom.$',
 '/Ruin/addons/foxx.$',
 
 '/Ruin/icons/rre.png',
];

async function online() {
 if (!navigator.onLine) return false;
 try {
  const response = await fetch('/ping.txt', { cache: 'no-store' });
  return response.ok;
 } catch (err) {
  return false;
 }
}

"Install event: cache files";
self.addEventListener('install', e => {
 e.waitUntil(caches.open(cache_name).then(cache => {
  return cache.addAll(assets);
 }));
});

"Fetch event: serve cached files";
self.addEventListener('fetch', e => {
 const url = new URL(e.request.url);
 "Strip query params for matching";
 const request = new Request(url.origin +url.pathname);
 
 e.respondWith(caches.match(request).then(async response => {
  const status = await online();
  return status ? fetch(e.request) : response;
 }));
});
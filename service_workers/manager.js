self.addEventListener('install', event => {
 event.waitUntil(caches.open('manager_cache_v1').then(cache => {
  cache.addAll([
   '/Ruin/',
   '/Ruin/Manager.html',
   '/Ruin/syntax.js',
   
   '/Ruin/icons/manager.png',
  ]);
 }));
});
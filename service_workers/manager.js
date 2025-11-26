self.addEventListener('install', event => {
 event.waitUntil(
  caches.open('v1').then(cache => {
   cache.addAll([
    '/Ruin/',
    '/Ruin/Manager.html',
    '/Ruin/syntax.js',
    
    '/Ruin/icons/manager.png',
   ]);
  })
 );
});
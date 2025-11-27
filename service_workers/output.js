self.addEventListener('install', e => {
 e.waitUntil(caches.open('v1').then(cache => {
  cache.addAll([
   '/Ruin/',
   '/Ruin/Output.html',
   '/Ruin/syntax.js',
   '/Ruin/page.js',
   
   '/Ruin/bootstrapper.$',
   '/Ruin/icons/rre.png',
  ]);
 }));
});
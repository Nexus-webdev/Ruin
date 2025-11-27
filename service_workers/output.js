self.addEventListener('install', event => {
 event.waitUntil(caches.open('v1').then(cache => {
  cache.addAll([
   '/Ruin/',
   '/Ruin/Output.html',
   '/Ruin/syntax.js',
   '/Ruin/page.js',
   
   '/Ruin/bootstrapper.$',
   '/Ruin/addons/foxx@dom.$',
   '/Ruin/addons/foxx.$',
   
   '/Ruin/icons/rre.png',
  ]);
 }));
});
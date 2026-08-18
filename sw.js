/* MEA Route Navigator — service worker
   Caches the app shell (HTML/manifest/icons) and the CDN libraries (Leaflet,
   PapaParse, XLSX, fonts) after their first successful load, so the app opens
   fast and works even with a weak signal. Live map tiles and routing-server
   requests are always sent to the network — those genuinely need to be fresh
   and shouldn't be served from cache. */

const CACHE_NAME = 'mea-route-nav-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const NEVER_CACHE_HOSTS = [
  'tile.openstreetmap.org',
  'valhalla1.openstreetmap.de',
  'router.project-osrm.org',
  'routing.openstreetmap.de'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(APP_SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys()
      .then(function(keys){ return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;

  var url = req.url;
  if(NEVER_CACHE_HOSTS.some(function(h){ return url.indexOf(h) !== -1; })){
    return; // let the browser handle it normally — always live
  }

  event.respondWith(
    caches.match(req).then(function(cached){
      var fetchPromise = fetch(req).then(function(networkResp){
        if(networkResp && networkResp.status===200){
          var copy = networkResp.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        }
        return networkResp;
      }).catch(function(){ return cached; });
      // cache-first for speed, but refresh in the background when online
      return cached || fetchPromise;
    })
  );
});

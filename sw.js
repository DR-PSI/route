/* Route Navigators — service worker (v2)
   Strategy:
   - App shell (this site's own HTML/manifest/icons): NETWORK-FIRST. Always
     tries to fetch the latest version first; only falls back to whatever is
     cached if there's no network. This is the fix for "I uploaded a new
     version but the phone still shows the old one" — v1 used cache-first
     for everything, which could show a stale copy for a full extra reload
     after every update.
   - Third-party CDN libraries (Leaflet, PapaParse, XLSX, fonts): CACHE-FIRST.
     These rarely change and caching them is what makes the app open fast /
     work on a weak connection.
   - Live map tiles and routing-server requests: NEVER cached, always network.
*/

const CACHE_NAME = 'route-navigators-v2'; // bumped so old (v1) caches get wiped below
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
    return; // always live — never cache map tiles or routing responses
  }

  var isOwnOrigin = url.indexOf(self.location.origin) === 0;
  var isAppShellFile = req.mode === 'navigate' ||
    url.endsWith('.html') || url.endsWith('manifest.json') ||
    url.endsWith('.png') || url.endsWith('sw.js');

  if(isOwnOrigin && isAppShellFile){
    // NETWORK-FIRST: always try to get the latest file; cache it for offline fallback only
    event.respondWith(
      fetch(req).then(function(networkResp){
        if(networkResp && networkResp.status===200){
          var copy = networkResp.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        }
        return networkResp;
      }).catch(function(){ return caches.match(req); })
    );
    return;
  }

  // CACHE-FIRST for everything else (CDN libraries, fonts, etc.)
  event.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(networkResp){
        if(networkResp && networkResp.status===200){
          var copy = networkResp.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        }
        return networkResp;
      });
    })
  );
});

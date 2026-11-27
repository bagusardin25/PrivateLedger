// Service worker for the installed app and for starting offline.
// vite.config.ts fills in VERSION and PRECACHE at build time, so every deploy
// ships a new worker that caches exactly the files of that build.
//
// It only ever handles this app's own files. Requests to Firebase AI Logic,
// App Check, and reCAPTCHA are not touched: they always go to the network and
// nothing they return is stored.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `private-ledger-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('private-ledger-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: the network first, so a new deploy shows up at once; the cached
  // shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/', { cacheName: CACHE })));
    return;
  }

  // Build files have a content hash in their name and never change, so the
  // cache can answer first.
  event.respondWith(
    caches.match(request, { cacheName: CACHE }).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith('/assets/')) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

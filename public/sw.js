/* Lima's service worker: the game opens fast on a second visit and plays on a weak or missing signal.
   - The page itself: from the network when there is one (so an update shows at once), else the copy kept here.
   - Build files with a hash in their name (they never change): kept here and served from here.
   - Pictures, icons and the font: served from here at once, and refreshed in the background. */

const CACHE = 'lima-v1';
const HASHED = /-[A-Za-z0-9_-]{8}\.(?:js|css|webp|png|jpe?g|svg|avif|woff2?)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const keep = (request, response) => {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
  }
  return response;
};

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !font) return;
  // design review and play-test pages are never cached
  if (url.searchParams.has('review') || url.searchParams.has('screen') || url.searchParams.has('dev')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(r => keep(request, r))
        .catch(async () => (await caches.match(request)) || (await caches.match(new URL('./', self.registration.scope).href)) || Response.error()),
    );
    return;
  }
  if (HASHED.test(url.pathname) || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(r => keep(request, r))));
    return;
  }
  event.respondWith(
    caches.match(request).then(hit => {
      const fresh = fetch(request)
        .then(r => keep(request, r))
        .catch(() => hit || Response.error());
      return hit || fresh;
    }),
  );
});

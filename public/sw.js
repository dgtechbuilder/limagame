/* TemoLima's service worker: the game opens fast on a second visit, and plays on a weak, slow or missing signal.

   The build (vite.config.ts) writes the game's file list into MANIFEST below: `core` (the first screens and the 3D
   farm), `rest` (every other activity and picture), the crop photos (full and light copies) and the files in public/
   with a hash of each.

   - Installing: the core is kept on the phone, one file at a time, so a dropped signal costs one file, not the lot.
   - The page itself: from the network if it answers within 3 seconds (so an update shows at once), else the copy kept
     here, while the network copy keeps loading in the background for next time. Offline: the copy kept here.
   - Build files with a hash in their name (they never change) and the files in public/ (by their hash in MANIFEST):
     served from the phone with no request at all. A public file is fetched again only when the build says it changed,
     never revalidated on every use (each check is a round trip, and data costs money).
   - `warm` (asked by the page, src/net/offline.ts): keeps the rest of the game, a few files at a time, and reports its
     progress, so a player can download the whole game where there is Wi-Fi and play it anywhere.
   - A new version keeps the files of the version before it too, so a game still open on the old version can carry
     on; anything older is cleared. */

const MANIFEST = /*__LIMA_MANIFEST__*/ null;

const FILES = 'lima-files'; // hashed build files: never change
const PUBLIC = 'lima-public'; // public/ files, kept under their content hash
const PAGES = 'lima-pages'; // the page itself
const META = 'lima-meta';
const KNOWN_KEY = 'known.json';
const NAV_TIMEOUT = 3000;

const scope = () => self.registration.scope;
const abs = p => new URL(p, scope()).href;
const publicPath = url => {
  if (!MANIFEST) return null;
  const rel = url.href.startsWith(scope()) ? url.href.slice(scope().length).split(/[?#]/)[0] : null;
  return rel && rel in MANIFEST.public ? rel : null;
};
const publicKey = rel => `${abs(rel)}?v=${MANIFEST.public[rel]}`;
const HASHED = /-[A-Za-z0-9_-]{8}\.(?:js|css|webp|png|jpe?g|svg|avif|woff2?)$/;

/** Keep one file (by its path in MANIFEST), unless it is already kept. Errors are swallowed: a flaky link skips it. */
async function keepFile(rel) {
  try {
    const pub = publicPath(new URL(abs(rel)));
    const cache = await caches.open(pub ? PUBLIC : FILES);
    const key = pub ? publicKey(pub) : abs(rel);
    if (await cache.match(key)) return true;
    const r = await fetch(abs(rel), { cache: pub ? 'no-cache' : 'default' });
    if (!r.ok) return false;
    await cache.put(key, r);
    return true;
  } catch {
    return false;
  }
}

/** Keep a list of files, `n` at a time; `onEach(done, total)` after each one. */
async function keepAll(list, n, onEach) {
  let i = 0;
  let done = 0;
  const worker = async () => {
    while (i < list.length) {
      const rel = list[i++];
      await keepFile(rel);
      done++;
      onEach?.(done, list.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, worker));
}

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      if (MANIFEST) {
        // the page first, then the core code and pictures, two at a time
        try {
          const page = await fetch(abs('./'), { cache: 'no-cache' });
          if (page.ok) await (await caches.open(PAGES)).put(abs('./'), page);
        } catch {
          /* offline while installing: the page is kept on the next visit */
        }
        await keepAll([...MANIFEST.core, ...MANIFEST.firstPublic], 2);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // caches from the first service worker (one cache for everything)
      for (const key of await caches.keys()) if (![FILES, PUBLIC, PAGES, META].includes(key)) await caches.delete(key);
      if (MANIFEST) {
        const meta = await caches.open(META);
        const prev = await meta.match(KNOWN_KEY).then(r => (r ? r.json() : null)).catch(() => null);
        const now = {
          build: MANIFEST.build,
          files: [...MANIFEST.core, ...MANIFEST.rest, ...MANIFEST.photos, ...MANIFEST.lite].map(abs),
          public: Object.keys(MANIFEST.public).map(publicKey),
        };
        if (!prev || prev.build !== MANIFEST.build) {
          // keep this version's files and the version before's; clear anything older
          const keepFiles = new Set([...now.files, ...(prev?.files ?? [])]);
          const keepPublic = new Set([...now.public, ...(prev?.public ?? [])]);
          const files = await caches.open(FILES);
          for (const req of await files.keys()) if (!keepFiles.has(req.url)) await files.delete(req);
          const pub = await caches.open(PUBLIC);
          for (const req of await pub.keys()) if (!keepPublic.has(req.url)) await pub.delete(req);
          // the version before's lists are merged in only once, so a third version clears the first
          await meta.put(KNOWN_KEY, new Response(JSON.stringify(now), { headers: { 'Content-Type': 'application/json' } }));
        }
      }
      await self.clients.claim();
    })(),
  );
});

/* ---------------- serving ---------------- */

async function page(request) {
  const cache = await caches.open(PAGES);
  const kept = (await cache.match(request, { ignoreSearch: true })) || (await cache.match(abs('./')));
  const network = fetch(request).then(async r => {
    if (r.ok) await cache.put(abs('./'), r.clone());
    return r;
  });
  if (!kept) return network.catch(() => Response.error());
  // a slow link: the kept copy after 3 seconds; the network copy keeps loading and is kept for next time
  const late = new Promise(resolve => setTimeout(() => resolve(kept), NAV_TIMEOUT));
  // a server error (the host down for a moment) gives the kept copy too
  return Promise.race([network.then(r => (r.ok ? r : kept), () => kept), late]);
}

async function fromPhone(request, cacheName, key) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(key);
  if (hit) return hit;
  const r = await fetch(request);
  if (r.ok) cache.put(key, r.clone()).catch(() => {});
  return r;
}

async function networkThenPhone(request) {
  const cache = await caches.open(PUBLIC);
  try {
    const r = await fetch(request);
    if (r.ok) cache.put(request, r.clone()).catch(() => {});
    return r;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // design review and play-test pages are never cached; nor the page's own update check
  if (url.searchParams.has('review') || url.searchParams.has('screen') || url.searchParams.has('dev') || url.searchParams.has('fresh')) return;

  if (request.mode === 'navigate') {
    event.respondWith(page(request));
    return;
  }
  const pub = publicPath(url);
  if (pub) {
    event.respondWith(fromPhone(request, PUBLIC, publicKey(pub)));
    return;
  }
  if (HASHED.test(url.pathname)) {
    event.respondWith(fromPhone(request, FILES, url.href.split(/[?#]/)[0]));
    return;
  }
  event.respondWith(networkThenPhone(request));
});

/* ---------------- the page's questions: how much is kept, and keep the rest ---------------- */

async function status() {
  if (!MANIFEST) return { build: null };
  const files = await caches.open(FILES);
  const pub = await caches.open(PUBLIC);
  const count = async list => {
    let n = 0;
    for (const rel of list) {
      const p = publicPath(new URL(abs(rel)));
      if (p ? await pub.match(publicKey(p)) : await files.match(abs(rel))) n++;
    }
    return n;
  };
  const game = [...MANIFEST.core, ...MANIFEST.rest, ...Object.keys(MANIFEST.public).filter(p => !MANIFEST.hires.includes(p) && p !== 'sw.js')];
  return {
    build: MANIFEST.build,
    game: { kept: await count(game), total: game.length },
    photos: { kept: await count(MANIFEST.photos), total: MANIFEST.photos.length },
    lite: { kept: await count(MANIFEST.lite), total: MANIFEST.lite.length },
  };
}

let warming = null;

// the daily sell reminder (src/produce/remind.ts): a tap opens the game on the market stall
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = abs(event.notification.data?.url || './');
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const c = open.find(w => w.url.startsWith(scope()));
      if (c) {
        await c.focus();
        return c.navigate ? c.navigate(url).catch(() => undefined) : undefined;
      }
      return self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('message', event => {
  const data = event.data || {};
  const reply = msg => event.source && event.source.postMessage(msg);
  if (data.type === 'status') {
    event.waitUntil(status().then(s => reply({ type: 'lima-status', ...s })));
    return;
  }
  if (data.type === 'warm' && MANIFEST) {
    const list = [
      ...MANIFEST.core,
      ...MANIFEST.rest,
      ...Object.keys(MANIFEST.public).filter(p => p !== 'sw.js' && (data.hires || !MANIFEST.hires.includes(p))),
      ...(data.photos === 'full' ? MANIFEST.photos : data.photos === 'lite' ? MANIFEST.lite : []),
    ];
    warming ??= keepAll(list, data.photos ? 3 : 2, (done, total) => reply({ type: 'lima-warm', done, total })).finally(() => {
      warming = null;
    });
    event.waitUntil(warming.then(() => status()).then(s => reply({ type: 'lima-warm-done', ...s })));
  }
});

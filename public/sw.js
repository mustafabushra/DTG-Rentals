// DTG Rentals Service Worker
// Cache strategy: cache-first for static assets, network-first for HTML

const CACHE_VERSION = 'dtg-v2';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Minimal logging — navigation events only, no postMessage broadcast.
// Broadcasting to clients on every cache-hit floods the message queue with
// 100+ messages per page load and freezes DevTools on second visit.
const DIAG = {
  log(tag, msg, data) {
    if (tag === 'NET-FIRST' || tag === 'INSTALL' || tag === 'ACTIVATE' || tag === 'MESSAGE') {
      console.log(`[SW][${tag}] ${msg}` + (data ? ' ' + JSON.stringify(data) : ''));
    }
    // NO postMessage broadcast — was the root cause of browser/DevTools freeze
  }
};

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/login',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
];

// URL patterns → cache strategy
const CACHE_STRATEGIES = {
  // JS/CSS/fonts → cache-first (long-lived, content-hashed filenames)
  static: /\/_expo\/static\/|\/assets\/|\.woff2?$|\.ttf$/,
  // HTML pages → network-first (always try to get fresh version)
  html:   /\.html$|^\/[^.]*$/,
  // Firebase → skip (auth/firestore go to network only)
  bypass: /firestore\.googleapis|identitytoolkit|firebase/,
};

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  DIAG.log('INSTALL', 'SW installing', { version: CACHE_VERSION, time: new Date().toISOString() });
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(PRECACHE_URLS)
        .then(() => DIAG.log('INSTALL', 'Precache complete', { urls: PRECACHE_URLS }))
        .catch(err => {
          DIAG.log('INSTALL', 'Precache partial failure (non-fatal)', { error: String(err) });
        })
    )
  );
});

// ── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  DIAG.log('ACTIVATE', 'SW activating', { version: CACHE_VERSION });
  event.waitUntil(
    caches.keys().then(keys => {
      DIAG.log('ACTIVATE', 'Existing caches', { keys });
      const toDelete = keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE);
      DIAG.log('ACTIVATE', 'Caches to delete', { toDelete });
      return Promise.all(toDelete.map(k => caches.delete(k)));
    }).then(() => {
      DIAG.log('ACTIVATE', 'Claiming clients');
      return self.clients.claim();
    })
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Skip Firebase API calls entirely — always network
  if (CACHE_STRATEGIES.bypass.test(request.url)) return;

  if (CACHE_STRATEGIES.static.test(request.url)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request, request.mode === 'navigate'));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, log = false) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const t0 = Date.now();
    const response = await fetch(request);
    if (log) DIAG.log('NET-FIRST', 'Network SUCCESS', { url: request.url, status: response.status, ms: Date.now() - t0 });
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (log) DIAG.log('NET-FIRST', 'Network FAILED — checking cache', { url: request.url, error: String(err) });
    const cached = await cache.match(request);
    if (cached) {
      if (log) DIAG.log('NET-FIRST', 'Serving from DYNAMIC cache', { url: request.url });
      return cached;
    }
    // Fallback to cached index for SPA navigation
    const indexCached = await caches.match('/');
    if (indexCached) {
      if (log) DIAG.log('NET-FIRST', 'Serving STALE / as fallback', { url: request.url });
      return indexCached;
    }
    if (log) DIAG.log('NET-FIRST', 'Serving offline.html', { url: request.url });
    return caches.match('/offline.html') ??
      new Response('<h1>لا يوجد اتصال</h1>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 503,
      });
  }
}

// ── Background Sync placeholder ──────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    DIAG.log('MESSAGE', 'Received SKIP_WAITING');
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION')  event.ports[0].postMessage(CACHE_VERSION);

  // DIAGNOSTIC: dump cache contents on demand
  if (event.data?.type === 'DIAG_DUMP_CACHES') {
    caches.keys().then(async keys => {
      const result = {};
      for (const key of keys) {
        const cache = await caches.open(key);
        const reqs  = await cache.keys();
        result[key] = reqs.map(r => r.url);
      }
      DIAG.log('DIAG', 'Cache dump', result);
      if (event.ports[0]) event.ports[0].postMessage(result);
    });
  }
});

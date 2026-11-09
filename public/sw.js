/* Hommi service worker: app shell that opens offline, safe read-only API cache, web push. */
const STATIC = 'hommi-static-v3';
const PAGES = 'hommi-pages-v3';
const API = 'hommi-api-v2';
const OFFLINE_URL = '/offline.html';
const KEEP = [STATIC, PAGES, API];
// Only these lists are cached for offline reading. Documents, chat, medicine, attachments and money are never cached.
const CACHEABLE_API = /^\/api\/(dashboard|tasks|grocery|meals|recipes|bills|bill-instances|special-dates|guests|contacts)(\/|\?|$)/;
// The dashboard response also carries private fields: they are removed before anything is stored.
const PRIVATE_DASHBOARD_FIELDS = ['medicinesDueToday', 'wallet', 'upcomingEmi'];

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, '/icon-192.png', '/favicon.ico', '/favicon.svg', '/icon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => {
  if (e.data === 'clear-private-cache') e.waitUntil(Promise.all([caches.delete(API), caches.delete(PAGES)]));
});

async function storeApi(key, res, isDashboard) {
  let body = await res.clone().text();
  if (isDashboard) {
    try { const j = JSON.parse(body); PRIVATE_DASHBOARD_FIELDS.forEach((f) => delete j[f]); body = JSON.stringify(j); } catch { return; }
  }
  const c = await caches.open(API);
  await c.put(key, new Response(body, { headers: { 'Content-Type': 'application/json', 'X-From-Cache': '1' } }));
  trim(API, 60);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (CACHEABLE_API.test(url.pathname)) {
    // Network first; fall back to the last copy for the same family so lists still open without a connection.
    const key = new Request(`${url.pathname}${url.search}#${req.headers.get('x-family-id') || ''}`);
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) e.waitUntil(storeApi(key, res, url.pathname === '/api/dashboard'));
        return res;
      }).catch(async () => (await caches.open(API).then((c) => c.match(key))) || new Response(JSON.stringify({ error: 'You are offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })),
    );
    return;
  }
  if (url.pathname.startsWith('/api/')) return; // everything else goes straight to the network

  if (/\.(png|svg|ico)$/.test(url.pathname)) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((res) => { if (res.ok) { c.put(req, res.clone()); trim(STATIC, 250); } return res; })));
    return;
  }

  if (req.mode === 'navigate') {
    // Network first so people always get the newest app; a page they opened before still opens offline.
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(PAGES).then((c) => { c.put(req, copy); trim(PAGES, 25); }); }
        return res;
      }).catch(async () => (await caches.open(PAGES).then((c) => c.match(req))) || caches.match(OFFLINE_URL)),
    );
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Hommi', body: e.data?.text() }; }
  const target = d.familyId ? `/open?family=${encodeURIComponent(d.familyId)}&to=${encodeURIComponent(d.url || '/dashboard')}` : d.url || '/dashboard';
  e.waitUntil(self.registration.showNotification(d.title || 'Hommi', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag || 'hommi', data: { target },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.target || '/dashboard';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.navigate(target); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});

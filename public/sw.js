/* Hommi service worker: offline shell, safe read-only API cache, web push. */
const STATIC = 'fh-static-v1';
const API = 'fh-api-v1';
const OFFLINE_URL = '/offline.html';
// Only these lists are cached for offline reading. Documents, chat, medicine, attachments and money are never cached.
const CACHEABLE_API = /^\/api\/(dashboard|tasks|grocery|meals|recipes|bills|bill-instances|special-dates|guests|contacts)(\/|\?|$)/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, '/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, API].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'clear-private-cache') e.waitUntil(caches.delete(API));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (CACHEABLE_API.test(url.pathname)) {
    // Network first; fall back to the last copy for the same family so lists still open without a connection.
    const key = new Request(`${url.pathname}${url.search}#${req.headers.get('x-family-id') || ''}`);
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(API).then((c) => c.put(key, copy)); }
        return res;
      }).catch(async () => (await caches.open(API).then((c) => c.match(key))) || new Response(JSON.stringify({ error: 'You are offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })),
    );
    return;
  }
  if (url.pathname.startsWith('/api/')) return; // everything else goes straight to the network

  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
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

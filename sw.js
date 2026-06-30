// Bump this whenever you want to force-clear old installs
const CACHE = 'fam-exp-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }));
  })());
});

// Always go to the network, bypassing HTTP cache, so installed devices
// never get stuck on a stale build. No offline caching — freshness first.
self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return; // never touch API calls
  e.respondWith(fetch(e.request, { cache: 'no-store' }));
});

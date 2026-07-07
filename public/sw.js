// APG emergency service worker restore.
// P0: clear stale PWA caches and unregister so the app loads directly from network.
const RESTORE_VERSION = 'apg-p0-disable-sw-20260708';

async function clearAllCaches() {
  if (!self.caches) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(clearAllCaches());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    clearAllCaches()
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) => Promise.all(clients.map((client) => client.navigate(client.url))))
      .catch(() => null)
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'APG_CLEAR_SW_CACHE') return;
  event.waitUntil(
    clearAllCaches().then(() => event.source?.postMessage?.({
      type: 'APG_SW_CACHE_CLEARED',
      version: RESTORE_VERSION,
    }))
  );
});

self.addEventListener('fetch', () => {
  return;
});

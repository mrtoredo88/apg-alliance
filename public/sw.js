const SW_VERSION = 'apg-universal-links-20260710';

async function clearAllCaches() {
  if (!self.caches) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'APG_SW_DIAGNOSTICS') {
    event.waitUntil(
      caches.keys().then((keys) => event.source?.postMessage?.({
        type: 'APG_SW_DIAGNOSTICS_RESULT',
        version: SW_VERSION,
        cacheKeys: keys,
      }))
    );
    return;
  }
  if (event.data?.type !== 'APG_CLEAR_SW_CACHE') return;
  event.waitUntil(
    clearAllCaches().then(() => event.source?.postMessage?.({
      type: 'APG_SW_CACHE_CLEARED',
      version: SW_VERSION,
    }))
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate') return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) return response;
        return fetch('/index.html', { cache: 'no-store' });
      })
      .catch(() => fetch('/index.html', { cache: 'no-store' }))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const notification = payload.notification || payload;
  const data = payload.data || {};
  const title = notification.title || data.title || 'АПГ';
  const options = {
    body: notification.body || data.body || '',
    icon: notification.icon || '/192.png',
    badge: notification.badge || '/32.png',
    image: notification.image || data.image || undefined,
    tag: notification.tag || data.tag || 'apg-push',
    renotify: true,
    data: {
      url: data.url || notification.click_action || '/',
      notificationId: data.notificationId || '',
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const absoluteUrl = new URL(targetUrl, self.location.origin).href;
        const existing = clients.find((client) => client.url.startsWith(self.location.origin));
        if (existing) {
          existing.focus();
          if ('navigate' in existing) return existing.navigate(absoluteUrl);
          return undefined;
        }
        return self.clients.openWindow(absoluteUrl);
      })
      .catch(() => self.clients.openWindow('/'))
  );
});

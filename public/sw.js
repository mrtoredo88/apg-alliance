// APG Service Worker — local-production friendly cache strategy.
const CACHE_VERSION = 'apg-v5-vk-sync-20260707';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE = [
  '/',
  '/manifest.json',
  '/version.json',
  '/192.png',
  '/512.png',
  '/180.png',
];

const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'fcmregistrations.googleapis.com',
  'vk.com',
  'vkontakte.ru',
  'api.vk.com',
];

const NO_STORE_PATHS = new Set([
  '/sw.js',
  '/manifest.json',
  '/version.json',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))).catch(() => null)
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'APG_CLEAR_SW_CACHE') return;
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => event.source?.postMessage?.({ type: 'APG_SW_CACHE_CLEARED' }))
  );
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match('/');
    if (shell) return shell;
    return new Response('Нет соединения', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);
  return cached || refresh || new Response('Нет соединения', { status: 503 });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (BYPASS_HOSTS.some((host) => url.hostname.includes(host))) return;
    return;
  }

  if (url.pathname.startsWith('/@')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (NO_STORE_PATHS.has(url.pathname)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { return; }

  const notification = payload.notification ?? {};
  const data = payload.data ?? {};
  const title = notification.title ?? 'АПГ';
  const body = notification.body ?? '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/192.png',
      badge: '/32.png',
      image: '/logo.webp',
      data,
      tag: data.tag ?? 'apg-push',
      renotify: true,
      requireInteraction: false,
      actions: [
        { action: 'open', title: 'Открыть приложение' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/#/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

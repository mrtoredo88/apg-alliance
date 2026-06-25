// APG Service Worker — cache-first for static, pass-through for Firebase
const CACHE = 'apg-v1';

const PRECACHE = [
  '/',
  '/manifest.json',
  '/192.png',
  '/512.png',
  '/180.png',
];

// Hosts to never cache — always fetch live
const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'fcmregistrations.googleapis.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'vk.com',
  'vkontakte.ru',
  'api.vk.com',
  'i.ibb.co',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;

  // Only handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Pass through cross-origin or bypass hosts
  if (url.origin !== self.location.origin) {
    if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;
    // Other cross-origin (CDN, etc.) — also skip
    return;
  }

  // Navigation requests — browser handles natively (avoids redirect overhead in Lighthouse)
  if (request.mode === 'navigate') return;

  // Pass through Vite HMR / dev server events
  if (url.pathname.startsWith('/@')) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;

      try {
        const res = await fetch(request);
        // Cache successful same-origin responses (assets, pages)
        if (res.ok && res.status < 400) {
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          const fallback = await cache.match('/');
          if (fallback) return fallback;
        }
        return new Response('Нет соединения', { status: 503 });
      }
    })
  );
});

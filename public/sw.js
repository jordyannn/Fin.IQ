// Fin.IQ Progressive Web App · Service Worker
const CACHE_VERSION = 'v1.0.1';
const CACHE_PREFIX = 'finiq-';
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}dynamic-${CACHE_VERSION}`;

// Pre-cached App Shell resources
const APP_SHELL = [
  '/offline.html',
  '/manifest.json',
  '/icon.svg',
];

// Install: Pre-cache static assets and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from our own origin
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // CRITICAL SECURITY RULE: Never cache dynamic API or tRPC requests (private financial data)
  if (url.pathname.startsWith('/api') || url.pathname.includes('trpc')) {
    return;
  }

  // Strategy 1: HTML Navigation Requests -> Network-First with Offline Fallback
  if (request.mode === 'navigate' || request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const fallback = await caches.match('/offline.html');
          return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // Strategy 2: Static Assets (Next.js chunks, CSS, JS, fonts, images) -> Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(css|js|woff2|woff|ttf|png|jpg|jpeg|svg|webp|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => {
          return new Response('', { status: 408 });
        });
      })
    );
    return;
  }
});

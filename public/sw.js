const CACHE = 'fubao-shell-v10';
const SHELL = [
  '/offline.html',
  '/favicon.png',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('fubao-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Account-specific HTML, APIs and private photos must never enter a shared offline cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match('/offline.html');
        // Workers Assets normalizes .html URLs with a redirect. Navigation requests use
        // redirect: manual, so return a fresh response instead of the redirected cache entry.
        return offline
          ? new Response(await offline.arrayBuffer(), { status: 200, headers: offline.headers })
          : Response.error();
      }),
    );
    return;
  }
  if (SHELL.includes(url.pathname) || url.pathname.startsWith('/_astro/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          event.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      }),
    );
  }
});

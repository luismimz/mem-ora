// Service worker de Memora (D-054): guarda la app en el dispositivo para abrirla sin conexión.
// - Páginas: primero la red; sin red, la copia guardada de index.html (todas las rutas son la misma app).
// - Recursos de /assets (con huella en el nombre): de la caché, y si no están, de la red y se guardan.
// - La API (/api) nunca se guarda aquí: el progreso es del servidor y lo offline va por la cola de la app.
const CACHE = 'memora-app-v1';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch('/', { cache: 'no-store' });
    const html = await res.clone().text();
    await cache.put('/index.html', res);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await Promise.all(assets.map((a) => cache.add(a).catch(() => undefined)));
    await cache.addAll(['/manifest.webmanifest', '/icon.svg']).catch(() => undefined);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put('/index.html', res.clone());
        return res;
      } catch {
        return (await caches.match('/index.html')) ?? Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/icon.svg') {
    event.respondWith((async () => {
      const hit = await caches.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) (await caches.open(CACHE)).put(event.request, res.clone());
      return res;
    })());
  }
});

// Service worker de Memora (D-054). Se llama sw-v2.js porque Cloudflare guardó el antiguo /sw.js 30 días (D-074).
// Si vuelve a pasar, sube el número (sw-v3.js) en main.tsx.: guarda la app en el dispositivo para abrirla sin conexión.
// - Páginas: primero la red; sin red, la copia guardada de index.html (todas las rutas son la misma app).
// - Recursos de /assets (con huella en el nombre): de la caché, y si no están, de la red y se guardan.
// - Voz Kokoro (/audio): el índice, primero de la red y, sin red, la última copia. Los MP3 NO pasan por aquí: Safari
//   los pide por trozos (Range) y servirlos desde aquí puede dejarlos mudos en el iPhone; los guarda la caché normal
//   del navegador (nginx los marca para un año: el nombre lleva la huella del texto y no cambian).
// - La API (/api) nunca se guarda aquí: el progreso es del servidor y lo offline va por la cola de la app.
const CACHE = 'memora-app-v2';
const AUDIO = 'memora-audio-v1';

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
    for (const k of await caches.keys()) if (k !== CACHE && k !== AUDIO) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE);
        cache.put('/index.html', res.clone());
        return res;
      } catch {
        return (await caches.match('/index.html')) ?? Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/audio/') && url.pathname.endsWith('/index.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO);
      try {
        const res = await fetch(event.request, { cache: 'no-store' });
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch {
        return (await cache.match(event.request)) ?? Response.error();
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

// Aviso de repaso en el móvil (D-077): el servidor solo «toca el timbre» (sin contenido); aquí se pide el texto con la
// sesión del alumno y se muestra. Si no hay red, un texto genérico. Tocar el aviso abre (o enfoca) Memora.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let m = { title: 'Memora', body: 'Tienes repasos listos: unos minutos y no se te olvida.', url: '/' };
    try {
      const r = await fetch('/api/memora/push/message', { credentials: 'include', cache: 'no-store' });
      if (r.ok) m = { ...m, ...((await r.json()).data ?? {}) };
    } catch { /* sin red: texto genérico */ }
    await self.registration.showNotification(m.title, { body: m.body, icon: '/icon.svg', badge: '/icon.svg', tag: 'memora-repaso', renotify: true, data: { url: m.url } });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = open.find((c) => new URL(c.url).origin === location.origin);
    if (mine) { await mine.focus(); return; }
    await self.clients.openWindow(url);
  })());
});

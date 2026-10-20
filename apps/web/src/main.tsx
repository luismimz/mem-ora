import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Guardar la app en el dispositivo para abrirla sin conexión (solo en producción; en desarrollo molestaría a Vite).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined));
}

// D-074: si hay una versión nueva publicada, se carga sola al volver a la app, sin cortar una ronda en marcha.
if (import.meta.env.PROD) {
  const current = [...document.scripts].map((s) => s.src.match(/\/assets\/index-[^/]+\.js/)?.[0]).find(Boolean);
  const check = async () => {
    try {
      const html = await (await fetch('/', { cache: 'no-store' })).text();
      const latest = html.match(/\/assets\/index-[^"]+\.js/)?.[0];
      if (!current || !latest || latest === current) return;
      void navigator.serviceWorker?.getRegistration().then((r) => r?.update());
      // En mitad de una ronda no se interrumpe: se recarga al salir de ella.
      if (!location.pathname.startsWith('/sesion')) location.reload();
      else {
        // Al salir de la ronda (cualquier navegación fuera de /sesion), se carga la versión nueva.
        const push = history.pushState.bind(history);
        history.pushState = (...args: Parameters<History['pushState']>) => { push(...args); if (!location.pathname.startsWith('/sesion')) location.reload(); };
        window.addEventListener('popstate', () => { if (!location.pathname.startsWith('/sesion')) location.reload(); });
      }
    } catch { /* sin red: se intentará la próxima vez */ }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check(); });
  setInterval(() => void check(), 5 * 60 * 1000);
}

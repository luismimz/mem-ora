import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En local la app se sirve en 127.0.0.1 (no localhost) para que su cookie de sesión no se pise con la del panel de
// Directus en localhost:8055 (las cookies no distinguen puertos). Directus se alcanza por /api en el mismo origen (D-032).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:8055', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  // `vite preview` sirve la versión de producción (con service worker) para probar el modo sin conexión en local.
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:8055', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
});

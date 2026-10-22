// Empaqueta las dos extensiones de Directus (y los paquetes del monorepo que usan) en archivos sueltos:
//   memora      → hook de Studio (validación, flujo de estados, historial)
//   memora-api  → endpoint /memora para la app del alumno
//   memora-push → aviso de repaso en el móvil (D-077)
//   memora-content → vuelca los cursos de content/ al arrancar (D-080)
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const targets = [
  { name: 'memora', type: 'hook', entry: './src/studio/index.ts' },
  { name: 'memora-api', type: 'endpoint', entry: './src/api/endpoint.ts' },
  { name: 'memora-push', type: 'hook', entry: './src/push/index.ts' },
  { name: 'memora-content', type: 'hook', entry: './src/content/index.ts' },
];
for (const t of targets) {
  const out = fileURLToPath(new URL(`../../extensions-dist/${t.name}/`, import.meta.url));
  mkdirSync(`${out}dist`, { recursive: true });
  await build({ entryPoints: [fileURLToPath(new URL(t.entry, import.meta.url))], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: `${out}dist/index.js`, logLevel: 'warning' });
  writeFileSync(`${out}package.json`, JSON.stringify({ name: t.name, version: '0.2.0', type: 'module', 'directus:extension': { type: t.type, path: 'dist/index.js', source: 'src/index.ts', host: '^12.0.0' } }, null, 2));
}
console.log(`Extensiones empaquetadas: ${targets.map((t) => t.name).join(', ')}`);

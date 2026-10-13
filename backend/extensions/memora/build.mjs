// Empaqueta la extensión (y los paquetes del monorepo que usa) en un solo archivo para Directus.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../../extensions-dist/memora/', import.meta.url));
mkdirSync(`${out}dist`, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('./src/index.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: `${out}dist/index.js`,
  logLevel: 'warning',
});
writeFileSync(
  `${out}package.json`,
  JSON.stringify(
    { name: 'memora', version: '0.1.0', type: 'module', 'directus:extension': { type: 'hook', path: 'dist/index.js', source: 'src/index.ts', host: '^11.0.0' } },
    null,
    2,
  ),
);
console.log('Extensión empaquetada en backend/extensions-dist/memora');

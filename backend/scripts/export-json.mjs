// Exportación completa a JSON, independiente del panel (requisito previo al H2.4). Guarda en backend/backups/export-<fecha>/:
// - un archivo por curso, en el formato de importación (D-041), para recrearlo en cualquier instancia;
// - los datos de los alumnos (eventos de aprendizaje, posiciones de sesión y planes del día). El estado se recalcula
//   a partir de los eventos, así que con ellos basta para reconstruir el progreso.
// Uso: pnpm backend:export (Directus en marcha). Lee ADMIN_TOKEN de backend/.env; no imprime secretos.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = Object.fromEntries(readFileSync(`${root}.env`, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const token = env.ADMIN_TOKEN;
if (!token) throw new Error('Falta ADMIN_TOKEN en backend/.env (pnpm backend:env).');

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()).data;
}
async function all(collection) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const batch = await get(`/items/${collection}?limit=500&page=${page}&sort=id`);
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = `${root}backups/export-${stamp}`;
mkdirSync(`${dir}/cursos`, { recursive: true });
for (const c of await get('/memora/studio/courses')) {
  writeFileSync(`${dir}/cursos/${c.key}.json`, JSON.stringify(await get(`/memora/export/${c.id}`), null, 2));
  console.log(`✓ curso ${c.key}`);
}
const learners = {};
for (const collection of ['learning_events', 'session_positions', 'daily_plans']) learners[collection] = await all(collection);
writeFileSync(`${dir}/alumnos.json`, JSON.stringify({ exportedAt: new Date().toISOString(), ...learners }, null, 2));
console.log(`✓ alumnos: ${learners.learning_events.length} eventos`);
console.log(`Exportación en backend/backups/export-${stamp}/`);

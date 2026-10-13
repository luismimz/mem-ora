// Aplica schema/snapshot.json a través de la API del servidor (/schema/diff y /schema/apply).
// En Directus 12, aplicar con la CLI dentro del contenedor no actualiza el esquema en memoria del servidor en marcha
// (las colecciones nuevas dan 403 hasta reiniciar); por la API el servidor lo aplica y lo recarga él mismo.
// Lo llama scripts/schema-apply.sh, que hace antes la copia de seguridad (regla 8).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) throw new Error('Falta ADMIN_TOKEN.');
const snapshot = JSON.parse(readFileSync(fileURLToPath(new URL('../schema/snapshot.json', import.meta.url)), 'utf8'));
const headers = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };

const diffRes = await fetch(`${BASE}/schema/diff?force=false`, { method: 'POST', headers, body: JSON.stringify(snapshot) });
if (diffRes.status === 204) {
  console.log('El esquema ya coincide con la instantánea: no hay cambios que aplicar.');
  process.exit(0);
}
const diffJson = await diffRes.json();
if (!diffRes.ok) throw new Error(`/schema/diff → ${diffRes.status}: ${JSON.stringify(diffJson.errors)}`);
const { diff } = diffJson.data;
const count = (diff.collections?.length ?? 0) + (diff.fields?.length ?? 0) + (diff.relations?.length ?? 0);
const applyRes = await fetch(`${BASE}/schema/apply`, { method: 'POST', headers, body: JSON.stringify(diffJson.data) });
if (!applyRes.ok) throw new Error(`/schema/apply → ${applyRes.status}: ${JSON.stringify((await applyRes.json().catch(() => ({}))).errors)}`);
console.log(`Instantánea aplicada (${count} diferencias: colecciones, campos y relaciones).`);

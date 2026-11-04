// Viñetas de las asociaciones (D-114), pregeneradas con fal a través del servidor (la clave FAL_KEY solo vive allí).
// Recorre content/<curso>/*.json, pide una viñeta por cada unidad con asociación y la guarda como <huella>.jpg con un
// índice clave de unidad → archivo (index.json). Reanudable: lo que ya está en el índice con la misma huella no se pide.
// Uso (con un token de administración, nunca se imprime):
//   node --env-file=backend/.env.production tools/images/generate.mjs --course ingles-1000 --out DIR [--limit N] [--only k1,k2]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const course = arg('course', 'ingles-1000');
const contentDir = arg('content', join(ROOT, 'content'));
const out = arg('out', join(ROOT, 'apps', 'web', 'public', 'img', 'en'));
const limit = Number(arg('limit', '100000'));
const only = arg('only', '') ? new Set(arg('only').split(',')) : null;
const STYLE_VERSION = 'comic-b-1';
const B = process.env.DIRECTUS_URL; const T = process.env.ADMIN_TOKEN;
if (!B || !T) throw new Error('Faltan DIRECTUS_URL o ADMIN_TOKEN en el entorno.');

const units = [];
for (const f of readdirSync(join(contentDir, course)).filter((x) => x.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(join(contentDir, course, f), 'utf8'));
  for (const m of d.modules) for (const u of m.units) {
    const scene = u.association?.scene;
    if (!scene || (only && !only.has(u.key))) continue;
    const target = u.text ?? u.form ?? u.goal ?? u.name;
    const meaning = u.meaning ?? u.goal ?? u.gist ?? '';
    if (target && meaning) units.push({ key: u.key, target, meaning, scene });
  }
}
mkdirSync(out, { recursive: true });
const idxFile = join(out, 'index.json');
const index = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf8')) : {};
const fileOf = (u) => `${createHash('sha256').update(`${STYLE_VERSION}|${u.key}|${u.scene}`).digest('hex').slice(0, 16)}.jpg`;
const todo = units.filter((u) => index[u.key] !== fileOf(u) || !existsSync(join(out, fileOf(u)))).slice(0, limit);
console.log(`${units.length} con asociación · ${todo.length} por generar`);
let done = 0, spent = 0; const fails = [];
const pFile = join(out, '..', `prompts-${course}.json`);
const prompts = existsSync(pFile) ? JSON.parse(readFileSync(pFile, 'utf8')) : {};
async function one(u) {
  const r = await fetch(`${B}/memora/images`, { method: 'POST', headers: { authorization: `Bearer ${T}`, 'content-type': 'application/json' }, body: JSON.stringify({ course, target: u.target, meaning: u.meaning, scene: u.scene }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.errors ?? []).map((e) => e.message).join(' ') || `HTTP ${r.status}`);
  writeFileSync(join(out, fileOf(u)), Buffer.from(j.data.b64, 'base64'));
  index[u.key] = fileOf(u); spent = j.data.spentEur;
  writeFileSync(idxFile, JSON.stringify(index, null, 0));
  prompts[u.key] = j.data.prompt;
}
const queue = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const u = queue.shift();
    try { await one(u); done++; if (done % 10 === 0) console.log(`  ${done}/${todo.length} · gastado este mes ${spent} €`); }
    catch (e) { fails.push(`${u.key}: ${e.message}`); if (/Tope/.test(e.message)) queue.length = 0; }
  }
}));
writeFileSync(pFile, JSON.stringify(prompts, null, 1));
console.log(`✓ ${done} viñetas · gastado este mes ${spent} €${fails.length ? ` · ✗ ${fails.length}:\n  ${fails.slice(0, 10).join('\n  ')}` : ''}`);

// Aprueba y publica todas las misiones de un curso (como «Aprobar y publicar» en Studio, con sus comprobaciones).
// Uso: node --env-file=<entorno> deploy/publish-course.mjs <clave-curso> [NN]   (NN: solo esa misión)
const B = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const h = { authorization: `Bearer ${process.env.ADMIN_TOKEN}`, 'content-type': 'application/json' };
const api = async (m, p) => { const r = await fetch(B + p, { method: m, headers: h }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.errors ?? []).map((e) => e.message).join(' ') || `HTTP ${r.status}`); return j.data; };
const [key, only] = process.argv.slice(2);
const [course] = await api('GET', `/items/courses?filter[key][_eq]=${key}&fields=id,title`);
if (!course) throw new Error(`No existe el curso ${key}`);
let total = 0; const fails = [];
for (const m of await api('GET', `/memora/studio/missions?course=${course.id}`)) {
  if (only && !m.key.startsWith(`${only}-`)) continue;
  if (m.published === m.total) continue;
  const r = await api('POST', `/memora/studio/approve/${m.id}`);
  total += r.published;
  for (const f of r.failed) fails.push(`${m.key}/${f.key}: ${f.message}`);
}
console.log(`✓ ${course.title}: ${total} unidades publicadas${fails.length ? ` · ✗ ${fails.length}\n  ${fails.slice(0, 10).join('\n  ')}` : ''}`);

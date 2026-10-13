// Reglas de permisos personalizadas (filtros por estado y por autor) aplicadas por Directus, NO por el hook.
// En Directus 12 sin licencia estas reglas se ignoran: estas pruebas lo detectan (D-027).
//   pnpm test:integration
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const readEnv = (file: string): Record<string, string> =>
  Object.fromEntries(readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = { ...readEnv('../../../.env'), ...readEnv('../../../.env.accounts') };

async function call(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, codes: (json.errors ?? []).map((e: any) => e.extensions?.code) as string[] };
}
async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const token = (await res.json().catch(() => ({})))?.data?.access_token;
  // Sin sesión, un 403 no demostraría nada: la prueba debe fallar aquí.
  if (!res.ok || !token) throw new Error(`No se pudo iniciar sesión como ${email} (${res.status})`);
  return token as string;
}

const admin = env.ADMIN_TOKEN!;
const run = Date.now().toString(36);
const payload = { form: 'word', text: 'plug', meaning: 'enchufe', examples: [{ text: 'Where is the plug?', translation: '¿Dónde está el enchufe?' }] };
let author = '';
let courseId = '';

beforeAll(async () => {
  author = await login(env.AUTHOR_EMAIL!, env.AUTHOR_PASSWORD!);
  courseId = (await call(admin, 'POST', '/items/courses', { key: `permisos-${run}`, title: `Permisos ${run}` })).data.id;
});
afterAll(async () => {
  if (courseId) await call(admin, 'DELETE', `/items/courses/${courseId}`);
});

describe('reglas de permisos personalizadas', () => {
  it('la sesión de autoría es válida (si no, los 403 de abajo no probarían nada)', async () => {
    const me = await call(author, 'GET', '/users/me?fields=id');
    expect(me.status).toBe(200);
    expect((await call(author, 'GET', '/items/units?limit=1')).status).toBe(200);
  });

  it('autoría no puede borrar el borrador de otra persona (regla «solo sus borradores»)', async () => {
    // Lo crea administración: es un borrador, pero no es de la autora.
    const other = await call(admin, 'POST', '/items/units', { course: courseId, key: 'ajeno', type: 'term', payload });
    const res = await call(author, 'DELETE', `/items/units/${other.data.id}`);
    expect(res.status).toBe(403);
    expect(res.codes).toContain('FORBIDDEN');
    expect((await call(admin, 'GET', `/items/units/${other.data.id}`)).status).toBe(200);
  });

  it('autoría sí puede borrar su propio borrador', async () => {
    const own = await call(author, 'POST', '/items/units', { course: courseId, key: 'propio', type: 'term', payload });
    expect((await call(author, 'DELETE', `/items/units/${own.data.id}`)).status).toBe(204);
  });

  it('autoría no puede tocar una unidad publicada (regla «solo editable en borrador, rechazado o revisión»)', async () => {
    const unit = await call(admin, 'POST', '/items/units', { course: courseId, key: 'publicada', type: 'term', payload, sources: [{ title: 'Propio' }], license: 'proprietary-own' });
    for (const status of ['needs_review', 'approved', 'published']) await call(admin, 'PATCH', `/items/units/${unit.data.id}`, { status });
    expect((await call(admin, 'GET', `/items/units/${unit.data.id}?fields=status`)).data.status).toBe('published');
    // Un cambio que el hook no bloquearía (orden): solo lo puede impedir la regla de permiso.
    const res = await call(author, 'PATCH', `/items/units/${unit.data.id}`, { sort: 7 });
    expect(res.status).toBe(403);
    expect(res.codes).toContain('FORBIDDEN');
  });

  it('las 13 colecciones de Memora están activas', async () => {
    const collections = ['courses', 'modules', 'units', 'skills', 'associations', 'prerequisites', 'media', 'review_events', 'content_versions', 'learning_events', 'learner_states', 'session_positions', 'daily_plans'];
    for (const c of collections) {
      const res = await call(admin, 'GET', `/items/${c}?limit=1`);
      expect(res.codes, c).not.toContain('COLLECTION_INACTIVE');
      expect(res.status, c).toBe(200);
    }
  });
});

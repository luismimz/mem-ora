// Prueba de recorrido completo del H2.1 contra el Directus local (pnpm backend:up). No forma parte de `pnpm test`.
//   pnpm test:integration
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const readEnv = (file: string): Record<string, string> =>
  Object.fromEntries(readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = { ...readEnv('../../../.env'), ...readEnv('../../../.env.accounts') };

type Res = { status: number; data: any; message: string };
async function call(token: string, method: string, path: string, body?: unknown): Promise<Res> {
  const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, message: (json.errors ?? []).map((e: any) => e.message).join(' ') };
}
async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const json = await res.json();
  if (!res.ok) throw new Error(`No se pudo iniciar sesión como ${email}: ${res.status}`);
  return json.data.access_token;
}

const admin = env.ADMIN_TOKEN!;
let author = '';
let reviewer = '';
let learner = '';
let courseId = '';
const run = Date.now().toString(36);

const sources = [{ title: 'Propio', license: 'proprietary-own' }];
const borrow = {
  form: 'word', text: 'borrow', meaning: 'pedir prestado',
  examples: [{ text: 'Can I borrow your charger?', translation: '¿Me prestas tu cargador?' }],
};

beforeAll(async () => {
  author = await login(env.AUTHOR_EMAIL!, env.AUTHOR_PASSWORD!);
  reviewer = await login(env.REVIEWER_EMAIL!, env.REVIEWER_PASSWORD!);
  learner = await login(env.LEARNER_EMAIL!, env.LEARNER_PASSWORD!);
  const course = await call(admin, 'POST', '/items/courses', { key: `prueba-${run}`, title: `Prueba H2.1 ${run}`, subject: 'idioma' });
  expect(course.status).toBe(200);
  courseId = course.data.id;
});

afterAll(async () => {
  if (courseId) await call(admin, 'DELETE', `/items/courses/${courseId}`);
});

const unitStatus = async (id: string) => (await call(admin, 'GET', `/items/units/${id}?fields=status,version,reviewed_by,published_at`)).data;

describe('Studio v0: modelo de datos, roles y flujo de estados', () => {
  let unitId = '';

  it('autoría crea una unidad en borrador y recibe sus habilidades por defecto', async () => {
    const res = await call(author, 'POST', '/items/units', { course: courseId, key: 'borrow', type: 'term', payload: borrow, status: 'published' });
    expect(res.status, res.message).toBe(200);
    unitId = res.data.id;
    expect(res.data.status).toBe('draft');
    expect(res.data.language).toBe('en');
    const skills = await call(admin, 'GET', `/items/skills?filter[unit][_eq]=${unitId}&fields=key,kind&sort=sort`);
    expect(skills.data.map((s: any) => `${s.key}:${s.kind}`)).toEqual(['borrow.listen:listen', 'borrow.recall:recall', 'borrow.produce:produce']);
  });

  it('un contenido con errores de forma se rechaza con un mensaje para el autor', async () => {
    const res = await call(author, 'POST', '/items/units', { course: courseId, key: 'mal', type: 'term', payload: { ...borrow, meening: 'x', form: 'palabra' } });
    expect(res.status).toBe(400);
    expect(res.message).toContain('Meening: este campo no existe');
    expect(res.message).toContain('Forma: valor no válido');
  });

  it('identificadores con formato incorrecto o repetidos se rechazan', async () => {
    expect((await call(author, 'POST', '/items/units', { course: courseId, key: 'Borrow Word', type: 'term', payload: borrow })).message).toContain('usa solo minúsculas');
    expect((await call(author, 'POST', '/items/units', { course: courseId, key: 'borrow', type: 'term', payload: borrow })).message).toContain('ya hay otro elemento');
  });

  it('nadie se salta pasos y autoría no aprueba', async () => {
    expect((await call(author, 'PATCH', `/items/units/${unitId}`, { status: 'published' })).message).toContain('No se puede pasar de «borrador» a «publicado»');
    expect((await call(author, 'PATCH', `/items/units/${unitId}`, { status: 'needs_review' })).status).toBe(200);
    expect((await call(author, 'PATCH', `/items/units/${unitId}`, { status: 'approved' })).message).toContain('Tu rol no puede pasar');
  });

  it('el contenido en revisión no se puede editar', async () => {
    const res = await call(author, 'PATCH', `/items/units/${unitId}`, { payload: { ...borrow, meaning: 'tomar prestado' } });
    expect(res.status).toBe(400);
    expect(res.message).toBe('El contenido está «en revisión» y no se puede editar. Devuélvelo a borrador para cambiarlo.');
  });

  it('sin fuente ni licencia no se aprueba; con ellas, revisión aprueba y publica', async () => {
    expect((await call(reviewer, 'PATCH', `/items/units/${unitId}`, { status: 'approved' })).message).toContain('Falta la fuente');
    await call(reviewer, 'PATCH', `/items/units/${unitId}`, { status: 'draft' });
    expect((await call(author, 'PATCH', `/items/units/${unitId}`, { sources, license: 'proprietary-own' })).status).toBe(200);
    await call(author, 'PATCH', `/items/units/${unitId}`, { status: 'needs_review' });
    const approved = await call(reviewer, 'PATCH', `/items/units/${unitId}`, { status: 'approved' });
    expect(approved.status, approved.message).toBe(200);
    const published = await call(reviewer, 'PATCH', `/items/units/${unitId}`, { status: 'published' });
    expect(published.status, published.message).toBe(200);
    const state = await unitStatus(unitId);
    expect(state.status).toBe('published');
    expect(state.version).toBe(1);
    expect(state.reviewed_by).toBeTruthy();
    expect(state.published_at).toBeTruthy();
  });

  it('publicar registra la versión, sube la revisión del curso y deja historial de quién cambió qué', async () => {
    const versions = await call(admin, 'GET', `/items/content_versions?filter[item][_eq]=${unitId}`);
    expect(versions.data).toHaveLength(1);
    expect(versions.data[0].snapshot.payload.text).toBe('borrow');
    const course = await call(admin, 'GET', `/items/courses/${courseId}?fields=content_revision`);
    expect(course.data.content_revision).toBe(1);
    const history = await call(admin, 'GET', `/items/review_events?filter[item][_eq]=${unitId}&sort=date_created&fields=from_status,to_status,role`);
    expect(history.data.map((h: any) => `${h.from_status}→${h.to_status}:${h.role}`)).toEqual([
      'draft→needs_review:author', 'needs_review→draft:reviewer', 'draft→needs_review:author', 'needs_review→approved:reviewer', 'approved→published:reviewer',
    ]);
  });

  it('las habilidades de una unidad publicada no se pueden tocar', async () => {
    const skill = (await call(admin, 'GET', `/items/skills?filter[key][_eq]=borrow.recall&filter[unit][_eq]=${unitId}`)).data[0];
    const res = await call(admin, 'PATCH', `/items/skills/${skill.id}`, { kind: 'recognize' });
    expect(res.message).toContain('sus habilidades no se pueden cambiar');
  });

  it('el validador del catálogo impide un prerrequisito sobre reconocimiento puro y los círculos', async () => {
    const other = await call(author, 'POST', '/items/units', { course: courseId, key: 'charger', type: 'term', payload: { ...borrow, text: 'charger', meaning: 'cargador' } });
    const seeSkill = await call(author, 'POST', '/items/skills', { unit: other.data.id, key: 'charger.see', kind: 'recognize' });
    expect(seeSkill.status, seeSkill.message).toBe(200);
    const bad = await call(author, 'POST', '/items/prerequisites', { course: courseId, subject_unit: unitId, requires_skill: seeSkill.data.id });
    expect(bad.status).toBe(400);
    expect(bad.message).toContain('que es solo de reconocer');
    const recall = (await call(admin, 'GET', `/items/skills?filter[key][_eq]=charger.recall`)).data[0];
    const borrowRecall = (await call(admin, 'GET', `/items/skills?filter[key][_eq]=borrow.recall&filter[unit][_eq]=${unitId}`)).data[0];
    expect((await call(author, 'POST', '/items/prerequisites', { course: courseId, subject_unit: unitId, requires_skill: recall.id })).status).toBe(200);
    const cycle = await call(author, 'POST', '/items/prerequisites', { course: courseId, subject_unit: other.data.id, requires_skill: borrowRecall.id });
    expect(cycle.message).toContain('círculo de prerrequisitos');
  });

  it('las asociaciones se validan con su técnica y se vinculan a la habilidad que las recupera', async () => {
    const charger = (await call(admin, 'GET', `/items/units?filter[key][_eq]=charger&filter[course][_eq]=${courseId}`)).data[0];
    const long = await call(author, 'POST', '/items/associations', { unit: charger.id, technique: 'phonetic_bridge', cue: 'cha', text: 'una escena demasiado larga que no cabe en catorce palabras de ninguna manera aunque se intente mucho', evidence: { familiarMeaning: 'x', soundRelation: 'y', differences: 'z' } });
    expect(long.message).toContain('la escena tiene');
    const ok = await call(author, 'POST', '/items/associations', { unit: charger.id, technique: 'absurd_scene', text: 'Un CARGADOR gigante CARGA con tu móvil a cuestas.' });
    expect(ok.status, ok.message).toBe(200);
    expect(ok.data.language).toBe('es');
    const skill = (await call(admin, 'GET', `/items/skills?filter[key][_eq]=charger.recall`)).data[0];
    expect(skill.association).toBe(ok.data.id);
  });

  it('el riesgo medio exige una revisora distinta de quien lo creó', async () => {
    const created = await call(admin, 'POST', '/items/units', { course: courseId, key: 'medio', type: 'term', risk_level: 'medium', payload: { ...borrow, text: 'plug' }, sources, license: 'proprietary-own' });
    await call(admin, 'PATCH', `/items/units/${created.data.id}`, { status: 'needs_review' });
    expect((await call(admin, 'PATCH', `/items/units/${created.data.id}`, { status: 'approved' })).message).toContain('persona distinta');
    expect((await call(reviewer, 'PATCH', `/items/units/${created.data.id}`, { status: 'approved' })).status).toBe(200);
  });

  it('publicar exige que lo requerido ya esté publicado', async () => {
    const charger = (await call(admin, 'GET', `/items/units?filter[key][_eq]=charger&filter[course][_eq]=${courseId}`)).data[0];
    // borrow (publicado) ya exige charger.recall, que sigue en borrador: al volver a publicar borrow debe avisar.
    await call(reviewer, 'PATCH', `/items/units/${unitId}`, { status: 'draft' });
    await call(author, 'PATCH', `/items/units/${unitId}`, { status: 'needs_review' });
    await call(reviewer, 'PATCH', `/items/units/${unitId}`, { status: 'approved' });
    const res = await call(reviewer, 'PATCH', `/items/units/${unitId}`, { status: 'published' });
    expect(res.message).toContain(`exige «${charger.key}», que aún no está publicada`);
  });

  it('el alumno no lee el contenido directamente ni entra al panel', async () => {
    const res = await call(learner, 'GET', '/items/units');
    expect(res.status).toBe(403);
  });
});

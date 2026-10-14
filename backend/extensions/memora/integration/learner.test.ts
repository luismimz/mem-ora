// Prueba de recorrido completo del H2.2a: el alumno estudia con conexión y el servidor recalcula.
// Usa el mismo motor de sesión que la app (@memora/experiences). Requiere el Directus local (pnpm backend:up).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssocPlan, ClientEvent, SessionUnit } from '@memora/experiences';

const BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const readEnv = (file: string): Record<string, string> =>
  Object.fromEntries(readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = { ...readEnv('../../../.env'), ...readEnv('../../../.env.accounts') };
const DAY = 86_400_000;

async function call(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, message: (json.errors ?? []).map((e: any) => e.message).join(' ') };
}
async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const token = (await res.json().catch(() => ({})))?.data?.access_token;
  if (!res.ok || !token) throw new Error(`No se pudo iniciar sesión como ${email} (${res.status})`);
  return token as string;
}

const admin = env.ADMIN_TOKEN!;
const run = Date.now().toString(36);
let learner = '';
let author = '';
let learnerId = '';
let courseId = '';
let privateOther = '';
let draftUnitId = '';

const sources = [{ title: 'Propio' }];
async function publish(collection: string, id: string) {
  for (const status of ['needs_review', 'approved', 'published']) {
    const r = await call(admin, 'PATCH', `/items/${collection}/${id}`, { status });
    if (r.status !== 200) throw new Error(`${collection} → ${status}: ${r.message}`);
  }
}

beforeAll(async () => {
  learner = await login(env.LEARNER_EMAIL!, env.LEARNER_PASSWORD!);
  author = await login(env.AUTHOR_EMAIL!, env.AUTHOR_PASSWORD!);
  learnerId = (await call(learner, 'GET', '/users/me?fields=id')).data.id;
  courseId = (await call(admin, 'POST', '/items/courses', { key: `alumno-${run}`, title: `Alumno ${run}`, status: 'published', visibility: 'public' })).data.id;
  const unit = await call(admin, 'POST', '/items/units', {
    course: courseId, key: 'borrow', type: 'term', sources, license: 'proprietary-own',
    payload: { form: 'word', text: 'borrow', meaning: 'pedir prestado', examples: [{ text: 'Can I borrow your charger?', translation: '¿Me prestas tu cargador?' }] },
  });
  const assoc = await call(admin, 'POST', '/items/associations', {
    unit: unit.data.id, technique: 'phonetic_bridge', cue: 'burro', text: 'Un BURRO te PIDE PRESTADO el móvil.', sources, license: 'proprietary-own',
    evidence: { familiarMeaning: 'animal de carga', soundRelation: 'BÁ-rou suena como BU-rro', differences: 'la vocal inicial cambia' },
  });
  await publish('associations', assoc.data.id);
  await publish('units', unit.data.id);
  draftUnitId = (await call(admin, 'POST', '/items/units', { course: courseId, key: 'charger', type: 'term', payload: { form: 'word', text: 'charger', meaning: 'cargador', examples: [{ text: 'Where is my charger?', translation: '¿Dónde está mi cargador?' }] } })).data.id;
  privateOther = (await call(admin, 'POST', '/items/courses', { key: `privado-${run}`, title: `Privado ${run}`, status: 'published', visibility: 'private' })).data.id;
});

afterAll(async () => {
  for (const id of [courseId, privateOther]) if (id) await call(admin, 'DELETE', `/items/courses/${id}`);
});

let seq = 0;
/** Eventos que genera la app al recorrer una unidad: exposición de sus habilidades e intento de recordar. */
function unitEvents(u: SessionUnit, at: number, correct: boolean, format: ClientEvent['format'] = 'recognition_choice', hint = 0): ClientEvent[] {
  const base = { deviceId: 'prueba', courseId, unitKey: u.key };
  const exposures = u.skills.map((s, i): ClientEvent => ({ ...base, id: crypto.randomUUID(), kind: 'exposure', at: at + i, seq: ++seq, skillKey: s.key, ...(s.associationId ? { associationId: s.associationId } : {}) }));
  const recall = u.skills.find((s) => s.kind === 'recall')!;
  const attempt: ClientEvent = { ...base, id: crypto.randomUUID(), kind: 'attempt', at: at + 10, seq: ++seq, skillKey: recall.key, ...(recall.associationId ? { associationId: recall.associationId } : {}), format, correct, hint: hint as never, timeMs: 3000, contextId: `${u.key}#recall` };
  return [...exposures, attempt];
}

describe('el alumno estudia con conexión', () => {
  let plan: AssocPlan;
  let units: Record<string, SessionUnit>;

  it('ve los cursos publicados y públicos, pero no el privado de otra persona', async () => {
    const res = await call(learner, 'GET', '/memora/courses');
    expect(res.status).toBe(200);
    const ids = res.data.map((c: any) => c.id);
    expect(ids).toContain(courseId);
    expect(ids).not.toContain(privateOther);
    expect((await call(learner, 'GET', `/memora/session?course=${privateOther}`)).status).toBe(404);
  });

  it('recibe la sesión de hoy con solo el contenido publicado', async () => {
    const res = await call(learner, 'GET', `/memora/session?course=${courseId}`);
    expect(res.status, res.message).toBe(200);
    plan = res.data.state.plan;
    units = res.data.units;
    expect(Object.keys(units)).toEqual(['borrow']);
    expect(plan.steps.map((s) => s.kind)).toEqual(['card', 'recall', 'story', 'sceneResult', 'rescue', 'summary']);
    expect(units.borrow?.association?.cue).toBe('burro');
  });

  it('cierra a mitad y, al volver, retoma en el mismo punto', async () => {
    const half = unitEvents(units.borrow!, Date.now(), true);
    expect((await call(learner, 'POST', '/memora/events', { course: courseId, events: half })).data.accepted).toHaveLength(half.length);
    expect((await call(learner, 'PUT', '/memora/session/position', { course: courseId, sessionId: plan.sessionId, index: 3, outcomes: { x: { correct: true, hint: 0 } }, finished: false })).status).toBe(200);
    const again = await call(learner, 'GET', `/memora/session?course=${courseId}`);
    expect(again.data.resumed).toBe(true);
    expect(again.data.state.index).toBe(3);
    expect(again.data.state.plan.sessionId).toBe(plan.sessionId);
  });

  it('reenviar los mismos eventos no los duplica, y los manipulados se rechazan', async () => {
    const replay = unitEvents(units.borrow!, Date.now(), true).slice(0, 1);
    const first = await call(learner, 'POST', '/memora/events', { course: courseId, events: replay });
    const second = await call(learner, 'POST', '/memora/events', { course: courseId, events: replay });
    expect(first.data.accepted).toHaveLength(1);
    expect(second.data.duplicates).toEqual(first.data.accepted);
    const forged = { ...replay[0]!, id: crypto.randomUUID(), skillKey: 'charger.recall', unitKey: 'charger' };
    expect((await call(learner, 'POST', '/memora/events', { course: courseId, events: [forged] })).data.rejected).toEqual([{ id: forged.id, reason: 'unknown_skill' }]);
  });

  it('el usuario del evento lo pone el servidor, nunca el cliente', async () => {
    const forged = { ...unitEvents(units.borrow!, Date.now(), true)[0]!, userId: 'otra-persona' };
    await call(learner, 'POST', '/memora/events', { course: courseId, events: [forged] });
    const stored = await call(admin, 'GET', `/items/learning_events?filter[event_id][_eq]=${forged.id}&fields=user`);
    expect(stored.data[0].user).toBe(learnerId);
  });

  it('el estado se recalcula en el servidor', async () => {
    const progress = await call(learner, 'GET', `/memora/progress?course=${courseId}`);
    expect(progress.data.skills.find((s: any) => s.key === 'borrow.recall').status).toBe('learning');
    expect(progress.data.units[0]).toMatchObject({ key: 'borrow', level: 'none' });
  });
});

describe('al día siguiente', () => {
  it('el repaso usa la escalera de pistas tras un fallo', async () => {
    // Un alumno nuevo en un curso nuevo: hizo la sesión hace dos días y falló al recuperar.
    const course = (await call(admin, 'POST', '/items/courses', { key: `ayer-${run}`, title: `Ayer ${run}`, status: 'published' })).data.id;
    const unit = await call(admin, 'POST', '/items/units', { course, key: 'plug', type: 'term', sources, license: 'proprietary-own', payload: { form: 'word', text: 'plug', meaning: 'enchufe', examples: [{ text: 'Where is the plug?', translation: '¿Dónde está el enchufe?' }] } });
    const assoc = await call(admin, 'POST', '/items/associations', { unit: unit.data.id, technique: 'absurd_scene', text: 'Un ENCHUFE gigante te da la mano.', sources, license: 'proprietary-own' });
    await publish('associations', assoc.data.id);
    await publish('units', unit.data.id);
    try {
      const first = await call(learner, 'GET', `/memora/session?course=${course}`);
      const twoDaysAgo = Date.now() - 2 * DAY;
      // Hace dos días la vio y, en un repaso tecleado sin pista, falló.
      const events = unitEvents(first.data.units.plug, twoDaysAgo, false, 'recall_unaided', 0).map((e) => ({ ...e, courseId: course }));
      expect((await call(learner, 'POST', '/memora/events', { course, events })).data.rejected).toEqual([]);
      await call(learner, 'PUT', '/memora/session/position', { course, sessionId: first.data.state.plan.sessionId, index: first.data.state.plan.steps.length, outcomes: {}, finished: true });

      const next = await call(learner, 'GET', `/memora/session?course=${course}`);
      expect(next.data.resumed).toBe(false);
      const review = next.data.state.plan.steps.find((s: any) => s.kind === 'review');
      expect(review.skillKey).toBe('plug.recall');
      expect(review.startHint).toBe(1);
    } finally {
      await call(admin, 'DELETE', `/items/courses/${course}`);
    }
  });
});

describe('vista previa y sesión por cookie', () => {
  it('autoría ve una unidad en borrador como la verá el alumno; el alumno no puede', async () => {
    const preview = await call(author, 'GET', `/memora/preview/${draftUnitId}`);
    expect(preview.status, preview.message).toBe(200);
    expect(preview.data.preview).toBe(true);
    expect(preview.data.state.plan.steps.map((s: any) => s.kind)).toEqual(['card', 'recall', 'story', 'sceneResult', 'rescue', 'summary']);
    expect((await call(learner, 'GET', `/memora/preview/${draftUnitId}`)).status).toBe(403);
  });

  it('el inicio de sesión en modo cookie funciona con los endpoints, y sin sesión se rechaza', async () => {
    const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: env.LEARNER_EMAIL, password: env.LEARNER_PASSWORD, mode: 'session' }) });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    const session = cookie.split(';')[0]!;
    const courses = await fetch(`${BASE}/memora/courses`, { headers: { cookie: session } });
    expect(courses.status).toBe(200);
    expect((await fetch(`${BASE}/memora/courses`)).status).toBe(401);
  });
});

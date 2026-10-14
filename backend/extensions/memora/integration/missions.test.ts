// Misiones (D-045): aprobar una misión desde Studio y sesiones enfocadas en una misión. Requiere el Directus local (pnpm backend:up).
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
let author = '';
let learner = '';
let courseId = '';

const u = (k: string) => ({ key: `${k}-${run}`, type: 'concept', name: k, gist: `idea ${k}`, definition: `Definición de ${k}.`, examples: [{ text: k }],
  association: { technique: 'absurd_scene', scene: `Una ESCENA con ${k}.` } });
const file = {
  schemaVersion: 1, origin: 'ai',
  course: { key: `mis-${run}`, title: 'Misiones · prueba', contentLanguage: 'en', audio: false, modes: ['associations'], visibility: 'public', newPerSession: 10, license: 'proprietary-own', sources: [{ title: 'Propio' }] },
  modules: [
    { key: 'm1', title: 'Misión 1', units: [u('a'), u('b')] },
    { key: 'm2', title: 'Misión 2', units: [u('c'), u('d')] },
  ],
};

beforeAll(async () => {
  author = await login(env.AUTHOR_EMAIL!, env.AUTHOR_PASSWORD!);
  learner = await login(env.LEARNER_EMAIL!, env.LEARNER_PASSWORD!);
  const r = await call(author, 'POST', '/memora/import', file);
  courseId = r.data.courseId;
});
afterAll(async () => {
  if (courseId) await call(admin, 'DELETE', `/items/courses/${courseId}`);
});

describe('misiones', () => {
  it('Studio lista las misiones con el estado de sus unidades y deja probarlas enteras', async () => {
    const list = (await call(author, 'GET', `/memora/studio/missions?course=${courseId}`)).data;
    expect(list.map((m: any) => [m.key, m.total, m.draft])).toEqual([['m1', 2, 2], ['m2', 2, 2]]);
    const preview = (await call(author, 'GET', `/memora/preview/mission/${list[0].id}`)).data;
    expect(preview.state.plan.steps.filter((s: any) => s.kind === 'card').map((s: any) => s.unitKey)).toEqual([`a-${run}`, `b-${run}`]);
    expect((await call(learner, 'GET', `/memora/preview/mission/${list[0].id}`)).status).toBe(403);
  });

  it('aprobar una misión la publica entera con los permisos de quien la aprueba', async () => {
    const list = (await call(admin, 'GET', `/memora/studio/missions?course=${courseId}`)).data;
    // El autor no puede aprobar: se rechaza antes de mover nada (la misión sigue en borrador).
    const byAuthor = await call(author, 'POST', `/memora/studio/approve/${list[0].id}`);
    expect(byAuthor.status).toBe(403);
    expect((await call(admin, 'GET', `/memora/studio/missions?course=${courseId}`)).data[0].draft).toBe(2);
    for (const m of list) { const r = (await call(admin, 'POST', `/memora/studio/approve/${m.id}`)).data; if (r.failed.length) console.log('FALLO', JSON.stringify(r.failed)); expect(r).toEqual({ published: 2, failed: [] }); }
    const after = (await call(admin, 'GET', `/memora/studio/missions?course=${courseId}`)).data;
    expect(after.map((m: any) => [m.status, m.published])).toEqual([['published', 2], ['published', 2]]);
    expect((await call(admin, 'GET', `/items/courses/${courseId}?fields=status`)).data.status).toBe('published');
  });

  it('el alumno ve sus misiones y puede hacer solo la que elija; «Continuar» retoma', async () => {
    const m = (await call(learner, 'GET', `/memora/missions?course=${courseId}`)).data;
    expect(m.current).toBe('m1');
    expect(m.missions.map((x: any) => [x.key, x.total, x.worked, x.status])).toEqual([['m1', 2, 0, 'pending'], ['m2', 2, 0, 'pending']]);
    const s2 = (await call(learner, 'GET', `/memora/session?course=${courseId}&mission=m2`)).data;
    expect(s2.state.mission).toMatchObject({ key: 'm2', index: 2, total: 2, next: null });
    expect(s2.state.plan.steps.filter((s: any) => s.kind === 'card').map((s: any) => s.unitKey)).toEqual([`c-${run}`, `d-${run}`]);
    // Sin misión, «Continuar aventura» retoma la sesión empezada (la de la misión 2).
    const cont = (await call(learner, 'GET', `/memora/session?course=${courseId}`)).data;
    expect(cont.resumed).toBe(true);
    expect(cont.state.mission.key).toBe('m2');
    expect((await call(learner, 'GET', `/memora/missions?course=${courseId}`)).data.current).toBe('m2');
    // Elegir otra misión crea su sesión, con la siguiente misión indicada.
    const s1 = (await call(learner, 'GET', `/memora/session?course=${courseId}&mission=m1`)).data;
    expect(s1.state.mission).toMatchObject({ key: 'm1', next: { key: 'm2', title: 'Misión 2' } });
    expect((await call(learner, 'GET', `/memora/session?course=${courseId}&mission=nada`)).status).toBe(404);
    // Al terminar la sesión (llegar al resumen), deslizar para seguir en la misión abre una sesión nueva.
    const steps = s1.state.plan.steps.length;
    expect((await call(learner, 'PUT', '/memora/session/position', { course: courseId, sessionId: s1.state.plan.sessionId, index: steps - 1, outcomes: {}, finished: true, deviceId: 'test' })).status).toBe(200);
    const again = (await call(learner, 'GET', `/memora/session?course=${courseId}&mission=m1`)).data;
    expect(again.resumed).toBe(false);
    expect(again.state.plan.sessionId).not.toBe(s1.state.plan.sessionId);
  });
});

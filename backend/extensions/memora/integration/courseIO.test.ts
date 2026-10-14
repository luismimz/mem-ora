// Importar y exportar un curso en JSON (D-041). Requiere el Directus local (pnpm backend:up).
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
const created: string[] = [];

const file = (key: string) => ({
  schemaVersion: 1,
  course: { key, title: 'Francés · prueba de importación', subject: 'idioma', contentLanguage: 'fr', newPerSession: 5, audio: true, modes: ['associations', 'arcade'], license: 'proprietary-own', sources: [{ title: 'Propio' }] },
  modules: [{ key: 'cocina', title: 'La cocina', units: [
    { key: 'pain', type: 'term', text: 'pain', meaning: 'pan', pronunciation: 'PAN', examples: [{ text: 'Je mange du pain.', translation: 'Como pan.' }],
      association: { technique: 'absurd_scene', scene: 'Un PAN gigante se sienta a la mesa y pide más PAN.', sceneTarget: 'Un PAIN géant demande du PAIN.', emoji: '🥖' } },
    { key: 'lait', type: 'term', text: 'lait', meaning: 'leche', examples: [{ text: 'Du lait, s’il vous plaît.', translation: 'Leche, por favor.' }] },
  ] }],
});

beforeAll(async () => {
  author = await login(env.AUTHOR_EMAIL!, env.AUTHOR_PASSWORD!);
  learner = await login(env.LEARNER_EMAIL!, env.LEARNER_PASSWORD!);
});
afterAll(async () => {
  for (const id of created) await call(admin, 'DELETE', `/items/courses/${id}`);
});

describe('importar y exportar un curso', () => {
  it('un alumno no puede importar', async () => {
    expect((await call(learner, 'POST', '/memora/import', file(`imp-a-${run}`))).status).toBe(403);
  });

  it('con errores no crea nada y dice dónde están', async () => {
    const bad = file(`imp-b-${run}`);
    (bad.modules[0]!.units[1] as any).meaning = '';
    (bad.modules[0]!.units[0]!.association as any).technique = 'karaoke';
    const r = await call(author, 'POST', '/memora/import', bad);
    expect(r.data.ok).toBe(false);
    expect(r.data.problems.map((p: any) => p.where)).toEqual(expect.arrayContaining(['Módulo 1 (cocina) › Unidad 2 (lait)', 'Módulo 1 (cocina) › Unidad 1 (pain)']));
    expect((await call(admin, 'GET', `/items/courses?filter[key][_eq]=imp-b-${run}`)).data).toEqual([]);
  });

  it('importa todo como borrador y exporta el mismo contenido', async () => {
    const key = `imp-c-${run}`;
    expect((await call(author, 'POST', '/memora/import?check=1', file(key))).data).toEqual({ ok: true, problems: [] });
    const r = await call(author, 'POST', '/memora/import', file(key));
    expect(r.data).toMatchObject({ ok: true, modules: 1, units: 2, associations: 1 });
    created.push(r.data.courseId);
    const units = (await call(admin, 'GET', `/items/units?filter[course][_eq]=${r.data.courseId}&fields=key,status,skills.key`)).data;
    expect(units.map((u: any) => u.status)).toEqual(['draft', 'draft']);
    expect(units[0].skills.length).toBeGreaterThan(0);
    const again = await call(author, 'POST', '/memora/import', file(key));
    expect(again.data.problems[0].message).toContain('Ya existe un curso');

    const out = (await call(author, 'GET', `/memora/export/${r.data.courseId}`)).data;
    expect(out.course).toMatchObject({ key, contentLanguage: 'fr', newPerSession: 5, modes: ['associations', 'arcade'] });
    expect(out.modules[0].units[0]).toMatchObject({ key: 'pain', meaning: 'pan', pronunciation: { respelling: 'PAN' }, association: { technique: 'absurd_scene', emoji: '🥖' } });
    // Lo exportado se puede volver a importar con otra clave.
    out.course.key = `imp-d-${run}`;
    const round = await call(author, 'POST', '/memora/import', out);
    expect(round.data.ok).toBe(true);
    created.push(round.data.courseId);
  });

  it('un curso de conceptos (Java) con analogía se importa y su habilidad queda ligada a la asociación', async () => {
    const java = {
      schemaVersion: 1,
      course: { key: `imp-java-${run}`, title: 'Java · prueba', subject: 'programación', contentLanguage: 'en', audio: false, modes: ['associations', 'arcade'], sources: [{ title: 'Propio' }] },
      modules: [{ key: 'clases', title: 'Clases', units: [{
        key: 'class', type: 'concept', name: 'class', gist: 'molde', definition: 'Plantilla de la que se crean objetos.', answers: ['clase'],
        examples: [{ text: 'public class Dog { }', explanation: 'El molde Perro.' }],
        association: { technique: 'analogy', cue: 'molde de galletas', scene: 'Una clase es un MOLDE de galletas.', evidence: { mapping: 'molde = clase', breaksWhere: 'los objetos cambian sus datos' } },
      }] }],
    };
    const r = await call(author, 'POST', '/memora/import', java);
    expect(r.data).toMatchObject({ ok: true, units: 1, associations: 1 });
    created.push(r.data.courseId);
    const [unit] = (await call(admin, 'GET', `/items/units?filter[course][_eq]=${r.data.courseId}&fields=type,skills.key,skills.kind,skills.association`)).data;
    expect(unit.type).toBe('concept');
    expect(unit.skills).toHaveLength(1);
    expect(unit.skills[0]).toMatchObject({ key: 'class.recall', kind: 'recall' });
    expect(unit.skills[0].association).toBeTruthy();
    const out = (await call(author, 'GET', `/memora/export/${r.data.courseId}`)).data;
    expect(out.modules[0].units[0]).toMatchObject({ type: 'concept', gist: 'molde', answers: ['clase'], association: { technique: 'analogy' } });
  });

  it('con ejercicios, el concepto gana la habilidad «aplicar» (al importarlo y si se añaden después)', async () => {
    const ex = { kind: 'fill_gap', prompt: '¿Qué falta?', code: 'Dog rex = ___ Dog();', answer: 'new', distractors: ['class', 'this'] };
    const unit = (key: string, exercises?: unknown[]) => ({ key, type: 'concept', name: key, gist: 'crear', definition: 'Crea un objeto.', examples: [{ text: 'new Dog()' }], ...(exercises ? { exercises } : {}) });
    const file = { schemaVersion: 1, course: { key: `imp-ex-${run}`, title: 'Java · retos', contentLanguage: 'en', audio: false, modes: ['associations'] }, modules: [{ key: 'm', title: 'M', units: [unit('new', [ex]), unit('late')] }] };
    const r = await call(author, 'POST', '/memora/import', file);
    expect(r.data.ok).toBe(true);
    created.push(r.data.courseId);
    const kinds = async () => Object.fromEntries((await call(admin, 'GET', `/items/units?filter[course][_eq]=${r.data.courseId}&fields=id,key,skills.kind`)).data.map((u: any) => [u.key, { id: u.id, kinds: u.skills.map((s: any) => s.kind).sort() }]));
    let k = await kinds();
    expect(k.new.kinds).toEqual(['apply', 'recall']);
    expect(k.late.kinds).toEqual(['recall']);
    const late = (await call(admin, 'GET', `/items/units/${k.late.id}?fields=payload`)).data.payload;
    expect((await call(author, 'PATCH', `/items/units/${k.late.id}`, { payload: { ...late, exercises: [ex] } })).status).toBe(200);
    k = await kinds();
    expect(k.late.kinds).toEqual(['apply', 'recall']);
  });
});

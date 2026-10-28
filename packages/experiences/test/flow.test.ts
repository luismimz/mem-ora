import { describe, expect, it } from 'vitest';
import type { PlanItem } from '@memora/core';
import { buildFlowSession, buildTiles, burstOptions, stagedExamples, chantOf, judgeableExamples, FLOW_RETRY_GAP, type AssocPlan, type SessionUnit } from '../src';

const concept = (key: string): SessionUnit => ({
  key, type: 'concept', language: 'es',
  payload: { name: key, gist: `idea ${key}`, definition: 'd', examples: [], exercises: [{ kind: 'apply_case', prompt: 'p', answer: 'a', distractors: ['b'] }] },
  skills: [{ key: `${key}.recall`, kind: 'recall', associationId: `a-${key}` }, { key: `${key}.apply`, kind: 'apply' }],
  association: { id: `a-${key}`, technique: 'analogy', cue: 'CLAVE', text: `Una IDEA ${key}.` },
} as unknown as SessionUnit);
const keys = Array.from({ length: 12 }, (_, i) => `c${i}`);
const units = Object.fromEntries(keys.map((k) => [k, concept(k)]));
const item = (u: string, reason: 'new' | 'review'): PlanItem => ({ skillId: `${u}.recall`, unitId: u, reason, priority: 0, recommendedHint: 0 });
const base = { sessionId: 's', courseId: 'c', day: 1, createdAt: 0, units };

describe('modo Flujo (D-068)', () => {
  const plan = buildFlowSession({ ...base, items: [...keys.slice(0, 4).map((k) => item(k, 'review')), ...keys.slice(4, 12).map((k) => item(k, 'new'))], maxNewUnits: 8 });
  const main = plan.steps.filter((s) => !s.retry);

  it('todo entra en parejas: dos asociaciones y sus dos preguntas relámpago', () => {
    for (let i = 0; i < 8; i += 4) {
      const four = main.filter((s) => s.kind !== 'challenge').slice(i, i + 4);
      expect(four.map((s) => s.kind)).toEqual(['reel', 'reel', 'quick', 'judge']);
      expect([four[2]!.unitKey, four[3]!.unitKey]).toEqual([four[0]!.unitKey, four[1]!.unitKey]);
    }
  });

  it('REGLA DE ORO: ninguna pregunta (relámpago o examen) sin su asociación antes, también en los repasos (D-067)', () => {
    expect(plan.steps[0]!.kind).toBe('reel');
    plan.steps.forEach((s, i) => {
      if (!s.unitKey || s.kind === 'reel') return;
      expect(plan.steps.slice(0, i).some((x) => x.kind === 'reel' && x.unitKey === s.unitKey)).toBe(true);
    });
    expect(plan.steps.filter((s) => s.kind === 'reel').map((s) => s.unitKey).sort()).toEqual(keys.slice(0, 12).sort());
  });

  it('cada pregunta tiene su repesca (relámpago) al menos 3 tarjetas después', () => {
    for (const [i, s] of plan.steps.entries()) {
      if ((s.kind !== 'quick' && s.kind !== 'judge') || s.retry) continue;
      const j = plan.steps.findIndex((x, k) => k > i && x.retry && x.unitKey === s.unitKey);
      expect(j - i).toBeGreaterThanOrEqual(FLOW_RETRY_GAP);
      expect(plan.steps[j]!.kind).toBe('quick');
    }
  });

  it('¿verdad o mentira?: el significado mostrado es el suyo (verdad) o el de otra unidad de la sesión (mentira)', () => {
    const judges = plan.steps.filter((s) => s.kind === 'judge');
    expect(judges.length).toBeGreaterThan(3);
    for (const j of judges) expect(keys).toContain(j.statementOf);
    expect(judges.some((j) => j.statementOf === j.unitKey)).toBe(true);
    expect(judges.some((j) => j.statementOf !== j.unitKey)).toBe(true);
  });

  it('cada 8 tarjetas, una pregunta tipo examen de algo ya visto; termina en resumen y nunca se escribe en conceptos', () => {
    const bosses = plan.steps.filter((s) => s.kind === 'challenge');
    expect(bosses.length).toBeGreaterThanOrEqual(2);
    for (const b of bosses) expect(plan.steps.slice(0, plan.steps.indexOf(b)).some((x) => x.unitKey === b.unitKey)).toBe(true);
    expect(plan.steps.at(-1)!.kind).toBe('summary');
    expect(plan.steps.some((s) => s.kind === 'review')).toBe(false);
    expect(plan.mode).toBe('flow');
  });
});

describe('Flujo infinito (D-077)', () => {
  const golden = (plan: AssocPlan) => plan.steps.forEach((s, i) => {
    if (!s.unitKey || s.kind === 'reel') return;
    expect(plan.steps.slice(0, i).some((x) => x.kind === 'reel' && x.unitKey === s.unitKey)).toBe(true);
  });

  it('«tus errores» entran en la ronda marcados, y también se enseñan antes de preguntar', () => {
    const plan = buildFlowSession({ ...base, items: [item('c0', 'review'), item('c5', 'new')], errorUnits: ['c3', 'c0'] });
    expect(plan.steps.filter((s) => s.kind === 'reel').map((s) => s.unitKey).sort()).toEqual(['c0', 'c3', 'c5']);
    expect(plan.steps.find((s) => s.kind === 'reel' && s.unitKey === 'c3')!.focus).toBe('errors');
    expect(plan.steps.find((s) => s.kind === 'reel' && s.unitKey === 'c0')!.focus).toBeUndefined();
    golden(plan);
  });

  it('sin nada nuevo ni repasos, la ronda es refuerzo de lo más débil (nunca vacía si hay algo trabajado)', () => {
    const plan = buildFlowSession({ ...base, items: [], practiceUnits: ['c1', 'c2', 'c3'] });
    const reels = plan.steps.filter((s) => s.kind === 'reel');
    expect(reels.map((s) => s.unitKey)).toEqual(expect.arrayContaining(['c1', 'c2', 'c3']));
    expect(reels.every((s) => s.focus === 'practice')).toBe(true);
    expect(plan.steps.at(-1)!.kind).toBe('summary');
    golden(plan);
    const busy = buildFlowSession({ ...base, items: [item('c0', 'review')], practiceUnits: ['c1'] });
    expect(busy.steps.some((s) => s.unitKey === 'c1')).toBe(false);
  });

  it('las preguntas suben de nivel: con 2 repasos superados, se completa escribiendo (tras su ficha)', () => {
    const plan = buildFlowSession({ ...base, items: [item('c0', 'review'), item('c1', 'review'), item('c6', 'new')], levels: { c0: 2, c1: 1, c6: 5 } });
    const c0 = plan.steps.filter((s) => s.unitKey === 'c0' && !s.retry && s.kind !== 'reel');
    expect(c0[0]).toMatchObject({ kind: 'challenge', typed: true, levelUp: true });
    expect(plan.steps.some((s) => s.unitKey === 'c1' && s.levelUp)).toBe(false);
    expect(plan.steps.some((s) => s.unitKey === 'c6' && s.levelUp)).toBe(false);
    golden(plan);
  });

  it('en idiomas, subir de nivel es escribir la palabra', () => {
    const term = { key: 't1', type: 'term', language: 'en', payload: { text: 'play', meaning: 'jugar' }, skills: [{ key: 't1.recall', kind: 'recall' }], association: null } as unknown as SessionUnit;
    const plan = buildFlowSession({ ...base, units: { ...units, t1: term }, items: [item('t1', 'review')], levels: { t1: 3 } });
    expect(plan.steps.find((s) => s.unitKey === 't1' && s.levelUp)).toMatchObject({ kind: 'review', skillKey: 't1.recall' });
  });
});

describe('idiomas en el Flujo: escuchar, construir y gramática (D-079)', () => {
  const word = (key: string, text: string, meaning: string): SessionUnit => ({
    key, type: 'term', language: 'en',
    payload: { form: 'word', text, meaning, examples: [{ text: `I like my ${text} very much.`, translation: `Me gusta mucho mi ${meaning}.` }] },
    skills: [{ key: `${key}.listen`, kind: 'listen' }, { key: `${key}.recall`, kind: 'recall' }, { key: `${key}.produce`, kind: 'produce' }],
    association: null,
  } as unknown as SessionUnit);
  const pattern: SessionUnit = {
    key: 'p1', type: 'pattern', language: 'en',
    payload: { goal: 'Decir lo que estás haciendo', rule: 'am/is/are + verbo-ing', pieces: [{ text: "I'm", role: 'fixed', hint: 'YO estoy' }, { text: 'reading', role: 'slot', hint: 'leyendo' }], examples: [{ text: "I'm reading a book.", translation: 'Estoy leyendo un libro.' }, { text: 'She is cooking now.', translation: 'Está cocinando ahora.' }] },
    skills: [{ key: 'p1.recall', kind: 'recall' }, { key: 'p1.produce', kind: 'produce' }],
    association: null,
  } as unknown as SessionUnit;
  const vocab = Object.fromEntries([['w1', 'dog', 'perro'], ['w2', 'cat', 'gato'], ['w3', 'house', 'casa'], ['w4', 'car', 'coche']].map(([k, t, m]) => [k, word(k!, t!, m!)]));
  const lang = { ...base, units: { ...vocab, p1: pattern } };
  const plan = buildFlowSession({ ...lang, items: ['w1', 'w2', 'w3', 'w4', 'p1'].map((k) => item(k, 'new')), audio: true });
  const main = plan.steps.filter((s) => !s.retry);

  it('con audio, una palabra de cada pareja se practica escuchando (habilidad «escuchar»)', () => {
    const listens = main.filter((s) => s.kind === 'listen');
    expect(listens.length).toBeGreaterThanOrEqual(2);
    for (const s of listens) expect(s.skillKey).toBe(`${s.unitKey}.listen`);
  });

  it('tras cada pareja de palabras, se construye una frase real (habilidad «producir»)', () => {
    const builds = main.filter((s) => s.kind === 'build' && s.unitKey.startsWith('w'));
    expect(builds.length).toBeGreaterThanOrEqual(2);
    for (const s of builds) expect(s).toMatchObject({ skillKey: `${s.unitKey}.produce`, example: 0 });
  });

  it('la gramática entra con su truco (ficha) y se practica construyendo una de sus frases', () => {
    const i = plan.steps.findIndex((s) => s.unitKey === 'p1' && s.kind === 'reel');
    const j = plan.steps.findIndex((s) => s.unitKey === 'p1' && s.kind === 'build');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(j).toBeGreaterThan(i);
  });

  it('REGLA DE ORO también con las tarjetas nuevas: nada se pregunta sin su ficha antes', () => plan.steps.forEach((s, i) => {
    if (!s.unitKey || s.kind === 'reel') return;
    expect(plan.steps.slice(0, i).some((x) => x.kind === 'reel' && x.unitKey === s.unitKey)).toBe(true);
  }));

  it('la gramática se repesca construyendo otra de sus frases, no eligiendo', () => {
    const first = plan.steps.find((s) => s.unitKey === 'p1' && s.kind === 'build' && !s.retry)!;
    const retry = plan.steps.find((s) => s.unitKey === 'p1' && s.retry);
    expect(retry).toMatchObject({ kind: 'build', skillKey: 'p1.produce' });
    expect(retry!.example).not.toBe(first.example);
  });

  it('cada ronda pide una frase distinta, siempre de las que enseña la ficha (D-086)', () => {
    const picked = new Set<number>();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const round = buildFlowSession({ ...lang, sessionId: id, audio: true, items: [item('p1', 'new')] });
      for (const st of round.steps.filter((x) => x.kind === 'build' && x.unitKey === 'p1' && !x.retry)) { picked.add(st.example!); expect(st.example!).toBeLessThan(4); }
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it('sin audio no hay «Escucha»', () => {
    const quiet = buildFlowSession({ ...lang, items: ['w1', 'w2'].map((k) => item(k, 'new')) });
    expect(quiet.steps.some((s) => s.kind === 'listen')).toBe(false);
  });

  it('las fichas de una frase son sus palabras sin la puntuación final', () => {
    expect(buildTiles("I'm reading a book.")).toEqual(["I'm", 'reading', 'a', 'book']);
  });
});

describe('Ráfaga: los juegos de los pilares (D-081)', () => {
  const ex = (prompt: string, answer: string, distractors: string[]) => ({ kind: 'apply_case', prompt, answer, distractors });
  const game: SessionUnit = {
    key: 'toco', type: 'concept', language: 'en',
    payload: { name: 'Toco o cuento', gist: 'HAVE si se toca; BE si se siente', definition: 'd', examples: [], exercises: [
      ex('Tengo un gato', 'I HAVE', ['I AM']), ex('Tengo hambre', 'I AM', ['I HAVE']), ex('Tengo dos coches', 'I HAVE', ['I AM']), ex('Tengo frío', 'I AM', ['I HAVE']),
    ] },
    skills: [{ key: 'toco.recall', kind: 'recall' }, { key: 'toco.apply', kind: 'apply' }],
    association: null,
  } as unknown as SessionUnit;
  const plan = buildFlowSession({ ...base, units: { ...units, toco: game }, items: [item('toco', 'new'), item('c0', 'new')] });

  it('las opciones salen en orden estable (las de la primera pregunta) y el concepto se reconoce como juego', () => {
    expect(burstOptions(game)).toEqual(['I HAVE', 'I AM']);
    expect(burstOptions(concept('x'))).toBeNull();
  });

  it('un juego nunca sale como pregunta jefe, aunque haya muchas tarjetas antes de su Ráfaga', () => {
    const many = buildFlowSession({ ...base, units: { ...units, toco: game }, items: [...keys.slice(0, 8).map((k) => item(k, 'new')), item('toco', 'new')] });
    expect(many.steps.filter((s) => s.unitKey === 'toco' && s.kind === 'challenge')).toEqual([]);
  });

  it('tras su ficha, el juego se practica con su Ráfaga (habilidad «aplicar») y no con relámpago ni pregunta de examen', () => {
    const steps = plan.steps.filter((s) => s.unitKey === 'toco');
    expect(steps.map((s) => s.kind)).toEqual(['reel', 'burst']);
    expect(steps[1]).toMatchObject({ skillKey: 'toco.apply' });
  });
});

describe('el espejo en movimiento (D-082, en un solo paso)', () => {
  const pattern: SessionUnit = {
    key: 'q1', type: 'pattern', language: 'en',
    payload: { goal: 'Preguntar', rule: 'el ayudante salta', pieces: [{ text: 'Are', role: 'fixed' }, { text: 'you', role: 'slot' }], examples: [
      { text: 'Are you hungry?', translation: '¿Tienes hambre?', mirror: { say: '¿Tienes hambre?', pieces: [{ es: 'TÚ', en: 'you', role: 'who', ghost: true }, { es: 'estás', en: 'are', role: 'helper' }, { es: 'hambriento', en: 'hungry', role: 'word' }], order: [1, 0, 2] } },
      { text: 'Are you tired?', translation: '¿Estás cansado?' },
    ] },
    skills: [{ key: 'q1.recall', kind: 'recall' }, { key: 'q1.produce', kind: 'produce' }],
    association: null,
  } as unknown as SessionUnit;
  const lang = { ...base, units: { ...units, q1: pattern } };

  it('lo nuevo: la ficha del truco (con su espejo animado dentro) y enseguida construir OTRA frase; sin tarjeta extra', () => {
    const plan = buildFlowSession({ ...lang, items: [item('q1', 'new')] });
    expect(plan.steps.filter((s) => s.unitKey === 'q1' && !s.retry).map((s) => [s.kind, s.example])).toEqual([['reel', undefined], ['build', 1]]);
    expect(plan.steps.some((s) => s.kind === 'train')).toBe(false);
  });
});

describe('la escena que cambia (D-084)', () => {
  const hat = { e: '🎩', x: 50, y: 70, s: 2 };
  const ex = (text: string, x: number, y: number) => ({ text, translation: 'x', stage: [hat, { e: '🐛', x, y }] });
  const pattern = (examples: unknown[]): SessionUnit => ({
    key: 'w1', type: 'pattern', language: 'en',
    payload: { goal: 'Dónde está', rule: 'IN, ON, UNDER', pieces: [{ text: 'The bug is', role: 'fixed' }, { text: 'on', role: 'slot' }], examples },
    skills: [{ key: 'w1.recall', kind: 'recall' }, { key: 'w1.produce', kind: 'produce' }],
    association: null,
  } as unknown as SessionUnit);
  const staged = pattern([ex('The bug is on the hat.', 50, 45), ex('The bug is under the hat.', 50, 92), ex('The bug is next to the hat.', 82, 70), { text: 'The cat is in the box.', translation: 'x' }]);

  it('solo hay juego con tres escenas o más', () => {
    expect(stagedExamples(staged)).toEqual([0, 1, 2]);
    expect(stagedExamples(pattern([ex('a b c', 1, 1), ex('a b d', 2, 2)]))).toEqual([]);
  });
  it('lo nuevo: ficha, mirar la escena, jugar (con la habilidad «recordar») y construir una frase', () => {
    const plan = buildFlowSession({ ...base, units: { ...units, w1: staged }, items: [item('w1', 'new')] });
    const main = plan.steps.filter((s) => s.unitKey === 'w1' && !s.retry);
    expect(main.map((s) => s.kind)).toEqual(['reel', 'watch', 'spot', 'build']);
    const play = main[2]!;
    expect(play.skillKey).toBe('w1.recall');
    expect(stagedExamples(staged)).toContain(play.example);
  });
  it('si se falla, se repite con OTRA escena más tarde (no justo después)', () => {
    const plan = buildFlowSession({ ...base, units: { ...units, w1: staged }, items: [item('w1', 'new')] });
    const first = plan.steps.find((s) => s.kind === 'spot' && !s.retry)!;
    const again = plan.steps.find((s) => s.kind === 'spot' && s.retry)!;
    expect(again.example).not.toBe(first.example);
    expect(plan.steps.indexOf(again)).toBeGreaterThan(plan.steps.indexOf(first) + 1);
  });
  it('un truco sin escenas sigue igual que antes', () => {
    const plain = pattern([{ text: 'The cat is in the box.', translation: 'x' }, { text: 'The cat is on the bed.', translation: 'x' }, { text: 'The dog is under the table.', translation: 'x' }]);
    const plan = buildFlowSession({ ...base, units: { ...units, w1: plain }, items: [item('w1', 'new')] });
    expect(plan.steps.some((s) => s.kind === 'watch' || s.kind === 'spot')).toBe(false);
  });
});

describe('la cadena (D-085)', () => {
  const v = (e: string, a: string) => ({ e, q: 'Is this a cat?', a });
  const sung = (chant: unknown[]): SessionUnit => ({
    key: 'c1', type: 'pattern', language: 'en',
    payload: { goal: 'Contestar corto', rule: 'Yes, it is.', pieces: [{ text: 'Yes, it', role: 'fixed' }, { text: 'is', role: 'slot' }], examples: [{ text: 'Yes, it is.', translation: 'x' }, { text: 'No, it isn\'t.', translation: 'x' }, { text: 'Yes, I do.', translation: 'x' }], chant },
    skills: [{ key: 'c1.recall', kind: 'recall' }, { key: 'c1.produce', kind: 'produce' }],
    association: null,
  } as unknown as SessionUnit);
  const four = [v('🐱', 'Yes, it is!'), v('🐶', "No, it isn't."), v('🐭', "No, it isn't."), v('🐱', 'Yes, it is!')];

  it('lo nuevo: ficha, la cadena (con «recordar») y construir una frase', () => {
    const plan = buildFlowSession({ ...base, units: { ...units, c1: sung(four) }, items: [item('c1', 'new')] });
    const main = plan.steps.filter((s) => s.unitKey === 'c1' && !s.retry);
    expect(main.map((s) => s.kind)).toEqual(['reel', 'chant', 'build']);
    expect(main[1]!.skillKey).toBe('c1.recall');
  });
  it('si se falla, la cadena vuelve más tarde', () => {
    const plan = buildFlowSession({ ...base, units: { ...units, c1: sung(four) }, items: [item('c1', 'new')] });
    const first = plan.steps.find((s) => s.kind === 'chant' && !s.retry)!;
    const again = plan.steps.find((s) => s.kind === 'chant' && s.retry)!;
    expect(plan.steps.indexOf(again)).toBeGreaterThan(plan.steps.indexOf(first) + 1);
  });
  it('con menos de cuatro versos no hay cadena', () => {
    expect(chantOf(sung(four.slice(0, 3)))).toEqual([]);
    const plan = buildFlowSession({ ...base, units: { ...units, c1: sung(four.slice(0, 3)) }, items: [item('c1', 'new')] });
    expect(plan.steps.some((s) => s.kind === 'chant')).toBe(false);
  });
});

describe('Arcade sorpresa en el Flujo (D-087)', () => {
  const w = (k: string, t: string, m: string): SessionUnit => ({ key: k, type: 'term', language: 'en', payload: { text: t, meaning: m, examples: [] }, skills: [{ key: `${k}.recall`, kind: 'recall' }], association: null } as unknown as SessionUnit);
  const pool = Object.fromEntries(['dog', 'cat', 'house', 'car', 'tree', 'sun', 'moon', 'book'].map((t, i) => [`k${i}`, w(`k${i}`, t, `m${i}`)]));
  const fresh = Object.fromEntries(['a', 'b', 'c', 'd'].map((t) => [`n${t}`, w(`n${t}`, `word${t}`, `sig${t}`)]));
  const all = { ...pool, ...fresh };
  const round = (id: string, known: string[]) => buildFlowSession({ ...base, sessionId: id, units: all, items: Object.keys(fresh).map((k) => item(k, 'new')), arcadeUnits: known });

  it('sale en algunas rondas (no en todas), con 6 preguntas solo de lo ya aprendido y nunca al principio', () => {
    const rounds = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10'].map((id) => round(id, Object.keys(pool)));
    const with_ = rounds.filter((r) => r.steps.some((s) => s.kind === 'arcade'));
    expect(with_.length).toBeGreaterThan(0);
    expect(with_.length).toBeLessThan(rounds.length);
    for (const r of with_) {
      const i = r.steps.findIndex((s) => s.kind === 'arcade');
      const a = r.steps[i]!;
      expect(a.arcadeUnits).toHaveLength(8);
      for (const k of a.arcadeUnits!) expect(Object.keys(pool)).toContain(k);
      expect(i).toBeGreaterThanOrEqual(3);
      expect(r.steps.at(-1)!.kind).toBe('summary');
      expect(new Set(r.steps.map((s) => s.id)).size).toBe(r.steps.length);
    }
  });
  it('con menos de 6 cosas aprendidas no sale', () => {
    for (const id of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']) expect(round(id, Object.keys(pool).slice(0, 5)).steps.some((s) => s.kind === 'arcade')).toBe(false);
  });
});

describe('Arcade gramatical (D-088)', () => {
  const brown = { key: 'brown', type: 'term', language: 'en', payload: { text: 'brown', meaning: 'marrón', examples: [
    { text: 'She has brown eyes.', translation: 'Tiene los ojos marrones.', mirror: { say: 'x', pieces: [{ es: 'ELLA', en: 'She', role: 'who' }, { es: 'tiene', en: 'has', role: 'verb' }, { es: 'ojos', en: 'eyes', role: 'word' }, { es: 'marrones', en: 'brown', role: 'word' }], order: [0, 1, 3, 2] } },
    { text: 'I am busy today.', translation: 'Hoy estoy ocupado.', mirror: { say: 'x', pieces: [{ es: 'Hoy', en: 'today', role: 'word' }, { es: 'YO', en: 'I', role: 'who' }, { es: 'estoy ocupado', en: 'am busy', role: 'word' }], order: [1, 2, 0] } },
  ] }, skills: [{ key: 'brown.recall', kind: 'recall' }], association: null } as unknown as SessionUnit;
  it('solo frases cuyo orden del español es seguro que está mal (brown eyes sí; «Today I am busy» no)', () => {
    expect(judgeableExamples(brown)).toEqual([0]);
  });
});

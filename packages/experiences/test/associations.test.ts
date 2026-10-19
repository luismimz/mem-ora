import { describe, expect, it } from 'vitest';
import type { PlanItem } from '@memora/core';
import { buildAssociationSession, choicesFor, gradeReview, reviewHints, storyGap, unitMeaning, unitText, gradeChallenge, shuffledSteps, challengeChoices, scoreRecall, type SessionUnit } from '../src';

const unit = (key: string, text: string, meaning: string, scene: string, cue = ''): SessionUnit => ({
  key, type: 'term', language: 'en', version: 1,
  payload: { form: 'word', text, meaning, pronunciation: { respelling: text.toUpperCase() }, examples: [{ text: `I ${text} it.`, translation: `Lo ${meaning}.` }] },
  skills: [{ key: `${key}.listen`, kind: 'listen' }, { key: `${key}.recall`, kind: 'recall', associationId: `a-${key}` }, { key: `${key}.produce`, kind: 'produce' }],
  association: { id: `a-${key}`, technique: 'phonetic_bridge', cue, text: scene },
});
const words = Array.from({ length: 15 }, (_, i) => unit(`w${i}`, `word${i}`, `significado${i}`, `Una ESCENA lleva a SIGNIFICADO${i}.`));
const units = Object.fromEntries(words.map((w) => [w.key, w]));
const newItems: PlanItem[] = words.flatMap((w) => w.skills.map((s) => ({ skillId: s.key, unitId: w.key, reason: 'new' as const, priority: 0, recommendedHint: 0 as const })));
const base = { sessionId: 's1', courseId: 'c', day: 1, createdAt: 0, units };

describe('sesión de asociaciones', () => {
  it('15 unidades nuevas forman 3 escenas de 5: tarjetas, recordar, historia y resultado; cierre escribiendo (D-063)', () => {
    const plan = buildAssociationSession({ ...base, items: newItems, knownUnits: [] });
    expect(plan.scenes.map((s) => s.length)).toEqual([5, 5, 5]);
    const kinds = plan.steps.map((s) => s.kind);
    expect(kinds.slice(0, 16)).toEqual([...Array(5).fill('card'), ...Array(5).fill('recall'), ...Array(5).fill('story'), 'sceneResult']);
    expect(kinds.filter((k) => k === 'rescue')).toHaveLength(0);
    expect(kinds.slice(-16)).toEqual([...Array(15).fill('review'), 'summary']);
    expect(kinds.at(-1)).toBe('summary');
    expect(kinds).not.toContain('arcade');
  });

  it('sin historia (temario de examen) no hay «Completa la historia»: tarjeta, recordar, resultado y escribir', () => {
    const bare = Object.fromEntries(words.slice(0, 5).map((w) => { const { association: _a, ...rest } = w; return [w.key, rest as SessionUnit]; }));
    const items = newItems.filter((i) => bare[i.unitId]);
    const kinds = buildAssociationSession({ ...base, units: bare, items, knownUnits: [] }).steps.map((s) => s.kind);
    expect(kinds).toEqual([...Array(5).fill('card'), ...Array(5).fill('recall'), 'sceneResult', ...Array(5).fill('review'), 'summary']);
  });

  it('enseñar antes de evaluar: si la ficha cambió, la tarjeta va antes de su repaso (D-062)', () => {
    const review: PlanItem[] = [{ skillId: 'w0.recall', unitId: 'w0', reason: 'review', priority: 0, recommendedHint: 0 }, { skillId: 'w1.recall', unitId: 'w1', reason: 'review', priority: 0, recommendedHint: 0 }];
    const kinds = buildAssociationSession({ ...base, items: review, knownUnits: [], refreshUnits: ['w1'] }).steps.map((s) => `${s.kind}:${s.unitKey}`);
    expect(kinds).toEqual(['check:w0', 'review:w0', 'card:w1', 'check:w1', 'review:w1', 'summary:']);
  });

  it('nunca recuerda una unidad antes de su tarjeta (principio 1)', () => {
    const plan = buildAssociationSession({ ...base, items: newItems, knownUnits: [] });
    for (const [i, step] of plan.steps.entries()) {
      if (step.kind === 'recall' || step.kind === 'story' || step.kind === 'rescue') {
        expect(plan.steps.slice(0, i).some((s) => s.kind === 'card' && s.unitKey === step.unitKey)).toBe(true);
      }
    }
  });

  it('con 20 o más unidades trabajadas puede saltar un Arcade sorpresa, solo con lo ya enseñado', () => {
    const known = Array.from({ length: 20 }, (_, i) => `old${i}`);
    let seen = false;
    for (let s = 0; s < 20 && !seen; s += 1) {
      const plan = buildAssociationSession({ ...base, sessionId: `s${s}`, items: newItems, knownUnits: known });
      const arcade = plan.steps.find((x) => x.kind === 'arcade');
      if (arcade) {
        seen = true;
        const idx = plan.steps.indexOf(arcade);
        for (const k of arcade.arcadeUnits!) expect(plan.steps.slice(0, idx).some((x) => x.kind === 'card' && x.unitKey === k)).toBe(true);
      }
    }
    expect(seen).toBe(true);
  });

  it('los repasos vencidos van primero y empiezan con la pista de la escalera', () => {
    const items: PlanItem[] = [{ skillId: 'w3.recall', unitId: 'w3', reason: 'review', priority: 1, recommendedHint: 2 }, { skillId: 'w3.listen', unitId: 'w3', reason: 'review', priority: 1, recommendedHint: 0 }];
    const plan = buildAssociationSession({ ...base, items, knownUnits: [] });
    expect(plan.steps.map((s) => s.kind)).toEqual(['check', 'review', 'summary']);
    expect(plan.steps[1]).toMatchObject({ skillKey: 'w3.recall', startHint: 2 });
  });

  it('comprobación selectiva: la ayuda se retira repaso a repaso y desde el 4.º se escribe directamente (D-063)', () => {
    const items: PlanItem[] = ['w0', 'w1', 'w2', 'w3'].map((u) => ({ skillId: `${u}.recall`, unitId: u, reason: 'review' as const, priority: 1, recommendedHint: 0 as const }));
    const plan = buildAssociationSession({ ...base, items, knownUnits: [], reviewHelp: { w0: 0, w1: 1, w2: 2, w3: 3 } });
    expect(plan.steps.filter((s) => s.kind === 'check').map((s) => [s.unitKey, s.startHint])).toEqual([['w0', 0], ['w1', 1], ['w2', 2]]);
    expect(plan.steps.findIndex((s) => s.kind === 'check' && s.unitKey === 'w0')).toBeLessThan(plan.steps.findIndex((s) => s.kind === 'review' && s.unitKey === 'w0'));
  });
});

describe('ejercicios', () => {
  it('las opciones incluyen la correcta y solo distractores enseñados', () => {
    const c = choicesFor('PLAY', ['PLAY', 'DESK', 'COMPUTER', 'KEY'], 'x');
    expect(c).toHaveLength(3);
    expect(c.filter((o) => o.correct).map((o) => o.label)).toEqual(['PLAY']);
    expect(c.every((o) => ['PLAY', 'DESK', 'COMPUTER', 'KEY'].includes(o.label))).toBe(true);
  });

  it('completar la historia oculta el SIGNIFICADO, no el puente', () => {
    const play = unit('play', 'play', 'jugar', 'Una PLAYA invade el salón cuando empiezas a JUGAR.', 'PLAYA');
    expect(storyGap(play)).toEqual({ text: 'Una PLAYA invade el salón cuando empiezas a ______.', answer: 'JUGAR' });
  });

  it('el repaso tecleado sigue la escalera y revelar no cuenta', () => {
    const play = unit('play', 'play', 'jugar', 'Una PLAYA invade el salón cuando empiezas a JUGAR.', 'PLAYA');
    expect(reviewHints(play)).toEqual(['p _ _ _', 'Suena ≈ PLAY', 'Suena a PLAYA', 'Una PLAYA invade el salón cuando empiezas a JUGAR.']);
    expect(gradeReview(play, 'Play', 0, 0, false)).toEqual({ correct: true, format: 'recall_unaided', hint: 0 });
    expect(gradeReview(play, 'play', 0, 3, false)).toEqual({ correct: true, format: 'recall_cued', hint: 3 });
    expect(gradeReview(play, 'play', 0, 0, true)).toMatchObject({ correct: false, hint: 5 });
  });
});

describe('conceptos (Java, redes, temarios)', () => {
  const cls: SessionUnit = {
    key: 'class', type: 'concept', language: 'en',
    payload: { name: 'class', gist: 'molde', definition: 'Plantilla de la que se crean objetos.', answers: ['clase'], examples: [{ text: 'public class Perro { }' }] },
    skills: [{ key: 'class.recall', kind: 'recall', associationId: 'a1' }],
    association: { id: 'a1', technique: 'analogy', cue: 'molde de galletas', text: 'Una clase es un MOLDE: de él salen galletas iguales.' },
  } as SessionUnit;

  it('el nombre es la respuesta y la idea clave hace de significado', () => {
    expect(unitText(cls)).toBe('class');
    expect(unitMeaning(cls)).toBe('molde');
    expect(storyGap(cls)).toEqual({ text: 'Una clase es un ______: de él salen galletas iguales.', answer: 'MOLDE' });
  });

  it('el hueco nunca es un artículo: busca una palabra con contenido o la pieza en MAYÚSCULAS', () => {
    const mk = (gist: string, text: string, cue?: string) => ({ ...cls, payload: { ...cls.payload, gist }, association: { ...cls.association!, text, ...(cue ? { cue } : { cue: undefined }) } }) as SessionUnit;
    expect(storyGap(mk('la mesa pequeña donde manejas datos', 'Una MESA de camping diminuta: la quinta cae.')).answer).toBe('MESA');
    expect(storyGap(mk('el almacén enorme', 'Un ALMACÉN infinito donde todo cabe.')).answer).toBe('ALMACÉN');
    expect(storyGap(mk('sin repasar, olvidas rápido', 'EBBINGHAUS baja en un tobogán: cae RÁPIDO al principio.', 'EBBINGHAUS')).answer).toBe('RÁPIDO');
    expect(storyGap(mk('el recuerdo se asienta', 'Un ALBAÑIL echa cemento mientras duermes.', 'ALBAÑIL')).answer).toBe('ALBAÑIL');
  });

  it('acepta las respuestas alternativas al repasar', () => {
    expect(gradeReview(cls, 'Clase', 0, 0, false).correct).toBe(true);
    expect(gradeReview(cls, 'objeto', 0, 0, false).correct).toBe(false);
  });
});

describe('retos de aplicación', () => {
  const predict = { kind: 'predict_output' as const, prompt: '¿Qué imprime?', code: 'System.out.println(1 + 1);', answer: '2', accepted: ['dos'], distractors: ['11', 'error'] };
  const order = { kind: 'order_steps' as const, prompt: 'Ordena', steps: ['a', 'b', 'c'] };
  const concept = (key: string, exercises: unknown[]): SessionUnit => ({
    key, type: 'concept', language: 'en',
    payload: { name: key, gist: `idea ${key}`, definition: 'd', examples: [{ text: 'x' }], exercises },
    skills: [{ key: `${key}.recall`, kind: 'recall', associationId: `a-${key}` }, ...(exercises.length ? [{ key: `${key}.apply`, kind: 'apply' }] : [])],
    association: { id: `a-${key}`, technique: 'absurd_scene', text: `Una IDEA ${key}.` },
  } as SessionUnit);
  const cu = { c1: concept('c1', [predict]), c2: concept('c2', []), c3: concept('c3', [order]) };
  const newItems = (keys: string[]): PlanItem[] => keys.flatMap((k) => cu[k as keyof typeof cu].skills.map((s) => ({ skillId: s.key, unitId: k, reason: 'new' as const, priority: 0, recommendedHint: 0 as const })));

  it('el primer día hay un reto con opciones solo para los conceptos con ejercicios', () => {
    const plan = buildAssociationSession({ sessionId: 's', courseId: 'c', day: 0, createdAt: 0, items: newItems(['c1', 'c2', 'c3']), units: cu, knownUnits: [] });
    const challenges = plan.steps.filter((s) => s.kind === 'challenge');
    expect(challenges.map((s) => [s.unitKey, s.typed])).toEqual([['c1', false], ['c3', false]]);
    expect(plan.steps.at(-1)!.kind).toBe('summary');
  });

  it('en el repaso, «aplicar» vence y se responde sin opciones', () => {
    const plan = buildAssociationSession({ sessionId: 's', courseId: 'c', day: 3, createdAt: 0, items: [{ skillId: 'c1.apply', unitId: 'c1', reason: 'review', priority: 0, recommendedHint: 0 }], units: cu, knownUnits: [] });
    expect(plan.steps[0]).toMatchObject({ kind: 'check', unitKey: 'c1' });
    expect(plan.steps[1]).toMatchObject({ kind: 'challenge', unitKey: 'c1', skillKey: 'c1.apply', typed: true });
  });

  it('corrige con peso honesto: opciones = reconocimiento; escrito u ordenado en repaso = aplicación', () => {
    expect(gradeChallenge(predict, '2', false)).toEqual({ correct: true, format: 'recognition_choice', hint: 0 });
    expect(gradeChallenge(predict, ' Dos ', true)).toEqual({ correct: true, format: 'application', hint: 0 });
    expect(gradeChallenge(predict, '11', true).correct).toBe(false);
    expect(gradeChallenge(order, ['a', 'b', 'c'], true)).toMatchObject({ correct: true, format: 'application' });
    expect(gradeChallenge(order, ['b', 'a', 'c'], false)).toMatchObject({ correct: false, format: 'recognition_choice' });
    expect(gradeChallenge(predict, '', true, true)).toMatchObject({ correct: false, hint: 5 });
    expect(shuffledSteps(order, 'x')).not.toEqual(order.steps);
    expect(challengeChoices(predict, 'x').map((c) => c.label).sort()).toEqual(['11', '2', 'error']);
  });
});

describe('retos de memoria: puntuación', () => {
  const w = ['Pingüino', 'Sartén', 'Cactus', 'Semáforo', 'Dinosaurio'];
  it('cuenta lo recordado, la racha en orden y las falsas (sin tildes ni mayúsculas)', () => {
    expect(scoreRecall(w, ['pinguino', 'sarten', 'semáforo', 'cactus', 'Pato'])).toEqual({ remembered: 4, inOrder: 2, wrong: 1, total: 5 });
    expect(scoreRecall(w, w)).toMatchObject({ remembered: 5, inOrder: 5, wrong: 0 });
  });
  it('al revés: la racha se cuenta desde la última palabra', () => {
    expect(scoreRecall(w, ['Dinosaurio', 'Semáforo', 'Cactus'], true).inOrder).toBe(3);
    expect(scoreRecall(w, ['Pingüino'], true).inOrder).toBe(0);
  });
});

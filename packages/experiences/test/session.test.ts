import { describe, expect, it } from 'vitest';
import { applyAttempt, applyExposure, createLearner, resolveConfig, type Attempt, type PlanItem } from '@memora/core';
import { buildSession, eventsForStep, exerciseFor, gradeStep, type ClientEvent } from '../src';
import { borrow, canI, cantFind } from './fixtures';

const units = { borrow, 'can-i': canI, 'i-cant-find': cantFind };
const item = (skillId: string, unitId: string, reason: 'new' | 'review', recommendedHint: PlanItem['recommendedHint'] = 0, associationId?: string): PlanItem => ({ skillId, unitId, reason, priority: 0, recommendedHint, ...(associationId ? { associationId } : {}) });
const meta = () => {
  let seq = 0;
  let id = 0;
  return { at: 1_000, deviceId: 'mac', nextSeq: () => ++seq, newId: () => `e${++id}` };
};

describe('construcción de la sesión', () => {
  it('lo nuevo sigue el recorrido escuchar → asociar → recuperar → ordenar → frase propia, y acaba en resultado', () => {
    const plan = buildSession({ sessionId: 's1', courseId: 'c', day: 1, createdAt: 0, units, items: [item('borrow.produce', 'borrow', 'new'), item('borrow.recall', 'borrow', 'new', 0, 'a-borrow'), item('borrow.listen', 'borrow', 'new')] });
    expect(plan.steps.map((s) => s.kind)).toEqual(['listen', 'associate', 'recall', 'order', 'produce', 'result']);
    expect(plan.steps.filter((s) => s.exposeFirst).map((s) => s.kind)).toEqual(['listen', 'associate', 'order']);
  });

  it('los repasos van primero y empiezan con la pista que marca la escalera', () => {
    const plan = buildSession({ sessionId: 's2', courseId: 'c', day: 2, createdAt: 0, units, items: [item('can-i.recall', 'can-i', 'new'), item('borrow.recall', 'borrow', 'review', 3, 'a-borrow'), item('borrow.listen', 'borrow', 'review')] });
    expect(plan.steps.map((s) => `${s.kind}:${s.reason}`)).toEqual(['recall:review', 'dictation:review', 'structure:new', 'recall:new', 'result:new']);
    expect(plan.steps[0]?.startHint).toBe(3);
  });

  it('sin nada que hacer no hay pasos', () => {
    expect(buildSession({ sessionId: 's', courseId: 'c', day: 1, createdAt: 0, units, items: [] }).steps).toEqual([]);
  });
});

describe('ejercicios y corrección', () => {
  const plan = buildSession({ sessionId: 's1', courseId: 'c', day: 1, createdAt: 0, units, items: [item('borrow.recall', 'borrow', 'new', 0, 'a-borrow'), item('borrow.produce', 'borrow', 'new')] });
  const recall = plan.steps.find((s) => s.kind === 'recall')!;
  const ex = exerciseFor(recall, borrow, [canI], 's1');

  it('recuperar sin ver: se pide desde el significado y las pistas siguen la escalera P1–P4', () => {
    expect(ex).toMatchObject({ kind: 'recall', prompt: 'pedir prestado', expected: 'borrow' });
    if (ex.kind !== 'recall') throw new Error();
    expect(ex.hints).toEqual(['b _ _ _ _ _', 'Can I _____ your charger?', 'burro', 'Un BURRO te PIDE PRESTADO el móvil.']);
  });

  it('sin pista es recuperación sin ayuda; con pista, con ayuda; revelar no cuenta como acierto', () => {
    expect(gradeStep(recall, ex, { text: 'Borrow', timeMs: 3000 })).toMatchObject({ correct: true, format: 'recall_unaided', hint: 0 });
    expect(gradeStep(recall, ex, { text: 'borrow', hintUsed: 2, timeMs: 3000 })).toMatchObject({ correct: true, format: 'recall_cued', hint: 2 });
    expect(gradeStep(recall, ex, { text: 'borrow', revealed: true, timeMs: 3000 })).toMatchObject({ correct: false, hint: 5 });
  });

  it('un patrón se recupera rellenando su pieza fija en un ejemplo', () => {
    const p = buildSession({ sessionId: 'x', courseId: 'c', day: 1, createdAt: 0, units, items: [item('can-i.recall', 'can-i', 'new')] });
    const e = exerciseFor(p.steps[1]!, canI, [], 'x');
    expect(e).toMatchObject({ kind: 'recall', mode: 'blank', expected: 'Can I' });
    if (e.kind === 'recall') expect(e.prompt.startsWith('_____ ')).toBe(true);
  });

  it('ordenar cuenta como reconocimiento y la frase propia como producción', () => {
    const order = plan.steps.find((s) => s.kind === 'order')!;
    const oe = exerciseFor(order, borrow, [canI], 's1');
    if (oe.kind !== 'order') throw new Error();
    expect(gradeStep(order, oe, { order: oe.answer, timeMs: 5000 })).toMatchObject({ correct: true, format: 'recognition_choice' });
    const produce = plan.steps.find((s) => s.kind === 'produce')!;
    const pe = exerciseFor(produce, borrow, [canI], 's1');
    expect(gradeStep(produce, pe, { text: 'Can I borrow your car tonight?', timeMs: 9000 })).toMatchObject({ correct: true, format: 'production' });
    expect(gradeStep(produce, pe, { text: 'Can I borrow your charger?', timeMs: 9000 })).toMatchObject({ correct: false, problems: ['copied_example'] });
  });
});

describe('eventos', () => {
  it('el primer paso de una habilidad nueva registra la exposición y los ejercicios registran el intento', () => {
    const plan = buildSession({ sessionId: 's1', courseId: 'c', day: 1, createdAt: 0, units, items: [item('borrow.recall', 'borrow', 'new', 0, 'a-borrow')] });
    const m = meta();
    const [associate, recall] = plan.steps;
    const e1 = eventsForStep(plan, associate!, exerciseFor(associate!, borrow, [], 's1'), null, null, m);
    const ex = exerciseFor(recall!, borrow, [], 's1');
    const answer = { text: 'borrow', timeMs: 2500 };
    const e2 = eventsForStep(plan, recall!, ex, gradeStep(recall!, ex, answer), answer, m);
    expect(e1.map((e) => e.kind)).toEqual(['exposure']);
    expect(e1[0]).toMatchObject({ skillKey: 'borrow.recall', associationId: 'a-borrow', seq: 1 });
    expect(e2).toEqual([expect.objectContaining({ kind: 'attempt', format: 'recall_unaided', correct: true, hint: 0, contextId: 'borrow#recall', seq: 2, timeMs: 2500 })]);
  });

  it('los eventos se pueden aplicar al núcleo tal cual', () => {
    const config = resolveConfig();
    const toCore = (e: ClientEvent) => ({ id: e.id, userId: 'u', skillId: e.skillKey, unitId: e.unitKey, at: e.at, ...(e.associationId ? { associationId: e.associationId } : {}), ...(e.contextId ? { contextId: e.contextId } : {}) });
    const plan = buildSession({ sessionId: 's1', courseId: 'c', day: 1, createdAt: 0, units, items: [item('borrow.recall', 'borrow', 'new', 0, 'a-borrow'), item('borrow.produce', 'borrow', 'new')] });
    const m = meta();
    let learner = createLearner('u');
    for (const step of plan.steps) {
      const ex = exerciseFor(step, borrow, [canI], 's1');
      const answer = ex.kind === 'order' ? { order: ex.answer, timeMs: 3000 } : { text: ex.kind === 'produce' ? 'Can I borrow your bike today?' : 'borrow', timeMs: 3000 };
      for (const e of eventsForStep(plan, step, ex, gradeStep(step, ex, answer), answer, m)) {
        learner = e.kind === 'exposure'
          ? applyExposure(learner, toCore(e), config)
          : applyAttempt(learner, { ...toCore(e), format: e.format!, correct: e.correct!, hint: e.hint!, timeMs: e.timeMs! } as Attempt, config).learner;
      }
    }
    expect(learner.skills['borrow.recall']?.status).toBe('learning');
    expect(learner.skills['borrow.produce']?.status).toBe('learning');
    expect(learner.associations['a-borrow']?.retrievals).toBe(1);
  });
});

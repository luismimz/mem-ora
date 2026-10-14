import { describe, expect, it } from 'vitest';
import { DAY, applyAttempt, applyExposure, createLearner, planDay, resolveConfig, type Catalog, type CoreConfig, type LearnerState } from '../src';
import { T0, attempt, exposure } from './helpers';

function catalogOf(n: number, withPrereq = false): Catalog {
  const units = Array.from({ length: n }, (_, i) => ({ id: `k${i}`, courseId: 'c', type: 'term' }));
  return {
    units,
    skills: units.map((u) => ({ id: `${u.id}.recall`, unitId: u.id, kind: 'recall' as const })),
    prerequisites: withPrereq ? [{ subject: { skill: 'k1.recall' }, requires: { skill: 'k0.recall' } }] : [],
  };
}

/** Presenta e intenta `count` habilidades el día `at`. */
function learn(learner: LearnerState, count: number, at: number, cfg: CoreConfig, from = 0): LearnerState {
  let l = learner;
  for (let i = from; i < from + count; i += 1) {
    l = applyExposure(l, exposure({ skillId: `k${i}.recall`, unitId: `k${i}`, at }), cfg);
    l = applyAttempt(l, attempt({ skillId: `k${i}.recall`, unitId: `k${i}`, at: at + 1_000, format: 'recall_cued', hint: 1 }), cfg).learner;
  }
  return l;
}

describe('plan del día', () => {
  const cfg = resolveConfig({ load: { newCap: 5, reviewCap: 10, totalCap: 12, backlogSuppressNew: 3 } });

  it('los repasos vencidos van antes que lo nuevo', () => {
    const learner = learn(createLearner('u1'), 3, T0, cfg);
    const plan = planDay({ catalog: catalogOf(20), learner, now: T0 + 2 * DAY, config: cfg });
    expect(plan.stats.reviewSlots).toBe(3);
    expect(plan.items.slice(0, 3).every((i) => i.reason === 'review')).toBe(true);
    expect(plan.items.slice(3).every((i) => i.reason === 'new')).toBe(true);
  });

  it('respeta los topes de repaso, de lo nuevo y total', () => {
    const learner = learn(createLearner('u1'), 15, T0 - DAY, cfg);
    const plan = planDay({ catalog: catalogOf(40), learner, now: T0 + DAY, config: cfg });
    // Se reserva el mínimo de lo nuevo (3) antes de repartir los repasos: 12 − 3 = 9 repasos.
    expect(plan.items.filter((i) => i.reason === 'review')).toHaveLength(9);
    expect(plan.items.length).toBeLessThanOrEqual(12);
    expect(plan.stats.backlog).toBe(6);
  });

  it('con demasiados vencidos fuera del día solo entra el mínimo de lo nuevo, nunca cero', () => {
    const learner = learn(createLearner('u1'), 15, T0 - DAY, cfg);
    const plan = planDay({ catalog: catalogOf(40), learner, now: T0 + DAY, config: cfg });
    expect(plan.stats.newSuppressedByBacklog).toBe(true);
    expect(plan.items.filter((i) => i.reason === 'new')).toHaveLength(cfg.load.minNewPerDay);
  });

  it('el mínimo de lo nuevo descuenta lo ya introducido hoy', () => {
    const learner = learn(createLearner('u1'), 15, T0 - DAY, cfg);
    const today = learn(learner, 2, T0 + DAY - 60_000, cfg, 20);
    const plan = planDay({ catalog: catalogOf(40), learner: today, now: T0 + DAY, config: cfg });
    expect(plan.items.filter((i) => i.reason === 'new')).toHaveLength(1);
  });

  it('prioriza lo más retrasado', () => {
    let learner = learn(createLearner('u1'), 1, T0 - 5 * DAY, cfg, 0);
    learner = learn(learner, 1, T0 - DAY, cfg, 1);
    const plan = planDay({ catalog: catalogOf(5), learner, now: T0 + DAY, config: cfg });
    expect(plan.items[0]?.skillId).toBe('k0.recall');
  });

  it('descuenta lo ya hecho hoy del tope diario', () => {
    const learner = learn(createLearner('u1'), 5, T0, cfg);
    const plan = planDay({ catalog: catalogOf(40), learner, now: T0 + 60_000, config: cfg });
    expect(plan.items.filter((i) => i.reason === 'new')).toHaveLength(0);
  });

  it('no introduce lo bloqueado por prerrequisitos', () => {
    const plan = planDay({ catalog: catalogOf(3, true), learner: createLearner('u1'), now: T0, config: cfg });
    expect(plan.items.map((i) => i.skillId)).toEqual(['k0.recall', 'k2.recall']);
  });

  it('reduce lo nuevo si la precisión reciente es baja', () => {
    let learner = createLearner('u1');
    for (let i = 0; i < 12; i += 1) {
      learner = applyAttempt(learner, attempt({ skillId: `x${i}`, unitId: 'x', at: T0 - DAY + i, correct: i < 3 }), cfg).learner;
    }
    const plan = planDay({ catalog: catalogOf(20), learner, now: T0, config: cfg });
    expect(plan.stats.newLoadFactor).toBe(0);
    // Con mala racha se frena lo nuevo, pero entra el mínimo.
    expect(plan.items.filter((i) => i.reason === 'new')).toHaveLength(cfg.load.minNewPerDay);
  });
});

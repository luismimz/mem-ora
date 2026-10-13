import { describe, expect, it } from 'vitest';
import {
  DAY,
  applyAssociationAttempt,
  assessAssociation,
  newAssociationState,
  presentAssociation,
  recommendedHint,
  resolveAssociationReview,
  type AssociationState,
  type Attempt,
} from '../src';
import { T0, attempt, config } from './helpers';

const start = (): AssociationState => presentAssociation(newAssociationState('as1'), T0, config);
const run = (state: AssociationState, attempts: Attempt[]): AssociationState =>
  attempts.reduce((s, a) => applyAssociationAttempt(s, { ...a, associationId: 'as1' }, config).state, state);

describe('calendario de la asociación', () => {
  it('recupera a +1 d, +3 d, +7 d, +14 d y +30 d si se acierta sin pista', () => {
    let s = start();
    expect(s.dueAt).toBe(T0 + DAY);
    const gaps: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      s = run(s, [attempt({ at: s.dueAt! })]);
      gaps.push((s.dueAt! - s.lastExposureAt!) / DAY);
    }
    expect(gaps).toEqual([3, 7, 14, 30, 30]);
  });

  it('un acierto con pista no avanza el calendario', () => {
    const s = run(start(), [attempt({ at: T0 + DAY, format: 'recall_cued', hint: 2 })]);
    expect(s.step).toBe(0);
  });
});

describe('escalera de pistas E0–E5', () => {
  it('sube tras un fallo y baja con el éxito', () => {
    let s = run(start(), [attempt({ at: T0 + DAY, correct: false })]);
    expect(recommendedHint(s)).toBe(1);
    s = run(s, [attempt({ at: T0 + 2 * DAY, format: 'recall_cued', hint: 1, correct: false })]);
    expect(recommendedHint(s)).toBe(2);
    s = run(s, [attempt({ at: T0 + 3 * DAY, format: 'recall_cued', hint: 2 })]);
    expect(recommendedHint(s)).toBe(1);
    s = run(s, [attempt({ at: T0 + 4 * DAY, format: 'recall_cued', hint: 1 })]);
    expect(recommendedHint(s)).toBe(0);
  });

  it('nunca recomienda E5 (revelar no es una pista)', () => {
    const fails = Array.from({ length: 8 }, (_, i) => attempt({ at: T0 + (i + 1) * DAY, format: 'recall_cued', hint: 4, correct: false }));
    expect(recommendedHint(run(start(), fails))).toBe(config.association.maxRecommendedHint);
  });

  it('el reconocimiento no cuenta para la asociación', () => {
    const before = start();
    const result = applyAssociationAttempt(before, attempt({ at: T0 + DAY, format: 'recognition_choice', associationId: 'as1' }), config);
    expect(result.counted).toBe(false);
    expect(result.state).toBe(before);
  });
});

describe('diagnóstico y revisión', () => {
  it('tras dos fallos seguidos se marca para revisión y se está perdiendo', () => {
    const s = run(start(), [attempt({ at: T0 + DAY, correct: false }), attempt({ at: T0 + 2 * DAY, format: 'recall_cued', hint: 1, correct: false })]);
    expect(s.status).toBe('review_needed');
    expect(s.reviewReasons).toContain('consecutive_failures');
    const a = assessAssociation(s, config);
    expect(a.trajectory).toBe('losing');
    expect(a.needsReview).toBe(true);
  });

  it('se está quedando con recuperaciones diferidas sin pista seguidas', () => {
    const s = run(start(), [attempt({ at: T0 + DAY }), attempt({ at: T0 + 4 * DAY })]);
    expect(assessAssociation(s, config).trajectory).toBe('holding');
  });

  it('sin datos suficientes no emite diagnóstico', () => {
    expect(assessAssociation(run(start(), [attempt({ at: T0 + DAY })]), config).trajectory).toBe('insufficient_data');
  });

  it('un fallo tras estar asentada indica pérdida', () => {
    const s = run(start(), [attempt({ at: T0 + DAY }), attempt({ at: T0 + 4 * DAY }), attempt({ at: T0 + 11 * DAY, correct: false })]);
    expect(assessAssociation(s, config)).toMatchObject({ trajectory: 'losing' });
    expect(assessAssociation(s, config).reasons).toContain('failed_after_established');
  });

  it('con pista y aciertos intermitentes está formándose', () => {
    const s = run(start(), [attempt({ at: T0 + DAY, format: 'recall_cued', hint: 2 }), attempt({ at: T0 + 2 * DAY })]);
    expect(assessAssociation(s, config).trajectory).toBe('forming');
  });

  it('al sustituirla, la medición empieza de cero con otra versión', () => {
    const lost = run(start(), [attempt({ at: T0 + DAY, correct: false }), attempt({ at: T0 + 2 * DAY, format: 'recall_cued', hint: 1, correct: false })]);
    const replaced = resolveAssociationReview(lost, T0 + 3 * DAY, 'replaced', config);
    expect(replaced).toMatchObject({ version: 2, status: 'active', hintLevel: 0, history: [], retrievals: 0, dueAt: T0 + 4 * DAY });
    const kept = resolveAssociationReview(lost, T0 + 3 * DAY, 'kept', config);
    expect(kept).toMatchObject({ version: 1, status: 'active', hintLevel: lost.hintLevel });
  });
});

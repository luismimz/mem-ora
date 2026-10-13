import { describe, expect, it } from 'vitest';
import { DAY, InvalidAttemptError, applyAttempt, applyEvents, applyExposure, createLearner, deserializeLearner, serializeLearner } from '../src';
import { T0, attempt, config, exposure } from './helpers';

describe('idempotencia', () => {
  it('aplicar el mismo intento dos veces no cambia nada', () => {
    const a = attempt({ id: 'same', at: T0 + DAY, associationId: 'as1' });
    const once = applyAttempt(createLearner('u1'), a, config);
    const twice = applyAttempt(once.learner, a, config);
    expect(twice.applied).toBe(false);
    expect(twice.learner).toBe(once.learner);
    expect(once.learner.skills.s1?.attempts).toBe(1);
  });

  it('una exposición repetida no cuenta dos veces como nueva', () => {
    const e = exposure({ id: 'e-same', at: T0 });
    const l = applyExposure(applyExposure(createLearner('u1'), e, config), e, config);
    expect(l.activity[String(Math.floor(T0 / DAY))]?.introduced).toBe(1);
  });

  it('el orden de llegada no importa y los duplicados se ignoran', () => {
    const events = [
      { kind: 'exposure' as const, event: exposure({ id: 'e1', at: T0, associationId: 'as1' }) },
      { kind: 'attempt' as const, event: attempt({ id: 'x1', at: T0 + 60_000, associationId: 'as1' }) },
      { kind: 'attempt' as const, event: attempt({ id: 'x2', at: T0 + DAY, associationId: 'as1' }) },
      { kind: 'attempt' as const, event: attempt({ id: 'x3', at: T0 + 3 * DAY, associationId: 'as1', correct: false }) },
    ];
    const forward = applyEvents(createLearner('u1'), events, config);
    const shuffled = applyEvents(createLearner('u1'), [events[3]!, events[1]!, events[0]!, events[2]!, events[1]!], config);
    expect(serializeLearner(shuffled)).toBe(serializeLearner(forward));
  });
});

describe('validación y propiedad', () => {
  it('rechaza intentos inválidos y de otro alumno', () => {
    expect(() => applyAttempt(createLearner('u1'), attempt({ at: T0, format: 'recall_unaided', hint: 3 }), config)).toThrow(InvalidAttemptError);
    expect(() => applyAttempt(createLearner('u1'), attempt({ at: T0, userId: 'u2' }), config)).toThrow(/otro alumno/);
  });
});

describe('serialización', () => {
  it('ida y vuelta conserva el estado y es estable', () => {
    let l = applyExposure(createLearner('u1'), exposure({ at: T0, associationId: 'as1' }), config);
    l = applyAttempt(l, attempt({ at: T0 + DAY, associationId: 'as1' }), config).learner;
    const text = serializeLearner(l);
    const back = deserializeLearner(text);
    expect(back).toEqual(l);
    expect(serializeLearner(back)).toBe(text);
  });

  it('rechaza versiones desconocidas o estados incompletos', () => {
    expect(() => deserializeLearner(JSON.stringify({ ...createLearner('u1'), schemaVersion: 99 }))).toThrow(/Versión/);
    expect(() => deserializeLearner(JSON.stringify({ schemaVersion: 2, userId: 'u1' }))).toThrow(/incompleto/);
  });
});

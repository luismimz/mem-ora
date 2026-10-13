import { describe, expect, it } from 'vitest';
import { DAY, HOUR, evidenceWeight, isDeferredSuccess, validateAttempt } from '../src';
import { T0, attempt, config } from './helpers';

describe('peso de la evidencia', () => {
  it('sigue la tabla: reconocer < escuchar = pistas < recuperar < producir = aplicar', () => {
    const w = (format: Parameters<typeof attempt>[0]['format'], hint = 0 as const) => evidenceWeight(attempt({ at: T0, format, hint }), config);
    expect(w('recognition_choice')).toBeLessThan(w('recognition_listening'));
    expect(evidenceWeight(attempt({ at: T0, format: 'recall_cued', hint: 1 }), config)).toBeLessThan(w('recall_unaided'));
    expect(w('recall_unaided')).toBeLessThan(w('production'));
    expect(w('production')).toBe(w('application'));
  });

  it('cada nivel de pista pesa menos y P5 no pesa nada', () => {
    const weights = ([1, 2, 3, 4] as const).map((hint) => evidenceWeight(attempt({ at: T0, format: 'recall_cued', hint }), config));
    for (let i = 1; i < weights.length; i += 1) expect(weights[i]).toBeLessThan(weights[i - 1]!);
    expect(evidenceWeight(attempt({ at: T0, format: 'recall_cued', hint: 5, correct: false }), config)).toBe(0);
  });

  it('un acierto lento («dudado») pesa menos y un fallo no pesa', () => {
    const fast = evidenceWeight(attempt({ at: T0, timeMs: 2_000 }), config);
    const slow = evidenceWeight(attempt({ at: T0, timeMs: 12_000 }), config);
    expect(slow).toBeLessThan(fast);
    expect(evidenceWeight(attempt({ at: T0, correct: false }), config)).toBe(0);
  });
});

describe('validación del intento', () => {
  it('rechaza combinaciones imposibles', () => {
    expect(validateAttempt(attempt({ at: T0, format: 'recall_unaided', hint: 2 }))).toContain('recall_unaided no admite pista');
    expect(validateAttempt(attempt({ at: T0, format: 'recall_cued', hint: 0 }))).toContain('recall_cued exige pista');
    expect(validateAttempt(attempt({ at: T0, format: 'recall_cued', hint: 5, correct: true }))).toContain('P5 revela la respuesta: no puede ser acierto');
    expect(validateAttempt(attempt({ at: T0 }))).toEqual([]);
  });
});

describe('éxito diferido', () => {
  const last = T0;
  it('exige acierto, sin pista, en recuperación o producción y tras el tiempo mínimo', () => {
    expect(isDeferredSuccess(attempt({ at: last + DAY }), last, config)).toBe(true);
    expect(isDeferredSuccess(attempt({ at: last + DAY, format: 'production' }), last, config)).toBe(true);
    expect(isDeferredSuccess(attempt({ at: last + DAY, correct: false }), last, config)).toBe(false);
    expect(isDeferredSuccess(attempt({ at: last + DAY, format: 'recall_cued', hint: 1 }), last, config)).toBe(false);
    expect(isDeferredSuccess(attempt({ at: last + 2 * HOUR }), last, config)).toBe(false);
    expect(isDeferredSuccess(attempt({ at: last + DAY }), null, config)).toBe(false);
  });

  it('acepta el dictado y la explicación libre de lo oído', () => {
    expect(isDeferredSuccess(attempt({ at: last + DAY, format: 'listening_transcribe' }), last, config)).toBe(true);
    expect(isDeferredSuccess(attempt({ at: last + DAY, format: 'listening_explain' }), last, config)).toBe(true);
  });

  it('nunca acepta solo reconocimiento, aunque pase el tiempo', () => {
    expect(isDeferredSuccess(attempt({ at: last + 10 * DAY, format: 'recognition_choice' }), last, config)).toBe(false);
    expect(isDeferredSuccess(attempt({ at: last + 10 * DAY, format: 'recognition_listening' }), last, config)).toBe(false);
  });
});

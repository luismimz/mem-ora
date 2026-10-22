import { describe, expect, it } from 'vitest';
import { dueUnits, errorUnits, pendingFailures, streakOf, weakUnits, type SkillState } from '../src';

const skill = (unitId: string, over: Partial<SkillState> = {}): SkillState => ({
  skillId: `${unitId}-r`, unitId, status: 'learning', evidence: 0, retrievalSuccesses: 0, deferredSuccesses: 0, consecutiveFailures: 0,
  lapses: 0, attempts: 3, accuracy: 0.8, step: 1, dueAt: null, presentedAt: 1, lastExposureAt: 1, lastAttemptAt: 1, unaidedFormats: [], contexts: [], ...over,
});
const map = (...s: SkillState[]) => Object.fromEntries(s.map((x) => [x.skillId, x]));

describe('errores y refuerzo (D-077)', () => {
  it('«tus errores» son lo fallado, lo más grave primero, y nunca lo no empezado', () => {
    const skills = map(skill('a', { consecutiveFailures: 1, lastAttemptAt: 10 }), skill('b', { lapses: 2 }), skill('c'), skill('d', { attempts: 0, consecutiveFailures: 2 }));
    expect(errorUnits(skills)).toEqual(['a', 'b']);
    expect(errorUnits(skills, 4, ['a'])).toEqual(['b']);
  });
  it('el refuerzo elige lo más débil ya trabajado', () => {
    const skills = map(skill('fuerte', { accuracy: 0.95, deferredSuccesses: 4 }), skill('floja', { accuracy: 0.4 }), skill('media'), skill('nueva', { attempts: 0 }));
    expect(weakUnits(skills, 2)).toEqual(['floja', 'media']);
    expect(weakUnits(skills)).not.toContain('nueva');
  });
});

describe('fallos pendientes y repasos que tocan (mapa de misiones)', () => {
  it('un fallo pendiente es lo fallado desde su último acierto, lo más reciente primero; lo olvidado y acertado después no cuenta', () => {
    const skills = map(skill('vieja', { consecutiveFailures: 1, lastAttemptAt: 5 }), skill('reciente', { consecutiveFailures: 2, lastAttemptAt: 9 }), skill('olvidada', { lapses: 3 }), skill('sin-empezar', { attempts: 0, consecutiveFailures: 1 }));
    expect(pendingFailures(skills)).toEqual(['reciente', 'vieja']);
    expect(pendingFailures(skills, 1)).toEqual(['reciente']);
  });
  it('al acertar, el fallo sale de la lista', () => {
    expect(pendingFailures(map(skill('a', { consecutiveFailures: 0, lastAttemptAt: 20 })))).toEqual([]);
  });
  it('conviene repasar lo trabajado que ya vence, no lo futuro ni lo no empezado', () => {
    const skills = map(skill('vence', { dueAt: 100 }), skill('futuro', { dueAt: 500 }), skill('nuevo', { attempts: 0, dueAt: 50 }));
    expect([...dueUnits(skills, 200)]).toEqual(['vence']);
  });
});

describe('racha con protector (D-077)', () => {
  const days = (...d: number[]) => Object.fromEntries(d.map((x) => [String(x), { attempts: 5, correct: 4, introduced: 0, reviews: 0 }]));
  it('cuenta los días seguidos; hoy sin estudiar no la rompe', () => {
    expect(streakOf(days(1, 2, 3), 3).days).toBe(3);
    expect(streakOf(days(1, 2, 3), 4).days).toBe(3);
  });
  it('sin protector, un día perdido la rompe', () => {
    expect(streakOf(days(1, 2, 4, 5), 5)).toEqual({ days: 2, shields: 0, saved: 0 });
  });
  it('cada 7 días se gana un protector que salva un día perdido', () => {
    const r = streakOf(days(1, 2, 3, 4, 5, 6, 7, 9, 10), 10);
    expect(r).toEqual({ days: 9, shields: 0, saved: 1 });
    expect(streakOf(days(1, 2, 3, 4, 5, 6, 7), 7).shields).toBe(1);
  });
  it('como mucho se guardan 2 protectores', () => {
    const all = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(streakOf(days(...all), 30).shields).toBe(2);
  });
});

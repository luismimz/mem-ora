import { describe, expect, it } from 'vitest';
import { dueUnits, dueWords, dueWordsLeastSeen, wordsLeastPracticed, MATURE_STEP, errorUnits, pendingFailures, streakOf, weakUnits, type SkillState } from '../src';

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
  it('recuerda la mejor racha aunque la actual se haya cortado', () => {
    const days = (...d: number[]) => Object.fromEntries(d.map((x) => [String(x), { attempts: 5, correct: 4, introduced: 0, reviews: 0 }]));
    const s = streakOf(days(1, 2, 3, 4, 5, 20, 21), 21, { shieldEvery: 99, maxShields: 0 });
    expect(s.days).toBe(2);
    expect(s.best).toBe(5);
  });
  const days = (...d: number[]) => Object.fromEntries(d.map((x) => [String(x), { attempts: 5, correct: 4, introduced: 0, reviews: 0 }]));
  it('cuenta los días seguidos; hoy sin estudiar no la rompe', () => {
    expect(streakOf(days(1, 2, 3), 3).days).toBe(3);
    expect(streakOf(days(1, 2, 3), 4).days).toBe(3);
  });
  it('sin protector, un día perdido la rompe', () => {
    expect(streakOf(days(1, 2, 4, 5), 5)).toEqual({ days: 2, shields: 0, saved: 0, best: 2 });
  });
  it('cada 7 días se gana un protector que salva un día perdido', () => {
    const r = streakOf(days(1, 2, 3, 4, 5, 6, 7, 9, 10), 10);
    expect(r).toEqual({ days: 9, shields: 0, saved: 1, best: 9 });
    expect(streakOf(days(1, 2, 3, 4, 5, 6, 7), 7).shields).toBe(1);
  });
  it('como mucho se guardan 2 protectores', () => {
    const all = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(streakOf(days(...all), 30).shields).toBe(2);
  });
});

describe('dueWords (D-094): repaso por palabra según su curva', () => {
  const kinds: Record<string, string> = { 'boy.recall': 'recall', 'boy.listen': 'listen', 'boy.produce': 'produce', 'nine.recall': 'recall', 'g1.recall': 'recall', 'cat.listen': 'listen' };
  const items = [
    { skillId: 'boy.listen', unitId: 'boy', reason: 'review' },
    { skillId: 'nine.recall', unitId: 'nine', reason: 'review' },
    { skillId: 'boy.recall', unitId: 'boy', reason: 'review' },
    { skillId: 'boy.produce', unitId: 'boy', reason: 'review' },
    { skillId: 'g1.recall', unitId: 'g1', reason: 'review' },
    { skillId: 'cat.listen', unitId: 'cat', reason: 'review' },
    { skillId: 'new.recall', unitId: 'new', reason: 'new' },
  ];
  const skills = { 'nine.recall': skill('nine', { step: MATURE_STEP }), 'boy.recall': skill('boy', { step: 1 }) };
  const words = dueWords(items, (id) => kinds[id], (u) => u !== 'g1', skills);
  it('cada palabra sale UNA vez, en el orden de urgencia del plan, solo si toca su habilidad de recordar', () => {
    expect(words.map((w) => w.unitKey)).toEqual(['nine', 'boy']);
  });
  it('lo maduro se repasa recordando; lo joven, reconociendo', () => {
    expect(words).toEqual([{ unitKey: 'nine', recall: true }, { unitKey: 'boy', recall: false }]);
  });
});

describe('dueWordsLeastSeen (5-nov-2026): todas las vencidas, las menos vistas primero', () => {
  const st = (unitId: string, attempts: number, dueAt: number | null, step = 1) => ({ unitId, status: 'learning', attempts, dueAt, step } as unknown as SkillState);
  const defs = ['blue', 'boy', 'cat', 'dog', 'g1'].flatMap((u) => [{ id: `${u}.recall`, unitId: u, kind: 'recall' }, { id: `${u}.recognize`, unitId: u, kind: 'recognize' }]);
  const skills = { 'blue.recall': st('blue', 40, 50), 'boy.recall': st('boy', 35, 10), 'cat.recall': st('cat', 3, 90), 'dog.recall': st('dog', 3, 20, 4), 'g1.recall': st('g1', 0, 5), 'blue.recognize': st('blue', 9, null) };
  it('las menos practicadas primero; a igualdad, la que más espera; sin las no vencidas ni la gramática', () => {
    const w = dueWordsLeastSeen(defs, skills, (u) => u !== 'g1', 100);
    expect(w.map((x) => x.unitKey)).toEqual(['dog', 'cat', 'boy', 'blue']);
    expect(w[0]!.recall).toBe(true);
    expect(dueWordsLeastSeen(defs, skills, (u) => u !== 'g1', 30).map((x) => x.unitKey)).toEqual(['dog', 'boy']);
  });
});

describe('dueWordsLeastSeen con dayStart (6-nov-2026): lo practicado hoy espera a mañana', () => {
  it('quita lo ya practicado hoy sin fallo; deja lo fallado hoy y lo de otros días', () => {
    const mk = (unitId: string, last: number, fails = 0, attempts = 3) => ({ skillId: `${unitId}.recall`, unitId, status: 'learning', evidence: 1, retrievalSuccesses: 1, deferredSuccesses: 0, consecutiveFailures: fails, lapses: 0, attempts, accuracy: 0.7, step: 1, dueAt: 50, presentedAt: 0, lastExposureAt: 0, lastAttemptAt: last, unaidedFormats: [], contexts: [] }) as SkillState;
    const skills = { 'hoy.recall': mk('hoy', 90, 0, 1), 'mal.recall': mk('mal', 95, 1, 1), 'viejo.recall': mk('viejo', 10, 0, 9), 'neck.recall': mk('neck', 10, 0, 2) };
    const defs = Object.values(skills).map((s) => ({ id: s.skillId, unitId: s.unitId, kind: 'recall' }));
    expect(dueWordsLeastSeen(defs, skills, () => true, 100, 80).map((x) => x.unitKey)).toEqual(['mal', 'neck', 'viejo']);
    expect(dueWordsLeastSeen(defs, skills, () => true, 100).map((x) => x.unitKey)).toEqual(['hoy', 'mal', 'neck', 'viejo']);
  });
});

describe('wordsLeastPracticed (usuario, 6-nov-2026): menos aciertos primero; a igualdad, la más antigua', () => {
  const mk = (unitId: string, successes: number, presentedAt: number, status = 'learning') => ({ skillId: `${unitId}.recall`, unitId, status, evidence: 1, retrievalSuccesses: 1, deferredSuccesses: 0, consecutiveFailures: 0, lapses: 0, attempts: successes + 1, successes, accuracy: 0.7, step: 1, dueAt: 10_000, presentedAt, lastExposureAt: presentedAt, lastAttemptAt: presentedAt, unaidedFormats: [], contexts: [] }) as SkillState;
  const order = (sk: Record<string, SkillState>) => wordsLeastPracticed(Object.values(sk).map((x) => ({ id: x.skillId, unitId: x.unitId, kind: 'recall' })), sk, () => true).map((x) => x.unitKey);
  it('lo del lunes con 1 acierto y lo de ayer con 2 salen antes que lo de hoy con 3, sin mirar si «toca»', () => {
    expect(order({ 'hoy.recall': mk('hoy', 3, 90), 'ayer.recall': mk('ayer', 2, 50), 'lunes.recall': mk('lunes', 1, 10), 'nueva.recall': mk('nueva', 0, 0, 'new') })).toEqual(['lunes', 'ayer', 'hoy']);
  });
  it('lo muy fallado (pocos aciertos) sale antes que lo acertado', () => {
    expect(order({ 'fallada.recall': { ...mk('fallada', 1, 80), attempts: 9 }, 'acertada.recall': mk('acertada', 4, 10) })).toEqual(['fallada', 'acertada']);
  });
  it('si todas tienen los mismos aciertos: de la más antigua a la más nueva', () => {
    expect(order({ 'c.recall': mk('c', 3, 30), 'a.recall': mk('a', 3, 10), 'b.recall': mk('b', 3, 20) })).toEqual(['a', 'b', 'c']);
  });
});

import { describe, expect, it } from 'vitest';
import { buildMistake } from '../src/Feed';

describe('Construye la frase: en qué te has equivocado (D-086, D-088)', () => {
  const mirror = { say: 'Tiene los ojos marrones', pieces: [{ es: 'ELLA', en: 'She', role: 'who' as const, ghost: true }, { es: 'tiene', en: 'has', role: 'verb' as const }, { es: 'ojos', en: 'eyes', role: 'word' as const }, { es: 'marrones', en: 'brown', role: 'word' as const }], order: [0, 1, 3, 2] };
  it('«She has eyes brown»: has seguido el orden del español, y la regla de lo que describe', () => {
    const m = buildMistake(['She', 'has', 'eyes', 'brown'], ['She', 'has', 'brown', 'eyes'], mirror, 'She has brown eyes.');
    expect(m.wrong).toEqual([2, 3]);
    expect(m.reason).toBe('Has seguido el orden del español («ojos marrones»). En inglés va así: «brown eyes».');
    expect(m.rule).toMatch(/DELANTE/);
  });
  it('sin espejo, qué pieza va antes', () => {
    expect(buildMistake(['are', 'We', 'here'], ['We', 'are', 'here']).reason).toBe('Tienes las palabras bien, pero no el orden: «We» va antes que «are».');
  });
});

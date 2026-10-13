import { describe, expect, it } from 'vitest';
import { checkOwnSentence, containsPhrase, firstLetterHint, normalizeAnswer, orderTiles, sameAnswer } from '../src';

describe('corrección de respuestas', () => {
  it('normaliza mayúsculas, puntuación, comillas tipográficas y puntos suspensivos', () => {
    expect(normalizeAnswer('  I can’t   find…  ')).toBe("i can't find");
    expect(sameAnswer('Borrow!', 'borrow')).toBe(true);
    expect(sameAnswer('', 'borrow')).toBe(false);
    expect(sameAnswer('borow', 'borrow')).toBe(false);
  });

  it('busca piezas como palabras completas', () => {
    expect(containsPhrase('Can I borrow your pen?', 'can i')).toBe(true);
    expect(containsPhrase('Canis is a dog', 'can')).toBe(false);
  });

  it('la frase propia exige longitud, piezas obligatorias y no copiar el ejemplo', () => {
    const examples = ['Can I borrow your charger?'];
    expect(checkOwnSentence('Can I borrow your bike tomorrow?', ['borrow'], examples)).toEqual([]);
    expect(checkOwnSentence('borrow', ['borrow'], examples)).toEqual(['too_short']);
    expect(checkOwnSentence('Can I use your bike?', ['borrow'], examples)).toEqual(['missing_piece']);
    expect(checkOwnSentence('can i borrow your charger', ['borrow'], examples)).toEqual(['copied_example']);
  });

  it('prepara fichas y pistas', () => {
    expect(orderTiles('Can I borrow your pen?', ['dog', 'pen'])).toEqual({ answer: ['Can', 'I', 'borrow', 'your', 'pen'], tiles: ['Can', 'I', 'borrow', 'your', 'pen', 'dog'] });
    expect(firstLetterHint('run out of')).toBe('r _ _   o _ _   o _');
  });
});

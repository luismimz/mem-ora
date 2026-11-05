import { describe, expect, it } from 'vitest';
import { checkOwnSentence, containsPhrase, firstLetterHint, nearMiss, normalizeAnswer, orderTiles, sameAnswer } from '../src';

describe('corrección de respuestas', () => {
  it('normaliza mayúsculas, puntuación, comillas tipográficas y puntos suspensivos', () => {
    expect(normalizeAnswer('  I can’t   find…  ')).toBe('i can not find');
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

describe('respuestas que son solo símbolos (usuario, 2-nov-2026)', () => {
  it('«;» acierta y no se confunde con otros símbolos', () => {
    expect(sameAnswer(';', ';')).toBe(true);
    expect(sameAnswer(' ; ', ';')).toBe(true);
    expect(sameAnswer(')', ';')).toBe(false);
    expect(sameAnswer('==', '!=')).toBe(false);
    expect(sameAnswer('{ }', '{}')).toBe(true);
    expect(sameAnswer('', ';')).toBe(false);
  });
  it('lo normal sigue igual: sin mayúsculas ni puntuación de más', () => {
    expect(sameAnswer('Hola.', 'hola')).toBe(true);
    expect(sameAnswer(';', 'hola')).toBe(false);
  });
});

describe('nearMiss: «casi» (usuario, 5-nov-2026)', () => {
  it('detecta la -s, la palabra que falta y la letra cambiada', () => {
    expect(nearMiss('it depend', 'It depends')).toContain('-s');
    expect(nearMiss('I not sure', "I'm not sure")).toContain('Te faltó «am»');
    expect(nearMiss('course', 'of course')).toContain('Te faltó «of»');
    expect(nearMiss('of cuorse', 'of course')).toContain('course');
    expect(nearMiss('I see you later', 'See you later')).toBe('Sobra «i».');
  });
  it('no da «casi» a lo bueno ni a lo muy distinto', () => {
    expect(nearMiss('of course', 'Of course!')).toBeNull();
    expect(nearMiss('dog', 'house')).toBeNull();
    expect(nearMiss('I like it', 'she went home')).toBeNull();
  });
});

describe('contracciones (usuario, 5-nov-2026)', () => {
  it('«I am sorry» = «I\'m sorry» y el resto', () => {
    expect(sameAnswer('I am sorry', "I'm sorry")).toBe(true);
    expect(sameAnswer('I do not know', "I don't know")).toBe(true);
    expect(sameAnswer('it is late', "It's late")).toBe(true);
    expect(sameAnswer('we are here', "we're here")).toBe(true);
    expect(sameAnswer('I cannot', "I can't")).toBe(true);
    expect(sameAnswer('I will not go', "I won't go")).toBe(true);
    expect(sameAnswer('I have got it', "I've got it")).toBe(true);
    expect(sameAnswer("Tom's car", 'Tom is car')).toBe(false);
  });
});

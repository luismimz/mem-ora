import { describe, expect, it } from 'vitest';
import { orderRule, orderSwap, spanishOrderCalque, type OrderMirror } from '../src';

const m = (pieces: Array<[string, string, string]>, order: number[]): OrderMirror => ({ pieces: pieces.map(([es, en, role]) => ({ es, en, role })), order });

describe('por qué cambia el orden (D-088)', () => {
  const brown = m([['ELLA', 'She', 'who'], ['tiene', 'has', 'verb'], ['ojos', 'eyes', 'word'], ['marrones', 'brown', 'word']], [0, 1, 3, 2]);
  it('ojos marrones → brown eyes: lo que describe va delante; y el calco del español es «She has eyes brown»', () => {
    expect(orderRule(brown, 'She has brown eyes.')?.rule).toBe('describe');
    expect(orderSwap(brown)).toEqual({ es: 'ojos marrones', en: 'brown eyes' });
    expect(spanishOrderCalque(brown)).toBe('She has eyes brown');
  });
  it('preguntas, me/te, frecuencia, ago, cuándo y dónde, enough', () => {
    expect(orderRule(m([['TÚ', 'you', 'who'], ['estás', 'are', 'helper'], ['cansado', 'tired', 'word']], [1, 0, 2]), 'Are you tired?')?.rule).toBe('question');
    expect(orderRule(m([['ELLA', 'She', 'who'], ['me', 'me', 'word'], ['ayuda', 'helps', 'verb']], [0, 2, 1]), 'She helps me.')?.rule).toBe('object');
    expect(orderRule(m([['Siempre', 'always', 'word'], ['YO', 'I', 'who'], ['bebo café', 'drink coffee', 'word']], [1, 0, 2]), 'I always drink coffee.')?.rule).toBe('frequency');
    expect(orderRule(m([['Hace', 'ago', 'word'], ['dos días', 'two days', 'word']], [1, 0]), 'Two days ago.')?.rule).toBe('ago');
    expect(orderRule(m([['Hoy', 'today', 'word'], ['YO', 'I', 'who'], ['estoy ocupado', 'am busy', 'word']], [1, 2, 0]), 'I am busy today.')?.rule).toBe('time');
    expect(orderRule(m([['lo bastante', 'enough', 'word'], ['mayor', 'old', 'word']], [1, 0]), "You're old enough.")?.rule).toBe('enough');
  });
  it('si la pieza trae su porqué, manda el porqué; si no se reconoce, nada (mejor nada que algo falso)', () => {
    const own = m([['café', 'coffee', 'word'], ['negro', 'Black', 'word']], [1, 0]);
    own.pieces[1]!.why = 'El color va delante.';
    expect(orderRule(own, 'Black coffee.')).toEqual({ rule: 'piece', text: 'El color va delante.' });
    expect(orderRule(m([['vinieron', 'came', 'verb'], ['cien personas', 'A hundred people', 'who']], [1, 0]), 'A hundred people came.')).toBeNull();
  });
});

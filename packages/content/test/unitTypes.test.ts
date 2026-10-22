import { describe, expect, it } from 'vitest';
import { DEFAULT_SKILLS, describeContentIssue, emptyPayload, fieldLabel, mirrorIssues, validateUnitPayload } from '../src';
import { borrow, canI } from './fixtures';

const codes = (type: string, payload: unknown) => validateUnitPayload(type, payload).map((i) => `${i.code}@${i.path}`);

describe('payload por tipo', () => {
  it('acepta un término y un patrón correctos', () => {
    expect(validateUnitPayload('term', borrow)).toEqual([]);
    expect(validateUnitPayload('pattern', canI)).toEqual([]);
  });

  it('señala campos obligatorios, erratas y formatos incorrectos', () => {
    expect(codes('term', { ...borrow, meaning: '' })).toContain('required@meaning');
    expect(codes('term', { ...borrow, meening: 'x' })).toContain('unknown_field@meening');
    expect(codes('term', { ...borrow, form: 'palabra' })).toContain('invalid_choice@form');
    expect(codes('term', { ...borrow, examples: [] })).toContain('min_items@examples');
    expect(codes('term', { ...borrow, examples: [{ text: 'Hi', translation: '' }] })).toContain('required@examples.0.translation');
    expect(codes('term', { ...borrow, text: ' borrow' })).toContain('surrounding_spaces@text');
    expect(codes('term', 'borrow')).toEqual(['not_object@payload']);
    expect(codes('formula', borrow)).toEqual(['unknown_unit_type@type']);
  });

  it('un patrón exige tres ejemplos, una regla de una línea y al menos un hueco', () => {
    expect(codes('pattern', { ...canI, examples: canI.examples.slice(0, 2) })).toContain('min_items@examples');
    expect(codes('pattern', { ...canI, rule: 'línea uno\nlínea dos' })).toContain('rule_multiline@rule');
    expect(codes('pattern', { ...canI, pieces: [{ text: 'Can I', role: 'fixed' }, { text: 'go', role: 'fixed' }] })).toContain('pattern_without_slot@pieces');
    expect(codes('pattern', { ...canI, examples: [canI.examples[0], canI.examples[0], canI.examples[1]] })).toContain('duplicate_example@examples.1.text');
  });

  it('las plantillas vacías indican qué falta, y cada tipo tiene habilidades por defecto que pueden consolidar', () => {
    expect(codes('term', emptyPayload('term'))).toEqual(expect.arrayContaining(['required@text', 'required@meaning']));
    expect(DEFAULT_SKILLS.term.map((s) => s.kind)).toEqual(['listen', 'recall', 'produce']);
    expect(DEFAULT_SKILLS.pattern.some((s) => s.kind === 'recognize')).toBe(false);
  });
});

describe('mensajes de contenido', () => {
  it('nombra el campo en lenguaje del autor', () => {
    expect(fieldLabel('examples.2.translation')).toBe('Ejemplo 3 › traducción');
    expect(fieldLabel('pronunciation.ipa')).toBe('Pronunciación › AFI');
  });

  it('todos los problemas que generan los validadores tienen mensaje', () => {
    const broken = [
      ...validateUnitPayload('term', { form: 'x', text: ' ', meaning: 5, extra: 1, pronunciation: 'x', examples: [{ text: 'a'.repeat(200), translation: '' }, 'x'] }),
      ...validateUnitPayload('pattern', { goal: '', rule: 'a\nb', pieces: [{ text: 'x', role: 'fixed' }], examples: 'x', pitfalls: 'x' }),
      ...validateUnitPayload('nada', {}),
    ];
    for (const issue of broken) expect(describeContentIssue(issue), issue.code).not.toMatch(/: [a-z_]+$/);
  });

  it('explica un campo obligatorio vacío', () => {
    const [first] = validateUnitPayload('term', { ...borrow, meaning: '' });
    expect(describeContentIssue(first!)).toBe('Significado: es obligatorio.');
  });
});

describe('tren de la frase (D-082)', () => {
  const pieces = [
    { es: 'TÚ', en: 'you', role: 'who', ghost: true },
    { es: 'estás', en: 'are', role: 'helper', from: 'tienes', why: 'El hambre no se toca: se siente.' },
    { es: 'hambriento', en: 'hungry', role: 'word' },
  ];
  it('una pregunta bien formada: el ayudante salta delante y las piezas dicen la frase', () => {
    expect(mirrorIssues({ say: '¿Tienes hambre?', pieces, order: [1, 0, 2] }, 'Are you hungry?', 'm')).toEqual([]);
  });
  it('si las piezas en inglés no dicen la frase, se avisa', () => {
    expect(mirrorIssues({ say: '¿Tienes hambre?', pieces }, 'Are you hungry?', 'm').map((i) => i.code)).toEqual(['mirror_mismatch']);
  });
  it('un orden que repite o salta piezas no vale', () => {
    expect(mirrorIssues({ say: 'x', pieces, order: [0, 0, 2] }, 'you you hungry', 'm').map((i) => i.code)).toEqual(['mirror_bad_order']);
  });
  it('el semáforo (DO) no tiene pieza en español', () => {
    const m = { say: '¿Dónde vives?', pieces: [{ es: 'Dónde', en: 'Where', role: 'word' }, { es: '', en: 'do', role: 'signal' }, { es: 'TÚ', en: 'you', role: 'who', ghost: true }, { es: 'vives', en: 'live', role: 'verb' }] };
    expect(mirrorIssues(m, 'Where do you live?', 'm')).toEqual([]);
  });
});

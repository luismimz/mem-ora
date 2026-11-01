import { describe, expect, it } from 'vitest';
import { askPartner, cleanHistory, parseTalk, SCENARIOS, talkMessages, vocabLines } from '../src/speak/talk';

const keys = new Set(['age', 'dog']);

describe('conversación: la respuesta de la IA se valida (D-107)', () => {
  it('autocorrección: cuenta como logro y la versión final no es error', () => {
    const v = parseTalk(JSON.stringify({ heard: 'The boy is ten years old', reply: 'Oh, he is ten? Nice! What is his name?', recast: null,
      selfCorrections: [{ from: 'has a 10 years old', to: 'is ten years old' }], mistakes: [], goalDone: false }), keys)!;
    expect(v.selfCorrections).toEqual([{ from: 'has a 10 years old', to: 'is ten years old' }]);
    expect(v.mistakes).toEqual([]);
  });
  it('errores: como mucho 2, sin «errores» que no cambian nada y con unidad solo si existe', () => {
    const v = parseTalk({ heard: 'x', reply: 'y', recast: 'I have a dog.', selfCorrections: [], goalDone: true, mistakes: [
      { said: 'I has', correct: 'I have', why: 'Con I, have.', unitKey: 'dog' },
      { said: 'same', correct: 'Same', why: '', unitKey: null },
      { said: 'a', correct: 'b', why: 'c', unitKey: 'inventada' },
      { said: 'd', correct: 'e', why: 'f', unitKey: null },
    ] }, keys)!;
    expect(v.mistakes).toEqual([{ said: 'I has', correct: 'I have', why: 'Con I, have.', unitKey: 'dog' }, { said: 'a', correct: 'b', why: 'c', unitKey: null }]);
    expect(v.goalDone).toBe(true);
    expect(v.recast).toBe('I have a dog.');
  });
  it('sin respuesta no sirve', () => expect(parseTalk({ heard: 'x', reply: '' }, keys)).toBeNull());
});

describe('conversación: lo que se manda a la IA (D-107)', () => {
  it('el historial del cliente se limpia y se recorta', () => {
    const h = cleanHistory([{ who: 'ai', text: 'Hi' }, { who: 'hacker', text: 'x' }, { who: 'me', text: 'a'.repeat(900) }, ...Array.from({ length: 20 }, (_, i) => ({ who: 'me', text: `t${i}` }))]);
    expect(h.length).toBe(12);
    expect(h.every((t) => t.text.length <= 400 && (t.who === 'ai' || t.who === 'me'))).toBe(true);
  });
  it('lleva la situación, lo aprendido, el historial y el audio; avisa de las autocorrecciones', () => {
    const sc = SCENARIOS.find((s) => s.key === 'restaurante')!;
    const vocab = vocabLines({ dog: { key: 'dog', type: 'term', payload: { text: 'dog', meaning: 'perro' } }, g: { key: 'g', type: 'pattern', payload: { goal: 'El YO fantasma' } } }, ['dog', 'g', 'nada']);
    expect(vocab).toEqual(['dog: dog = perro', 'g: El YO fantasma']);
    const m = talkMessages(sc, [{ who: 'ai', text: sc.opening }], vocab, 'AAAA', 'en', 'es');
    expect(String(m[0]!.content)).toContain('waiter');
    expect(String(m[0]!.content)).toContain('dog: dog = perro');
    expect(String(m[0]!.content)).toContain('SELF-CORRECTION');
    expect(m[1]).toEqual({ role: 'assistant', content: sc.opening });
    expect(JSON.stringify(m[2])).toContain('"format":"wav"');
  });
  it('pide a OpenRouter sin guardar datos', async () => {
    let sent: any = null;
    const fake = (async (_u: string, init: any) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: '{"heard":"hi","reply":"Hello! How are you?","recast":null,"selfCorrections":[],"mistakes":[],"goalDone":false}' } }], usage: { cost: 0.003 } }), { status: 200 }); }) as typeof fetch;
    const r = await askPartner({ key: 'k', model: 'm', capEur: 5, eurPerUsd: 1 }, [], keys, fake);
    expect(r.costUsd).toBe(0.003);
    expect(r.verdict.reply).toBe('Hello! How are you?');
    expect(sent.provider).toEqual({ data_collection: 'deny' });
  });
});

import { describe, expect, it } from 'vitest';
import { askCoach, monthSpendEur, parseVerdict, pickSpeakItems, speakConfig, speakMessages, unitPhrases } from '../src/speak/lib';

const unit = (key: string, ex: Array<[string, string?]>) => ({ key, payload: { examples: ex.map(([text, translation]) => ({ text, ...(translation ? { translation } : {}) })) } });
const units = {
  dog: unit('dog', [['I have a dog.', 'Tengo un perro.']]),
  word: unit('word', [['dog', 'perro']]),
  notr: unit('notr', [['We want water.']]),
  go: unit('go', [['We go to the beach on Sunday.', 'Vamos a la playa el domingo.']]),
  never: unit('never', [['She lives in Lleida.', 'Ella vive en Lleida.']]),
};
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]!; };

describe('ronda de hablar: configuración (D-106)', () => {
  it('sin clave de OpenRouter no hay ronda', () => expect(speakConfig({})).toBeNull());
  it('con clave: modelo y tope por defecto, o los del entorno', () => {
    expect(speakConfig({ OPENROUTER_API_KEY: 'k' })).toMatchObject({ capEur: 5, model: 'google/gemini-2.5-flash' });
    expect(speakConfig({ OPENROUTER_API_KEY: 'k', SPEAK_MONTHLY_CAP_EUR: '8', OPENROUTER_SPEAK_MODEL: 'google/x' })).toMatchObject({ capEur: 8, model: 'google/x' });
  });
});

describe('ronda de hablar: frases solo de lo ya trabajado (D-106)', () => {
  it('una frase vale si tiene traducción y de 2 a 12 palabras', () => {
    expect(unitPhrases(units.dog)).toEqual([{ unitKey: 'dog', prompt: 'Tengo un perro.', reference: 'I have a dog.' }]);
    expect(unitPhrases(units.word)).toEqual([]);
    expect(unitPhrases(units.notr)).toEqual([]);
  });
  it('nunca pide nada no trabajado y empieza por lo prioritario', () => {
    const items = pickSpeakItems(units, ['dog', 'go', 'word'], ['go'], 5, seq(0));
    expect(items.map((i) => i.unitKey)).toEqual(['go', 'dog']);
    expect(items.some((i) => i.unitKey === 'never')).toBe(false);
  });
  it('como mucho n frases', () => expect(pickSpeakItems(units, ['dog', 'go', 'never'], [], 2, seq(0.1)).length).toBe(2));
});

describe('ronda de hablar: la respuesta de la IA se valida (D-078)', () => {
  it('acepta el JSON esperado, aunque venga con texto alrededor', () => {
    expect(parseVerdict('Sure! {"heard":"I has a dog","ok":false,"corrected":"I have a dog.","tip":"Con I se dice have, no has."}')).toEqual({ heard: 'I has a dog', ok: false, corrected: 'I have a dog.', tip: 'Con I se dice have, no has.' });
  });
  it('rechaza lo que no tiene la forma', () => {
    expect(parseVerdict('no json')).toBeNull();
    expect(parseVerdict({ heard: 'x', ok: 'yes', corrected: 'x', tip: 'y' })).toBeNull();
    expect(parseVerdict({ heard: 'x', ok: true, corrected: '', tip: 'y' })).toBeNull();
  });
  it('el mensaje lleva la frase pedida, la referencia y el audio en WAV', () => {
    const m = speakMessages({ unitKey: 'dog', prompt: 'Tengo un perro.', reference: 'I have a dog.' }, 'AAAA', 'en', 'es');
    expect(m[0]!.content).toContain('"Tengo un perro."');
    expect(m[0]!.content).toContain('"I have a dog."');
    expect(JSON.stringify(m[1])).toContain('"input_audio":{"data":"AAAA","format":"wav"}');
  });
});

describe('ronda de hablar: gasto y tope (D-106)', () => {
  it('suma solo lo del mes en curso', () => {
    const now = Date.UTC(2026, 10, 15);
    expect(monthSpendEur([{ costEur: 0.01, at: Date.UTC(2026, 10, 2) }, { costEur: 0.02, at: Date.UTC(2026, 10, 14) }, { costEur: 5, at: Date.UTC(2026, 9, 30) }], now)).toBe(0.03);
  });
  it('pide a OpenRouter sin guardar datos y devuelve veredicto y coste', async () => {
    let sent: any = null;
    const fake = (async (_u: string, init: any) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: '{"heard":"I have a dog","ok":true,"corrected":"I have a dog.","tip":"¡Perfecto!"}' } }], usage: { cost: 0.0012 } }), { status: 200 }); }) as typeof fetch;
    const r = await askCoach({ key: 'k', model: 'm', capEur: 5, eurPerUsd: 0.92 }, { unitKey: 'dog', prompt: 'Tengo un perro.', reference: 'I have a dog.' }, 'AAAA', 'en', 'es', fake);
    expect(r).toEqual({ verdict: { heard: 'I have a dog', ok: true, corrected: 'I have a dog.', tip: '¡Perfecto!' }, costUsd: 0.0012 });
    expect(sent.provider).toEqual({ data_collection: 'deny' });
    expect(sent.usage).toEqual({ include: true });
  });
  it('si la IA responde algo inválido, falla con BAD_REPLY', async () => {
    const fake = (async () => new Response(JSON.stringify({ choices: [{ message: { content: 'hola' } }], usage: { cost: 0.001 } }), { status: 200 })) as typeof fetch;
    await expect(askCoach({ key: 'k', model: 'm', capEur: 5, eurPerUsd: 1 }, { unitKey: 'd', prompt: 'p', reference: 'r' }, 'A', 'en', 'es', fake)).rejects.toMatchObject({ code: 'BAD_REPLY' });
  });
});

import { describe, expect, it } from 'vitest';
import { analyzeTrick } from './trickParse';

const k = (en: string, es = '') => analyzeTrick(en, es)?.key ?? null;

describe('el truco de la frase (5-nov-2026)', () => {
  it('parte la palabra española y dice si salta delante', () => {
    const a = analyzeTrick('We would like a coffee.', 'Nos gustaría un café.')!;
    expect(a.key).toBe('would');
    expect(a.split).toMatchObject({ root: 'gust', ending: 'aría' });
    expect(a.jump).toBe(true);
    expect(a.en.find((t) => t.form)?.text).toBe('like');
    expect(a.en.find((t) => t.form)?.form).toBe('base');
    expect(analyzeTrick("I'll call you tomorrow.", 'Te llamaré mañana.')!.split).toMatchObject({ root: 'llam', ending: 'aré' });
    const p = analyzeTrick('I worked yesterday.', 'Trabajé ayer.')!;
    expect(p.key).toBe('past'); expect(p.jump).toBe(false); expect(p.en[1]).toMatchObject({ text: 'work', tail: 'ed' });
  });
  it('etiqueta la forma del verbo', () => {
    expect(analyzeTrick('I have already eaten.', 'Ya he comido.')!.en.find((t) => t.form)?.form).toBe('3ª · participio');
    expect(analyzeTrick('She lives here.', 'Vive aquí.')!.en[1]).toMatchObject({ text: 'live', tail: 's', form: '-s' });
    expect(analyzeTrick('I am walking.', 'Estoy caminando.')!.split).toMatchObject({ root: 'camin', ending: 'ando' });
  });
  it('no inventa trucos', () => {
    expect(k('We travel in May.', 'Viajamos en mayo.')).toBeNull();
    expect(k('There is nothing here.')).toBeNull();
    expect(k('Turn left.')).toBeNull();
    expect(k('I need red bread.')).toBeNull();
    expect(k('I am tired.')).toBeNull();
  });
});

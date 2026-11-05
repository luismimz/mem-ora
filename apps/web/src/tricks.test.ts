import { describe, expect, it } from 'vitest';
import { tricksIn } from './tricks';

describe('trucos de gramática en la frase (5-nov-2026)', () => {
  const keys = (t: string) => tricksIn(t).map((x) => x.key);
  it('marca would, will, going to, have, if, did y el pasado', () => {
    expect(keys('I would like a coffee.')).toEqual(['would']);
    expect(keys("I'll call you if it rains.")).toEqual(['will', 'if']);
    expect(keys('I am going to travel.')).toEqual(['going']);
    expect(keys('I have finished.')).toEqual(['have', 'part']);
    expect(keys('She has been here.')).toEqual(['have', 'part']);
    expect(keys('Did you go yesterday?')).toEqual(['did']);
    expect(keys('We went home and watched a film.')).toEqual(['past']);
  });
  it('no confunde palabras que acaban en -ed ni adjetivos', () => {
    expect(keys('I need red bread.')).toEqual([]);
    expect(keys('I am tired.')).toEqual([]);
  });
});

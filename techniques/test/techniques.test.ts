import { describe, expect, it } from 'vitest';
import { describeContentIssue } from '@memora/content';
import { TECHNIQUES, validateAssociation } from '../src';

const bridge = {
  technique: 'phonetic_bridge',
  cue: 'burro',
  text: 'Un BURRO te PIDE PRESTADO el móvil.',
  evidence: { familiarMeaning: 'animal de carga', soundRelation: 'BÁ-rou suena como BU-rro', differences: 'la vocal inicial es distinta' },
};
const codes = (input: Parameters<typeof validateAssociation>[0], type = 'term') => validateAssociation(input, type).map((i) => `${i.code}@${i.path}`);

describe('técnicas', () => {
  it('acepta un puente fonético con escena breve, resaltada y con su evidencia', () => {
    expect(validateAssociation(bridge, 'term')).toEqual([]);
  });

  it('la escena tiene como máximo 14 palabras, resalta la pieza clave e incluye el puente', () => {
    expect(codes({ ...bridge, text: 'Un BURRO ' + 'muy '.repeat(14) + 'grande' })).toContain('scene_too_long@text');
    expect(codes({ ...bridge, text: 'Un burro te pide prestado el móvil.' })).toContain('scene_without_highlight@text');
    expect(codes({ ...bridge, text: 'Un ASNO te PIDE PRESTADO el móvil.' })).toContain('scene_without_cue@text');
  });

  it('el puente exige evidencia del parecido y de las diferencias', () => {
    expect(codes({ ...bridge, evidence: undefined })).toEqual(['required@evidence']);
    expect(codes({ ...bridge, evidence: { familiarMeaning: 'animal', soundRelation: 'parecido' } })).toContain('required@evidence.differences');
  });

  it('cada técnica declara para qué tipos sirve', () => {
    expect(codes({ ...bridge }, 'pattern')).toEqual(['technique_not_for_unit_type@technique']);
    expect(codes({ technique: 'absurd_scene', text: 'El portero GRITA DID en la puerta.' }, 'pattern')).toEqual([]);
    expect(codes({ technique: 'palacio', text: 'x' })).toEqual(['unknown_technique@technique']);
    for (const t of Object.values(TECHNIQUES)) expect(t.reviewChecklist.length).toBeGreaterThan(0);
  });

  it('los problemas se explican al autor', () => {
    const [problem] = validateAssociation({ ...bridge, text: 'Un burro te pide prestado el móvil.' }, 'term');
    expect(describeContentIssue(problem!)).toMatch(/^Texto: resalta la pieza clave en MAYÚSCULAS/);
  });
});

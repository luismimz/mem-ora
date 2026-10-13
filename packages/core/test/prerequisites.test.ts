import { describe, expect, it } from 'vitest';
import { canPractice, newSkillState, validateCatalog, type Catalog, type SkillState } from '../src';
import { config } from './helpers';

const catalog: Catalog = {
  units: [
    { id: 'a', courseId: 'c', type: 'concept' },
    { id: 'b', courseId: 'c', type: 'command' },
  ],
  skills: [
    { id: 'a.recall', unitId: 'a', kind: 'recall' },
    { id: 'a.apply', unitId: 'a', kind: 'apply' },
    { id: 'b.produce', unitId: 'b', kind: 'produce' },
  ],
  prerequisites: [
    { subject: { skill: 'a.apply' }, requires: { skill: 'a.recall' } },
    { subject: { unit: 'b' }, requires: { unit: 'a' } },
  ],
};

const withStatus = (statuses: Record<string, SkillState['status']>): Record<string, SkillState> =>
  Object.fromEntries(Object.entries(statuses).map(([id, status]) => [id, { ...newSkillState(id, id.split('.')[0]!, config), status }]));

describe('canPractice', () => {
  it('bloquea mientras lo requerido no esté en consolidación', () => {
    const check = canPractice({ skill: 'a.apply' }, withStatus({ 'a.recall': 'learning' }), catalog, config);
    expect(check.allowed).toBe(false);
    expect(check.blockedBy).toEqual([{ skill: 'a.recall' }]);
  });

  it('desbloquea cuando lo requerido está en consolidación, aprendido, estable, dominado o debilitado', () => {
    for (const status of ['consolidating', 'learned', 'stable', 'mastered', 'weakened'] as const) {
      expect(canPractice({ skill: 'a.apply' }, withStatus({ 'a.recall': status }), catalog, config).allowed).toBe(true);
    }
  });

  it('un requisito de unidad exige todas sus habilidades', () => {
    expect(canPractice({ unit: 'b' }, withStatus({ 'a.recall': 'learned', 'a.apply': 'learning' }), catalog, config).allowed).toBe(false);
    expect(canPractice({ unit: 'b' }, withStatus({ 'a.recall': 'learned', 'a.apply': 'consolidating' }), catalog, config).allowed).toBe(true);
  });

  it('lo que no tiene prerrequisitos siempre se puede practicar', () => {
    expect(canPractice({ skill: 'a.recall' }, {}, catalog, config).allowed).toBe(true);
  });
});

describe('validateCatalog', () => {
  it('acepta un catálogo correcto', () => {
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it('detecta referencias desconocidas y ciclos', () => {
    expect(validateCatalog({ ...catalog, prerequisites: [{ subject: { skill: 'x' }, requires: { unit: 'a' } }] })[0]).toMatch(/desconocido/);
    const cyclic: Catalog = { ...catalog, prerequisites: [...catalog.prerequisites, { subject: { skill: 'a.recall' }, requires: { unit: 'b' } }] };
    expect(validateCatalog(cyclic).some((p) => p.startsWith('ciclo'))).toBe(true);
  });
});

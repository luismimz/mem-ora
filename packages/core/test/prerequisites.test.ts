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
  const codes = (c: Catalog) => validateCatalog(c, config).map((i) => i.code);

  it('un catálogo correcto no tiene errores (puede tener avisos)', () => {
    const issues = validateCatalog(catalog, config);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(issues).toEqual([{ code: 'unit_limited_formats', severity: 'info', params: { count: 2, units: 'a, b', more: 0, expected: 3 } }]);
  });

  it('detecta referencias desconocidas, duplicados, autorreferencias y ciclos', () => {
    expect(codes({ ...catalog, prerequisites: [{ subject: { skill: 'x' }, requires: { unit: 'a' } }] })).toContain('prerequisite_unknown_subject');
    expect(codes({ ...catalog, prerequisites: [{ subject: { unit: 'a' }, requires: { skill: 'zz' } }] })).toContain('prerequisite_unknown_requirement');
    expect(codes({ ...catalog, skills: [...catalog.skills, { id: 'a.recall', unitId: 'a', kind: 'recall' }] })).toContain('duplicate_skill');
    expect(codes({ ...catalog, skills: [...catalog.skills, { id: 'q', unitId: 'nope', kind: 'recall' }] })).toContain('skill_unknown_unit');
    expect(codes({ ...catalog, prerequisites: [{ subject: { unit: 'a' }, requires: { skill: 'a.recall' } }] })).toContain('prerequisite_self');
    const cyclic: Catalog = { ...catalog, prerequisites: [...catalog.prerequisites, { subject: { skill: 'a.recall' }, requires: { unit: 'b' } }] };
    expect(codes(cyclic)).toContain('prerequisite_cycle');
  });

  it('rechaza un prerrequisito sobre una habilidad de reconocimiento puro', () => {
    const c: Catalog = {
      ...catalog,
      skills: [...catalog.skills, { id: 'a.see', unitId: 'a', kind: 'recognize' }],
      prerequisites: [{ subject: { unit: 'b' }, requires: { skill: 'a.see' } }],
    };
    const found = validateCatalog(c, config).find((i) => i.code === 'prerequisite_unreachable');
    expect(found).toMatchObject({ severity: 'error', params: { skill: 'a.see', reason: 'recognition_only' } });
  });

  it('un requisito de unidad ignora el reconocimiento puro, salvo que no haya otra cosa', () => {
    const mixed: Catalog = { ...catalog, skills: [...catalog.skills, { id: 'a.see', unitId: 'a', kind: 'recognize' }] };
    expect(codes(mixed)).not.toContain('prerequisite_unreachable');
    expect(canPractice({ unit: 'b' }, withStatus({ 'a.recall': 'learned', 'a.apply': 'learned', 'a.see': 'learning' }), mixed, config).allowed).toBe(true);
    const onlySeen: Catalog = {
      units: [...catalog.units, { id: 'v', courseId: 'c', type: 'image_label' }],
      skills: [...catalog.skills, { id: 'v.see', unitId: 'v', kind: 'recognize' }],
      prerequisites: [{ subject: { unit: 'b' }, requires: { unit: 'v' } }],
    };
    expect(validateCatalog(onlySeen, config).find((i) => i.code === 'prerequisite_unreachable')?.params.reason).toBe('unit_has_no_consolidable_skill');
  });

  it('avisa de unidades que no podrán aprenderse o dominarse con variedad, y de asociaciones que no se recuperan', () => {
    const c: Catalog = {
      units: [...catalog.units, { id: 'v', courseId: 'c', type: 'image_label' }, { id: 'e', courseId: 'c', type: 'fact' }],
      skills: [...catalog.skills, { id: 'v.see', unitId: 'v', kind: 'recognize', associationId: 'v.trick' }],
      prerequisites: catalog.prerequisites,
    };
    const issues = validateCatalog(c, config);
    expect(issues.find((i) => i.code === 'unit_cannot_be_learned')).toMatchObject({ severity: 'warning', params: { unit: 'v' } });
    expect(issues.find((i) => i.code === 'unit_without_skills')).toMatchObject({ params: { unit: 'e' } });
    expect(issues.find((i) => i.code === 'association_never_retrieved')).toMatchObject({ params: { association: 'v.trick' } });
    expect(issues.filter((i) => i.code === 'unit_limited_formats')).toHaveLength(1);
  });

  it('los errores van antes que los avisos y estos antes de la información', () => {
    const c: Catalog = { ...catalog, units: [...catalog.units, { id: 'e', courseId: 'c', type: 'fact' }], prerequisites: [{ subject: { skill: 'x' }, requires: { unit: 'a' } }] };
    const severities = validateCatalog(c, config).map((i) => i.severity);
    expect(severities.indexOf('warning')).toBeGreaterThan(severities.lastIndexOf('error'));
    expect(severities.indexOf('info')).toBeGreaterThan(severities.lastIndexOf('warning'));
  });
});

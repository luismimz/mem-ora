import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/catalog';

describe('catálogo desde filas de Directus', () => {
  it('usa los identificadores del autor y traduce los prerrequisitos', () => {
    const catalog = buildCatalog({
      units: [{ id: 'u1', key: 'borrow', type: 'term', status: 'draft' }, { id: 'u2', key: 'can-i', type: 'pattern', status: 'draft' }],
      skills: [{ id: 's1', key: 'borrow.recall', kind: 'recall', unit: 'u1', association: 'a1' }, { id: 's2', key: 'can-i.produce', kind: 'produce', unit: 'u2', association: null }],
      prerequisites: [{ id: 'p1', subject_unit: 'u2', subject_skill: null, requires_unit: null, requires_skill: 's1' }],
    });
    expect(catalog.units.map((u) => u.id)).toEqual(['borrow', 'can-i']);
    expect(catalog.skills[0]).toEqual({ id: 'borrow.recall', unitId: 'borrow', kind: 'recall', associationId: 'a1' });
    expect(catalog.prerequisites).toEqual([{ subject: { unit: 'can-i' }, requires: { skill: 'borrow.recall' } }]);
  });
});

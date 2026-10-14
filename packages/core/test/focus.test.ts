import { describe, expect, it } from 'vitest';
import { focusCatalog, type Catalog } from '../src';

const catalog: Catalog = {
  units: ['a', 'b', 'c', 'd'].map((id) => ({ id, courseId: 'x', type: 'concept' })),
  skills: ['a', 'b', 'c', 'd'].map((u) => ({ id: `${u}.recall`, unitId: u, kind: 'recall' as const })),
  prerequisites: [{ subject: { unit: 'b' }, requires: { unit: 'a' } }, { subject: { unit: 'd' }, requires: { unit: 'c' } }],
};

describe('enfocar el catálogo en una misión', () => {
  it('entra la misión y lo ya trabajado; lo demás nuevo queda fuera', () => {
    const f = focusCatalog(catalog, new Set(['c', 'd']), new Set(['a']));
    expect(f.units.map((u) => u.id)).toEqual(['a', 'c', 'd']);
    expect(f.skills.map((s) => s.id)).toEqual(['a.recall', 'c.recall', 'd.recall']);
  });

  it('conserva los prerrequisitos internos y omite los que apuntan fuera', () => {
    const f = focusCatalog(catalog, new Set(['b', 'c', 'd']), new Set());
    expect(f.prerequisites).toEqual([{ subject: { unit: 'd' }, requires: { unit: 'c' } }]);
  });
});

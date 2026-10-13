// Convierte las filas de Directus de un curso en el catálogo del núcleo, usando los identificadores (`key`)
// que escribe el autor, para que los mensajes del validador sean legibles.
import type { Catalog, Prerequisite, Ref, SkillKind } from '@memora/core';

export interface CatalogRows {
  units: Array<{ id: string; key: string; type: string; status: string }>;
  skills: Array<{ id: string; key: string; kind: string; unit: string; association: string | null }>;
  prerequisites: Array<{ id: string; subject_unit: string | null; subject_skill: string | null; requires_unit: string | null; requires_skill: string | null }>;
}

export function buildCatalog(rows: CatalogRows): Catalog {
  const unitKey = new Map(rows.units.map((u) => [u.id, u.key]));
  const skillKey = new Map(rows.skills.map((s) => [s.id, s.key]));
  const ref = (unit: string | null, skill: string | null): Ref =>
    unit ? { unit: unitKey.get(unit) ?? `desconocida:${unit}` } : { skill: skillKey.get(skill ?? '') ?? `desconocida:${skill}` };
  return {
    units: rows.units.map((u) => ({ id: u.key, courseId: 'course', type: u.type })),
    skills: rows.skills
      .filter((s) => unitKey.has(s.unit))
      .map((s) => ({ id: s.key, unitId: unitKey.get(s.unit)!, kind: s.kind as SkillKind, ...(s.association ? { associationId: s.association } : {}) })),
    prerequisites: rows.prerequisites.map((p): Prerequisite => ({ subject: ref(p.subject_unit, p.subject_skill), requires: ref(p.requires_unit, p.requires_skill) })),
  };
}

// Enfocar el catálogo en una parte (una misión, un tema): solo esas unidades entran como nuevas, pero todo lo que el
// alumno ya ha trabajado sigue en el catálogo, para que sus repasos vencidos lleguen igual. Agnóstico de la materia.
import type { Catalog, Id, Ref } from './types';

/**
 * Devuelve el catálogo con las unidades de `focus` más las que ya tienen alguna habilidad trabajada (`worked`).
 * Los prerrequisitos que apuntan a una unidad o habilidad que queda fuera se omiten: el alumno ha elegido esa parte.
 */
export function focusCatalog(catalog: Catalog, focus: ReadonlySet<Id>, worked: ReadonlySet<Id>): Catalog {
  const units = catalog.units.filter((u) => focus.has(u.id) || worked.has(u.id));
  const unitIds = new Set(units.map((u) => u.id));
  const skills = catalog.skills.filter((s) => unitIds.has(s.unitId));
  const skillIds = new Set(skills.map((s) => s.id));
  const present = (r: Ref) => ('unit' in r ? unitIds.has(r.unit) : skillIds.has(r.skill));
  return { units, skills, prerequisites: catalog.prerequisites.filter((p) => present(p.subject) && present(p.requires)) };
}

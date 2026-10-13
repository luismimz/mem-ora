// Nivel de una unidad (palabra, concepto, comando…) derivado del estado de sus habilidades.
//
// aprendida: todas sus habilidades que pueden consolidar están, al menos, «aprendidas».
// estable:   todas están, al menos, «estables».
// dominada:  todas están «dominadas» y, entre todas, suman éxitos diferidos en suficientes formatos distintos
//            y en suficientes contextos distintos (`unitLevels`).
// Las habilidades de reconocimiento puro no cuentan: nunca consolidan.
import type { CoreConfig } from './config';
import { canConsolidate, deferredFormatsOf, statusAtLeast } from './prerequisites';
import type { SkillState } from './skill';
import type { Catalog, ExerciseFormat, Id, SkillStatus } from './types';

export const UNIT_LEVELS = ['none', 'learned', 'stable', 'mastered'] as const;
export type UnitLevel = (typeof UNIT_LEVELS)[number];

export interface UnitLevelReport {
  unitId: Id;
  level: UnitLevel;
  /** Habilidades que cuentan para el nivel. */
  counted: Id[];
  /** Habilidades de reconocimiento puro, que no cuentan. */
  ignored: Id[];
  /** Formatos distintos con éxito diferido, y los que exige «dominada» para esta unidad. */
  formats: ExerciseFormat[];
  requiredFormats: number;
  /** Contextos distintos con éxito diferido, y los que exige «dominada». */
  contexts: number;
  requiredContexts: number;
  /** Qué falta para el siguiente nivel (códigos estables). */
  missing: string[];
}

const NEXT: Record<UnitLevel, SkillStatus | null> = { none: 'learned', learned: 'stable', stable: 'mastered', mastered: null };

export function unitLevel(unitId: Id, catalog: Catalog, skills: Record<Id, SkillState>, config: CoreConfig): UnitLevelReport {
  const defs = catalog.skills.filter((s) => s.unitId === unitId);
  const counted = defs.filter((s) => canConsolidate(s.kind, config));
  const ignored = defs.filter((s) => !canConsolidate(s.kind, config)).map((s) => s.id);
  const states = counted.map((d) => skills[d.id]);
  const all = (min: SkillStatus) => counted.length > 0 && states.every((s) => s !== undefined && statusAtLeast(s.status, min));

  const formats = [...new Set(states.flatMap((s) => s?.unaidedFormats ?? []))];
  const contexts = new Set(states.flatMap((s) => s?.contexts ?? [])).size;
  const available = new Set(counted.flatMap((d) => deferredFormatsOf(d.kind, config))).size;
  const requiredFormats = Math.min(config.unitLevels.masteredMinFormats, available);
  const requiredContexts = config.unitLevels.masteredMinContexts;
  const variety = formats.length >= requiredFormats && contexts >= requiredContexts;

  let level: UnitLevel = 'none';
  if (all('learned')) level = 'learned';
  if (all('stable')) level = 'stable';
  if (all('mastered') && variety) level = 'mastered';

  const missing: string[] = [];
  const next = NEXT[level];
  if (counted.length === 0) missing.push('no_consolidable_skills');
  else if (next) {
    const behind = counted.filter((d) => !skills[d.id] || !statusAtLeast(skills[d.id]!.status, next)).map((d) => d.id);
    if (behind.length) missing.push(`skills_below_${next}:${behind.join(',')}`);
    if (next === 'mastered' && formats.length < requiredFormats) missing.push(`formats:${formats.length}/${requiredFormats}`);
    if (next === 'mastered' && contexts < requiredContexts) missing.push(`contexts:${contexts}/${requiredContexts}`);
  }

  return { unitId, level, counted: counted.map((d) => d.id), ignored, formats, requiredFormats, contexts, requiredContexts, missing };
}

// Prerrequisitos: una unidad o habilidad no se puede practicar hasta que lo requerido esté preparado.
// También el validador del catálogo, que impide crear cursos que bloquearían al alumno para siempre.
import type { CoreConfig } from './config';
import type { SkillState } from './skill';
import type { Catalog, ExerciseFormat, Id, Ref, SkillDef, SkillKind, SkillStatus } from './types';

/** Orden de madurez. «Debilitada» cuenta como «en consolidación»: ya se aprendió y se está repasando. */
const STATUS_RANK: Record<SkillStatus, number> = {
  new: 0,
  presented: 1,
  learning: 2,
  consolidating: 3,
  weakened: 3,
  learned: 4,
  stable: 5,
  mastered: 6,
};

export function statusAtLeast(status: SkillStatus, min: SkillStatus): boolean {
  return STATUS_RANK[status] >= STATUS_RANK[min];
}

/** Formatos de éxito diferido que admite un tipo de habilidad. */
export function deferredFormatsOf(kind: SkillKind, config: CoreConfig): ExerciseFormat[] {
  return config.skillFormats[kind].filter((f) => config.deferred.formats.includes(f));
}

/** ¿Puede este tipo de habilidad pasar de «en aprendizaje»? Falso para el reconocimiento puro. */
export function canConsolidate(kind: SkillKind, config: CoreConfig): boolean {
  return deferredFormatsOf(kind, config).length > 0;
}

/** Estado más alto que puede alcanzar un tipo de habilidad. */
export function highestReachableStatus(kind: SkillKind, config: CoreConfig): SkillStatus {
  return canConsolidate(kind, config) ? 'mastered' : 'learning';
}

const refKey = (ref: Ref): string => ('unit' in ref ? `unit:${ref.unit}` : `skill:${ref.skill}`);

function skillsOf(ref: Ref, catalog: Catalog): SkillDef[] {
  if ('skill' in ref) return catalog.skills.filter((s) => s.id === ref.skill);
  return catalog.skills.filter((s) => s.unitId === ref.unit);
}

/**
 * Habilidades que deben estar preparadas para cumplir un requisito. Un requisito de unidad solo exige las
 * habilidades que pueden consolidar: el reconocimiento puro nunca llega a «en consolidación».
 */
function requiredSkills(ref: Ref, catalog: Catalog, config: CoreConfig): SkillDef[] {
  const skills = skillsOf(ref, catalog);
  return 'unit' in ref ? skills.filter((s) => canConsolidate(s.kind, config)) : skills;
}

function isSatisfied(ref: Ref, skills: Record<Id, SkillState>, catalog: Catalog, config: CoreConfig): boolean {
  return requiredSkills(ref, catalog, config).every((def) => {
    const state = skills[def.id];
    return state !== undefined && statusAtLeast(state.status, config.prerequisites.minStatus);
  });
}

export interface PracticeCheck {
  allowed: boolean;
  blockedBy: Ref[];
}

/** ¿Se puede practicar esta habilidad o unidad? Para una unidad, se comprueban todas sus habilidades. */
export function canPractice(target: Ref, skills: Record<Id, SkillState>, catalog: Catalog, config: CoreConfig): PracticeCheck {
  const blocked = new Map<string, Ref>();
  for (const def of skillsOf(target, catalog)) {
    for (const p of catalog.prerequisites) {
      const applies = ('skill' in p.subject && p.subject.skill === def.id) || ('unit' in p.subject && p.subject.unit === def.unitId);
      if (applies && !isSatisfied(p.requires, skills, catalog, config)) blocked.set(refKey(p.requires), p.requires);
    }
  }
  return { allowed: blocked.size === 0, blockedBy: [...blocked.values()] };
}

// ─── Validador del catálogo ──────────────────────────────────────────────────────────────────────────────

export const CATALOG_ISSUE_CODES = [
  'duplicate_unit',
  'duplicate_skill',
  'skill_unknown_unit',
  'prerequisite_unknown_subject',
  'prerequisite_unknown_requirement',
  'prerequisite_self',
  'prerequisite_cycle',
  'prerequisite_unreachable',
  'unit_without_skills',
  'unit_cannot_be_learned',
  'unit_limited_formats',
  'association_never_retrieved',
] as const;
export type CatalogIssueCode = (typeof CATALOG_ISSUE_CODES)[number];

/**
 * Problema del catálogo. El núcleo no redacta mensajes (regla 15): da un código estable y los datos para que
 * la interfaz lo explique en el idioma del autor (`packages/content`).
 */
export interface CatalogIssue {
  code: CatalogIssueCode;
  /** `error` impide publicar; `warning` se puede publicar, pero el autor debe saberlo; `info` solo informa. */
  severity: 'error' | 'warning' | 'info';
  params: Record<string, string | number>;
}

const issue = (code: CatalogIssueCode, severity: CatalogIssue['severity'], params: CatalogIssue['params']): CatalogIssue => ({ code, severity, params });

/** Problemas del catálogo, primero los errores. Vacío si el catálogo es correcto. */
export function validateCatalog(catalog: Catalog, config: CoreConfig): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const unitIds = new Set<string>();
  for (const u of catalog.units) {
    if (unitIds.has(u.id)) issues.push(issue('duplicate_unit', 'error', { unit: u.id }));
    unitIds.add(u.id);
  }
  const skillIds = new Set<string>();
  for (const s of catalog.skills) {
    if (skillIds.has(s.id)) issues.push(issue('duplicate_skill', 'error', { skill: s.id }));
    skillIds.add(s.id);
    if (!unitIds.has(s.unitId)) issues.push(issue('skill_unknown_unit', 'error', { skill: s.id, unit: s.unitId }));
  }

  const known = (ref: Ref) => ('unit' in ref ? unitIds.has(ref.unit) : skillIds.has(ref.skill));
  const unitOfRef = (ref: Ref) => ('unit' in ref ? ref.unit : catalog.skills.find((s) => s.id === ref.skill)?.unitId);
  catalog.prerequisites.forEach((p, index) => {
    const subject = refKey(p.subject);
    const requirement = refKey(p.requires);
    if (!known(p.subject)) issues.push(issue('prerequisite_unknown_subject', 'error', { index, subject }));
    if (!known(p.requires)) issues.push(issue('prerequisite_unknown_requirement', 'error', { index, subject, requirement }));
    if (!known(p.subject) || !known(p.requires)) return;
    if (subject === requirement || ('unit' in p.subject && unitOfRef(p.requires) === p.subject.unit)) {
      issues.push(issue('prerequisite_self', 'error', { index, subject, requirement }));
      return;
    }
    // Un requisito que nunca podrá cumplirse bloquearía para siempre lo que depende de él.
    const required = requiredSkills(p.requires, catalog, config);
    const minStatus = config.prerequisites.minStatus;
    const unreachable = 'skill' in p.requires
      ? required.filter((s) => !statusAtLeast(highestReachableStatus(s.kind, config), minStatus))
      : [];
    if ('unit' in p.requires && required.length === 0) {
      issues.push(issue('prerequisite_unreachable', 'error', { index, subject, requirement, reason: 'unit_has_no_consolidable_skill', minStatus }));
    }
    for (const s of unreachable) {
      issues.push(issue('prerequisite_unreachable', 'error', { index, subject, requirement, skill: s.id, kind: s.kind, reason: 'recognition_only', minStatus }));
    }
  });

  // Ciclos entre habilidades: una arista s → r significa «s requiere r».
  const edges = new Map<string, Set<string>>();
  for (const p of catalog.prerequisites) {
    if (!known(p.subject) || !known(p.requires)) continue;
    for (const s of skillsOf(p.subject, catalog)) {
      const set = edges.get(s.id) ?? new Set<string>();
      for (const r of requiredSkills(p.requires, catalog, config)) if (r.id !== s.id) set.add(r.id);
      edges.set(s.id, set);
    }
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      issues.push(issue('prerequisite_cycle', 'error', { path: [...path.slice(path.indexOf(id)), id].join(' → ') }));
      return;
    }
    state.set(id, 'visiting');
    for (const next of edges.get(id) ?? []) visit(next, [...path, id]);
    state.set(id, 'done');
  };
  for (const id of edges.keys()) visit(id, []);

  // Unidades que nunca podrán llegar a «aprendida» o a «dominada» con variedad de formatos.
  const limited: string[] = [];
  for (const u of catalog.units) {
    const skills = catalog.skills.filter((s) => s.unitId === u.id);
    if (!skills.length) {
      issues.push(issue('unit_without_skills', 'warning', { unit: u.id }));
      continue;
    }
    const consolidable = skills.filter((s) => canConsolidate(s.kind, config));
    if (!consolidable.length) {
      issues.push(issue('unit_cannot_be_learned', 'warning', { unit: u.id, kinds: [...new Set(skills.map((s) => s.kind))].join(', ') }));
      continue;
    }
    const formats = new Set(consolidable.flatMap((s) => deferredFormatsOf(s.kind, config)));
    if (formats.size < config.unitLevels.masteredMinFormats) limited.push(u.id);
  }
  // Un solo aviso informativo por catálogo: es una característica del tipo de unidad, no un error del autor.
  if (limited.length) {
    issues.push(issue('unit_limited_formats', 'info', { count: limited.length, units: limited.slice(0, 5).join(', '), more: Math.max(0, limited.length - 5), expected: config.unitLevels.masteredMinFormats }));
  }

  // Asociaciones que solo aparecen en habilidades de reconocimiento: nunca se recuperarían.
  const associationSkills = new Map<string, SkillDef[]>();
  for (const s of catalog.skills) {
    if (!s.associationId) continue;
    associationSkills.set(s.associationId, [...(associationSkills.get(s.associationId) ?? []), s]);
  }
  for (const [association, skills] of associationSkills) {
    const retrieved = skills.some((s) => config.skillFormats[s.kind].some((f) => config.evidence.retrievalFormats.includes(f)));
    if (!retrieved) issues.push(issue('association_never_retrieved', 'warning', { association, skills: skills.map((s) => s.id).join(', ') }));
  }

  const order = { error: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

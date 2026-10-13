// Prerrequisitos: una unidad o habilidad no se puede practicar hasta que lo requerido esté preparado.
import type { CoreConfig } from './config';
import type { SkillState } from './skill';
import type { Catalog, Id, Ref, SkillDef, SkillStatus } from './types';

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

const refKey = (ref: Ref): string => ('unit' in ref ? `unit:${ref.unit}` : `skill:${ref.skill}`);

function skillsOf(ref: Ref, catalog: Catalog): SkillDef[] {
  if ('skill' in ref) return catalog.skills.filter((s) => s.id === ref.skill);
  return catalog.skills.filter((s) => s.unitId === ref.unit);
}

function isSatisfied(ref: Ref, skills: Record<Id, SkillState>, catalog: Catalog, config: CoreConfig): boolean {
  return skillsOf(ref, catalog).every((def) => {
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

/** Problemas del catálogo: referencias desconocidas, duplicados y ciclos de prerrequisitos. */
export function validateCatalog(catalog: Catalog): string[] {
  const problems: string[] = [];
  const unitIds = new Set(catalog.units.map((u) => u.id));
  const skillIds = new Set<string>();
  for (const s of catalog.skills) {
    if (skillIds.has(s.id)) problems.push(`habilidad duplicada: ${s.id}`);
    skillIds.add(s.id);
    if (!unitIds.has(s.unitId)) problems.push(`habilidad ${s.id} apunta a una unidad desconocida: ${s.unitId}`);
  }
  const known = (ref: Ref) => ('unit' in ref ? unitIds.has(ref.unit) : skillIds.has(ref.skill));
  for (const p of catalog.prerequisites) {
    if (!known(p.subject)) problems.push(`prerrequisito con sujeto desconocido: ${refKey(p.subject)}`);
    if (!known(p.requires)) problems.push(`prerrequisito con requisito desconocido: ${refKey(p.requires)}`);
  }
  if (problems.length) return problems;

  // Grafo entre habilidades: una arista s → r significa «s requiere r».
  const edges = new Map<string, Set<string>>();
  for (const p of catalog.prerequisites) {
    for (const s of skillsOf(p.subject, catalog)) {
      const set = edges.get(s.id) ?? new Set<string>();
      for (const r of skillsOf(p.requires, catalog)) set.add(r.id);
      edges.set(s.id, set);
    }
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      problems.push(`ciclo de prerrequisitos: ${[...path.slice(path.indexOf(id)), id].join(' → ')}`);
      return;
    }
    state.set(id, 'visiting');
    for (const next of edges.get(id) ?? []) visit(next, [...path, id]);
    state.set(id, 'done');
  };
  for (const id of edges.keys()) visit(id, []);
  return problems;
}

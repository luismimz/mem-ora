// Dos catálogos sintéticos de materias distintas. Solo usan los tipos públicos del núcleo.
import type { Catalog, Prerequisite, SkillDef, UnitDef } from '@memora/core';

/** Curso de idioma: 30 términos y 6 estructuras; cada estructura exige recuperar los dos términos anteriores. */
export function languageCourse(): Catalog {
  const units: UnitDef[] = [];
  const skills: SkillDef[] = [];
  const prerequisites: Prerequisite[] = [];
  let terms: string[] = [];
  for (let i = 1; i <= 36; i += 1) {
    const id = `lang-${String(i).padStart(2, '0')}`;
    if (i % 6 === 0) {
      units.push({ id, courseId: 'lang', type: 'pattern' });
      skills.push({ id: `${id}.recall`, unitId: id, kind: 'recall' }, { id: `${id}.produce`, unitId: id, kind: 'produce' });
      for (const t of terms.slice(-2)) prerequisites.push({ subject: { unit: id }, requires: { skill: `${t}.recall` } });
    } else {
      units.push({ id, courseId: 'lang', type: 'term' });
      skills.push(
        { id: `${id}.listen`, unitId: id, kind: 'listen' },
        { id: `${id}.recall`, unitId: id, kind: 'recall', associationId: `${id}.bridge` },
        { id: `${id}.produce`, unitId: id, kind: 'produce' },
      );
      terms = [...terms, id];
    }
    prerequisites.push({ subject: { skill: `${id}.produce` }, requires: { skill: `${id}.recall` } });
  }
  return { units, skills, prerequisites };
}

/**
 * Curso de programación: 6 módulos con 3 conceptos, 2 comandos y 1 fragmento de código.
 * Cada comando exige recuperar un concepto; el fragmento exige los dos comandos;
 * el primer concepto de un módulo exige el fragmento del anterior.
 */
export function programmingCourse(): Catalog {
  const units: UnitDef[] = [];
  const skills: SkillDef[] = [];
  const prerequisites: Prerequisite[] = [];
  for (let m = 1; m <= 6; m += 1) {
    const concepts = [1, 2, 3].map((c) => `prog-m${m}-concept${c}`);
    const commands = [1, 2].map((c) => `prog-m${m}-command${c}`);
    const snippet = `prog-m${m}-snippet`;
    for (const id of concepts) {
      units.push({ id, courseId: 'prog', type: 'concept' });
      skills.push({ id: `${id}.recognize`, unitId: id, kind: 'recognize' }, { id: `${id}.recall`, unitId: id, kind: 'recall', associationId: `${id}.analogy` });
    }
    commands.forEach((id, i) => {
      units.push({ id, courseId: 'prog', type: 'command' });
      skills.push({ id: `${id}.recall`, unitId: id, kind: 'recall' }, { id: `${id}.produce`, unitId: id, kind: 'produce' });
      prerequisites.push({ subject: { unit: id }, requires: { skill: `${concepts[i]}.recall` } });
      prerequisites.push({ subject: { skill: `${id}.produce` }, requires: { skill: `${id}.recall` } });
    });
    units.push({ id: snippet, courseId: 'prog', type: 'code_snippet' });
    skills.push({ id: `${snippet}.apply`, unitId: snippet, kind: 'apply' });
    for (const c of commands) prerequisites.push({ subject: { unit: snippet }, requires: { skill: `${c}.recall` } });
    if (m > 1) prerequisites.push({ subject: { unit: concepts[0]! }, requires: { skill: `prog-m${m - 1}-snippet.apply` } });
  }
  return { units, skills, prerequisites };
}

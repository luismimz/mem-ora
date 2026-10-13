// Prueba de recorrido completo del H1: 30 días, cuatro alumnos sintéticos, dos cursos de materias distintas,
// el mismo núcleo sin cambios.
import { describe, expect, it } from 'vitest';
import { resolveConfig, serializeLearner } from '@memora/core';
import { languageCourse, programmingCourse } from '../src/courses';
import { simulate } from '../src/simulate';
import { PROFILES } from '../src/student';

const config = resolveConfig();
const lang = languageCourse();
const prog = programmingCourse();
const runs = {
  language: simulate(PROFILES.languageLearner, lang, config),
  programming: simulate(PROFILES.programmingLearner, prog, config),
  forgetful: simulate(PROFILES.forgetful, lang, config),
  absent: simulate(PROFILES.absent, lang, config),
};
const catalogOf = (name: keyof typeof runs) => (name === 'programming' ? prog : lang);

describe('simulación de 30 días', () => {
  it('el mismo núcleo consolida habilidades en los dos cursos', () => {
    expect(runs.language.rows.at(-1)!.statuses.consolidated).toBeGreaterThan(0);
    expect(runs.programming.rows.at(-1)!.statuses.consolidated).toBeGreaterThan(0);
  });

  it('ningún día supera los topes de repaso, de lo nuevo ni el total', () => {
    for (const run of Object.values(runs)) {
      for (const row of run.rows) {
        expect(row.reviews).toBeLessThanOrEqual(config.load.reviewCap);
        expect(row.newItems).toBeLessThanOrEqual(config.load.newCap);
        expect(row.reviews + row.newItems).toBeLessThanOrEqual(config.load.totalCap);
      }
    }
  });

  it('nada se consolida sin éxitos diferidos y lo que solo se reconoce nunca se consolida', () => {
    for (const [name, run] of Object.entries(runs) as Array<[keyof typeof runs, (typeof runs)[keyof typeof runs]]>) {
      for (const def of catalogOf(name).skills) {
        const state = run.learner.skills[def.id];
        if (state?.status === 'consolidated') expect(state.deferredSuccesses).toBeGreaterThanOrEqual(config.skill.deferredSuccessesToConsolidate);
        if (def.kind === 'recognize' || def.kind === 'listen') expect(state?.status).not.toBe('consolidated');
      }
    }
  });

  it('los prerrequisitos se respetan: nada empieza antes de que lo requerido esté preparado', () => {
    const { learner } = runs.programming;
    for (const p of prog.prerequisites) {
      if (!('skill' in p.requires)) continue;
      const required = learner.skills[p.requires.skill];
      const subjects = prog.skills.filter((s) => ('skill' in p.subject ? s.id === p.subject.skill : s.unitId === p.subject.unit));
      for (const s of subjects) {
        const started = learner.skills[s.id]?.presentedAt;
        if (started !== undefined && started !== null) expect(required?.presentedAt ?? Infinity).toBeLessThan(started);
      }
    }
  });

  it('tras 5 días sin estudiar, los vencidos se recuperan en pocos días sin saturar el tope', () => {
    const rows = runs.absent.rows;
    const firstBack = rows.find((r) => r.day === 16)!;
    expect(firstBack.studied).toBe(true);
    expect(firstBack.due).toBeGreaterThan(config.load.reviewCap);
    expect(firstBack.newSuppressed).toBe(true);
    expect(firstBack.reviews).toBe(config.load.reviewCap);
    const recovered = rows.find((r) => r.day >= 16 && r.backlog <= config.load.backlogSuppressNew);
    expect(recovered?.day).toBeLessThanOrEqual(20);
  });

  it('el olvidadizo consolida menos y activa más revisiones de asociaciones que el alumno típico', () => {
    const typical = runs.language.rows.at(-1)!;
    const forgetful = runs.forgetful.rows.at(-1)!;
    expect(forgetful.statuses.consolidated).toBeLessThan(typical.statuses.consolidated);
    expect(forgetful.associations.reviewNeeded).toBeGreaterThan(typical.associations.reviewNeeded);
  });

  it('es determinista', () => {
    expect(serializeLearner(simulate(PROFILES.absent, lang, config).learner)).toBe(serializeLearner(runs.absent.learner));
  });
});

// Prueba de recorrido completo del H1: 30 días, cuatro alumnos sintéticos, dos cursos de materias distintas,
// el mismo núcleo sin cambios.
import { describe, expect, it } from 'vitest';
import { DAY, resolveConfig, serializeLearner, unitLevel, validateCatalog, type SkillStatus } from '@memora/core';
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
const LEARNED_OR_ABOVE: SkillStatus[] = ['learned', 'stable', 'mastered'];
const final = (name: keyof typeof runs) => runs[name].rows.at(-1)!.statuses;
const learnedOrAbove = (s: Record<SkillStatus, number>) => s.learned + s.stable + s.mastered;

describe('simulación de 30 días', () => {
  it('el mismo núcleo lleva habilidades a «aprendida» y «estable» en los dos cursos', () => {
    for (const name of ['language', 'programming'] as const) {
      expect(final(name).learned).toBeGreaterThan(0);
      expect(final(name).stable).toBeGreaterThan(0);
    }
  });

  it('en 30 días nada puede estar «dominado»: exige un acierto tras ≥ 30 días sin exposición', () => {
    for (const name of Object.keys(runs) as Array<keyof typeof runs>) expect(final(name).mastered).toBe(0);
  });

  it('a 60 días aparecen dominadas, y cada una se presentó hace al menos 30 días', () => {
    const long = simulate(PROFILES.languageLearner, lang, config, 60);
    expect(long.rows.at(-1)!.statuses.mastered).toBeGreaterThan(0);
    const end = Math.max(...Object.values(long.learner.applied));
    for (const s of Object.values(long.learner.skills)) {
      if (s.status === 'mastered') expect(end - (s.presentedAt ?? end)).toBeGreaterThanOrEqual(30 * DAY);
    }
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

  it('nada es «aprendida» sin éxitos diferidos y el reconocimiento puro nunca se consolida', () => {
    for (const [name, run] of Object.entries(runs) as Array<[keyof typeof runs, (typeof runs)[keyof typeof runs]]>) {
      for (const def of catalogOf(name).skills) {
        const state = run.learner.skills[def.id];
        if (state && LEARNED_OR_ABOVE.includes(state.status)) expect(state.deferredSuccesses).toBeGreaterThanOrEqual(config.skill.deferredSuccessesToLearn);
        if (def.kind === 'recognize') expect(['new', 'presented', 'learning']).toContain(state?.status ?? 'new');
      }
    }
  });

  it('escuchar ya no queda bloqueado: con dictado y explicación libre llega a «aprendida» o más', () => {
    const listened = lang.skills.filter((s) => s.kind === 'listen').map((s) => runs.language.learner.skills[s.id]?.status);
    expect(listened.filter((s) => s && LEARNED_OR_ABOVE.includes(s)).length).toBeGreaterThan(listened.length / 2);
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

  it('el olvidadizo aprende menos y activa más revisiones de asociaciones que el alumno típico', () => {
    expect(learnedOrAbove(final('forgetful'))).toBeLessThan(learnedOrAbove(final('language')));
    expect(final('forgetful').stable).toBeLessThan(final('language').stable);
    expect(runs.forgetful.rows.at(-1)!.associations.reviewNeeded).toBeGreaterThan(runs.language.rows.at(-1)!.associations.reviewNeeded);
  });

  it('los dos catálogos sintéticos pasan el validador sin errores', () => {
    for (const c of [lang, prog]) expect(validateCatalog(c, config).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('el nivel de cada unidad nunca supera el de sus habilidades y «dominada» exige variedad', () => {
    const long = simulate(PROFILES.languageLearner, lang, config, 60);
    let mastered = 0;
    for (const u of lang.units) {
      const report = unitLevel(u.id, lang, long.learner.skills, config);
      const statuses = report.counted.map((id) => long.learner.skills[id]?.status);
      if (report.level !== 'none') expect(statuses.every((s) => s && LEARNED_OR_ABOVE.includes(s))).toBe(true);
      if (report.level === 'mastered') {
        mastered += 1;
        expect(statuses.every((s) => s === 'mastered')).toBe(true);
        expect(report.formats.length).toBeGreaterThanOrEqual(report.requiredFormats);
        expect(report.contexts).toBeGreaterThanOrEqual(report.requiredContexts);
      }
    }
    expect(runs.language.rows.at(-1)!.units.mastered).toBe(0);
    expect(mastered).toBe(long.rows.at(-1)!.units.mastered);
  });

  it('es determinista', () => {
    expect(serializeLearner(simulate(PROFILES.absent, lang, config).learner)).toBe(serializeLearner(runs.absent.learner));
  });
});

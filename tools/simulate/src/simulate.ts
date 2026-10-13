// Bucle de simulación: cada día pide el plan al núcleo, el alumno sintético responde y el núcleo
// registra la evidencia. El mismo código sirve para cualquier catálogo.
import {
  DAY,
  HOUR,
  applyAttempt,
  applyExposure,
  assessAssociation,
  createLearner,
  planDay,
  SKILL_STATUSES,
  type Catalog,
  type CoreConfig,
  type LearnerState,
  type SkillStatus,
} from '@memora/core';
import { SyntheticStudent, formatFor, type Profile } from './student';

export const SIM_START = Date.UTC(2026, 0, 5, 0, 0, 0);

export interface DayRow {
  day: number;
  studied: boolean;
  newItems: number;
  reviews: number;
  correct: number;
  attempts: number;
  /** Vencidas al empezar el día y vencidas que quedaron fuera del plan. */
  due: number;
  backlog: number;
  newSuppressed: boolean;
  statuses: Record<SkillStatus, number>;
  associations: { holding: number; forming: number; losing: number; reviewNeeded: number };
}

export interface SimulationResult {
  profile: Profile;
  rows: DayRow[];
  learner: LearnerState;
}

export function simulate(profile: Profile, catalog: Catalog, config: CoreConfig, days = 30): SimulationResult {
  const student = new SyntheticStudent(profile);
  const kindOf = new Map(catalog.skills.map((s) => [s.id, s.kind]));
  let learner = createLearner(profile.name);
  let seq = 0;
  const rows: DayRow[] = [];

  for (let d = 0; d < days; d += 1) {
    const sessionStart = SIM_START + d * DAY + 9 * HOUR;
    const studied = !profile.absentDays.includes(d);
    const plan = planDay({ catalog, learner, now: sessionStart, config });
    let correct = 0;
    let attempts = 0;
    if (studied) {
      plan.items.forEach((item, index) => {
        const at = sessionStart + index * 45_000;
        const kind = kindOf.get(item.skillId) ?? 'recall';
        if (item.reason === 'new') {
          seq += 1;
          learner = applyExposure(learner, { id: `${profile.name}-x${seq}`, userId: learner.userId, skillId: item.skillId, unitId: item.unitId, associationId: item.associationId, at }, config);
          student.expose(item.skillId, at);
        }
        const hint = kind === 'recall' ? item.recommendedHint : 0;
        const format = formatFor(kind, hint);
        const answeredAt = at + 20_000;
        const { correct: ok, timeMs } = student.answer(item.skillId, answeredAt, format, hint);
        seq += 1;
        learner = applyAttempt(
          learner,
          { id: `${profile.name}-a${seq}`, userId: learner.userId, skillId: item.skillId, unitId: item.unitId, associationId: item.associationId, at: answeredAt, format, correct: ok, hint, timeMs },
          config,
        ).learner;
        attempts += 1;
        if (ok) correct += 1;
      });
    }

    const statuses = Object.fromEntries(SKILL_STATUSES.map((s) => [s, 0])) as Record<SkillStatus, number>;
    for (const def of catalog.skills) statuses[learner.skills[def.id]?.status ?? 'new'] += 1;
    const associations = { holding: 0, forming: 0, losing: 0, reviewNeeded: 0 };
    for (const a of Object.values(learner.associations)) {
      const assessment = assessAssociation(a, config);
      if (assessment.needsReview) associations.reviewNeeded += 1;
      if (assessment.trajectory === 'holding') associations.holding += 1;
      else if (assessment.trajectory === 'losing') associations.losing += 1;
      else associations.forming += 1;
    }
    rows.push({
      day: d + 1,
      studied,
      newItems: studied ? plan.stats.newSlots : 0,
      reviews: studied ? plan.stats.reviewSlots : 0,
      correct,
      attempts,
      due: plan.stats.due,
      backlog: studied ? plan.stats.backlog : plan.stats.due,
      newSuppressed: plan.stats.newSuppressedByBacklog,
      statuses,
      associations,
    });
  }
  return { profile, rows, learner };
}

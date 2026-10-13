// Plan del día: repasos vencidos primero, por prioridad; lo nuevo solo si cabe, se puede practicar
// y el alumno no arrastra demasiados vencidos. Los vencidos que no caben no se pierden: siguen vencidos.
import { assessAssociation, recommendedHint } from './association';
import type { CoreConfig } from './config';
import type { LearnerState } from './learner';
import { canPractice } from './prerequisites';
import type { SkillState } from './skill';
import { dayOf } from './time';
import type { Catalog, HintLevel, Id } from './types';

export interface PlanItem {
  skillId: Id;
  unitId: Id;
  reason: 'review' | 'new';
  priority: number;
  associationId?: Id;
  recommendedHint: HintLevel;
}

export interface DailyPlan {
  day: number;
  items: PlanItem[];
  stats: {
    /** Habilidades vencidas ahora. */
    due: number;
    reviewSlots: number;
    newSlots: number;
    /** Vencidas que quedan fuera del plan de hoy. */
    backlog: number;
    newSuppressedByBacklog: boolean;
    /** Factor aplicado a lo nuevo por la precisión reciente (1, 0,5 o 0). */
    newLoadFactor: number;
  };
}

const ACTIVE = new Set(['presented', 'learning', 'consolidating', 'consolidated', 'weakened']);

/** Prioridad de un repaso vencido: retraso relativo (con tope) + debilitada + asociación en apuros. */
export function reviewPriority(state: SkillState, now: number, learner: LearnerState, associationId: Id | undefined, config: CoreConfig): number {
  const steps = config.scheduler.stepsMs;
  const interval = Math.max(steps[state.step] ?? steps[steps.length - 1] ?? 1, 1);
  const overdue = Math.min(config.load.overdueCapRatio, Math.max(0, (now - (state.dueAt ?? now)) / interval));
  let priority = overdue;
  if (state.status === 'weakened') priority += config.load.weakenedBonus;
  const association = associationId ? learner.associations[associationId] : undefined;
  if (association && assessAssociation(association, config).trajectory === 'losing') priority += config.load.associationLosingBonus;
  return priority;
}

/** Factor de carga nueva según la precisión de los días anteriores (sin contar hoy). */
export function newLoadFactor(learner: LearnerState, today: number, config: CoreConfig): number {
  let attempts = 0;
  let correct = 0;
  for (let d = today - config.load.adaptWindowDays; d < today; d += 1) {
    const day = learner.activity[String(d)];
    if (day) {
      attempts += day.attempts;
      correct += day.correct;
    }
  }
  if (attempts < config.load.adaptMinAttempts) return 1;
  const accuracy = correct / attempts;
  if (accuracy < config.load.veryLowAccuracy) return 0;
  if (accuracy < config.load.lowAccuracy) return 0.5;
  return 1;
}

export function planDay(input: { catalog: Catalog; learner: LearnerState; now: number; config: CoreConfig }): DailyPlan {
  const { catalog, learner, now, config } = input;
  const load = config.load;
  const day = dayOf(now, load.dayOriginMs, load.dayLengthMs);
  const done = learner.activity[String(day)] ?? { introduced: 0, reviews: 0, attempts: 0, correct: 0 };
  const associationOf = new Map(catalog.skills.map((s) => [s.id, s.associationId]));

  // Repasos vencidos (habilidad o su asociación) ordenados por prioridad; desempate estable por id.
  const due = catalog.skills
    .map((def) => ({ def, state: learner.skills[def.id] }))
    .filter((x): x is { def: (typeof x)['def']; state: SkillState } => {
      if (!x.state || !ACTIVE.has(x.state.status)) return false;
      const association = x.def.associationId ? learner.associations[x.def.associationId] : undefined;
      const skillDue = x.state.dueAt !== null && x.state.dueAt <= now;
      const associationDue = association?.dueAt !== null && association?.dueAt !== undefined && association.dueAt <= now;
      return skillDue || associationDue;
    })
    .filter((x) => x.state.lastAttemptAt === null || dayOf(x.state.lastAttemptAt, load.dayOriginMs, load.dayLengthMs) < day)
    .map((x) => ({ ...x, priority: reviewPriority(x.state, now, learner, x.def.associationId, config) }))
    .sort((a, b) => b.priority - a.priority || (a.def.id < b.def.id ? -1 : 1));

  const usedToday = done.introduced + done.reviews;
  const remaining = Math.max(0, load.totalCap - usedToday);
  const reviewSlots = Math.min(Math.max(0, load.reviewCap - done.reviews), remaining, due.length);
  const reviews = due.slice(0, reviewSlots);
  const backlog = due.length - reviews.length;

  const factor = newLoadFactor(learner, day, config);
  const suppressed = backlog > load.backlogSuppressNew;
  const newSlots = suppressed
    ? 0
    : Math.min(Math.floor(Math.max(0, load.newCap - done.introduced) * factor), remaining - reviews.length);

  const fresh: PlanItem[] = [];
  for (const def of catalog.skills) {
    if (fresh.length >= newSlots) break;
    const state = learner.skills[def.id];
    if (state && state.status !== 'new') continue;
    if (!canPractice({ skill: def.id }, learner.skills, catalog, config).allowed) continue;
    fresh.push({ skillId: def.id, unitId: def.unitId, reason: 'new', priority: 0, associationId: def.associationId, recommendedHint: 0 });
  }

  const items: PlanItem[] = [
    ...reviews.map(({ def, priority }) => ({
      skillId: def.id,
      unitId: def.unitId,
      reason: 'review' as const,
      priority,
      associationId: associationOf.get(def.id),
      recommendedHint: recommendedHint(def.associationId ? learner.associations[def.associationId] : undefined),
    })),
    ...fresh,
  ];

  return {
    day,
    items,
    stats: { due: due.length, reviewSlots: reviews.length, newSlots: fresh.length, backlog, newSuppressedByBacklog: suppressed, newLoadFactor: factor },
  };
}

// Estado completo de un alumno: habilidades, asociaciones, eventos ya aplicados y actividad diaria.
// Aplicar el mismo evento dos veces no cambia nada (idempotencia por id).
import type { CoreConfig } from './config';
import { applyAssociationAttempt, newAssociationState, presentAssociation, type AssociationState } from './association';
import { assertValidAttempt } from './evidence';
import { adaptiveScheduler, type Scheduler } from './scheduler';
import { applySkillAttempt, exposeSkill, newSkillState, type SkillState } from './skill';
import { dayOf } from './time';
import type { Attempt, Exposure, Id } from './types';

/** 2: la habilidad guarda formatos y contextos con éxito diferido. */
export const LEARNER_SCHEMA_VERSION = 2;

export interface DayActivity {
  /** Habilidades presentadas por primera vez. */
  introduced: number;
  /** Habilidades ya practicadas otro día y repasadas hoy (una vez por habilidad y día). */
  reviews: number;
  attempts: number;
  correct: number;
}

export interface LearnerState {
  schemaVersion: number;
  userId: Id;
  skills: Record<Id, SkillState>;
  associations: Record<Id, AssociationState>;
  /** Ids de intentos y exposiciones ya aplicados → instante. */
  applied: Record<Id, number>;
  /** Actividad por índice de día. */
  activity: Record<string, DayActivity>;
}

export function createLearner(userId: Id): LearnerState {
  return { schemaVersion: LEARNER_SCHEMA_VERSION, userId, skills: {}, associations: {}, applied: {}, activity: {} };
}

const emptyDay = (): DayActivity => ({ introduced: 0, reviews: 0, attempts: 0, correct: 0 });

function bumpDay(learner: LearnerState, at: number, config: CoreConfig, patch: Partial<DayActivity>): Record<string, DayActivity> {
  const key = String(dayOf(at, config.load.dayOriginMs, config.load.dayLengthMs));
  const day = learner.activity[key] ?? emptyDay();
  return {
    ...learner.activity,
    [key]: {
      introduced: day.introduced + (patch.introduced ?? 0),
      reviews: day.reviews + (patch.reviews ?? 0),
      attempts: day.attempts + (patch.attempts ?? 0),
      correct: day.correct + (patch.correct ?? 0),
    },
  };
}

function checkOwner(learner: LearnerState, userId: Id): void {
  if (userId !== learner.userId) throw new Error(`El evento pertenece a otro alumno (${userId})`);
}

export function applyExposure(learner: LearnerState, exposure: Exposure, config: CoreConfig, scheduler: Scheduler = adaptiveScheduler): LearnerState {
  checkOwner(learner, exposure.userId);
  if (learner.applied[exposure.id] !== undefined) return learner;
  const before = learner.skills[exposure.skillId] ?? newSkillState(exposure.skillId, exposure.unitId, config);
  const skill = exposeSkill(before, exposure.at, scheduler, config);
  const associations = { ...learner.associations };
  if (exposure.associationId) {
    const a = associations[exposure.associationId] ?? newAssociationState(exposure.associationId);
    associations[exposure.associationId] = presentAssociation(a, exposure.at, config);
  }
  return {
    ...learner,
    skills: { ...learner.skills, [skill.skillId]: skill },
    associations,
    applied: { ...learner.applied, [exposure.id]: exposure.at },
    activity: before.status === 'new' ? bumpDay(learner, exposure.at, config, { introduced: 1 }) : learner.activity,
  };
}

export interface AttemptOutcome {
  learner: LearnerState;
  /** Falso si el intento ya estaba aplicado. */
  applied: boolean;
  weight: number;
  deferredSuccess: boolean;
}

export function applyAttempt(learner: LearnerState, attempt: Attempt, config: CoreConfig, scheduler: Scheduler = adaptiveScheduler): AttemptOutcome {
  checkOwner(learner, attempt.userId);
  if (learner.applied[attempt.id] !== undefined) return { learner, applied: false, weight: 0, deferredSuccess: false };
  assertValidAttempt(attempt);

  const before = learner.skills[attempt.skillId] ?? newSkillState(attempt.skillId, attempt.unitId, config);
  const { state: skill, weight, deferredSuccess } = applySkillAttempt(before, attempt, scheduler, config);

  const associations = { ...learner.associations };
  if (attempt.associationId) {
    const a = associations[attempt.associationId] ?? newAssociationState(attempt.associationId);
    associations[attempt.associationId] = applyAssociationAttempt(a, attempt, config).state;
  }

  const { dayOriginMs, dayLengthMs } = config.load;
  const isReview = before.lastAttemptAt !== null && dayOf(before.lastAttemptAt, dayOriginMs, dayLengthMs) < dayOf(attempt.at, dayOriginMs, dayLengthMs);
  const correct = attempt.correct && attempt.hint < 5;
  return {
    learner: {
      ...learner,
      skills: { ...learner.skills, [skill.skillId]: skill },
      associations,
      applied: { ...learner.applied, [attempt.id]: attempt.at },
      activity: bumpDay(learner, attempt.at, config, { attempts: 1, correct: correct ? 1 : 0, reviews: isReview ? 1 : 0 }),
    },
    applied: true,
    weight,
    deferredSuccess,
  };
}

/** Aplica varios eventos en orden cronológico (desempate por id); los repetidos se ignoran. */
export function applyEvents(
  learner: LearnerState,
  events: Array<{ kind: 'exposure'; event: Exposure } | { kind: 'attempt'; event: Attempt }>,
  config: CoreConfig,
  scheduler: Scheduler = adaptiveScheduler,
): LearnerState {
  const sorted = [...events].sort((a, b) => a.event.at - b.event.at || (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0));
  return sorted.reduce(
    (state, item) => (item.kind === 'exposure' ? applyExposure(state, item.event, config, scheduler) : applyAttempt(state, item.event, config, scheduler).learner),
    learner,
  );
}

/** JSON con claves ordenadas: el mismo estado produce siempre el mismo texto. */
export function serializeLearner(learner: LearnerState): string {
  return JSON.stringify(learner, (_key, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    }
    return value;
  });
}

export function deserializeLearner(text: string): LearnerState {
  const data = JSON.parse(text) as Partial<LearnerState>;
  if (data.schemaVersion !== LEARNER_SCHEMA_VERSION) throw new Error(`Versión de estado no compatible: ${String(data.schemaVersion)}`);
  if (typeof data.userId !== 'string' || !data.skills || !data.associations || !data.applied || !data.activity) {
    throw new Error('Estado de alumno incompleto');
  }
  return data as LearnerState;
}

// Estado de una habilidad de un alumno y sus transiciones.
//
//   new → presented → learning → consolidating → consolidated
//                                     ↑   ↓          ↓
//                                   weakened ←───────┘
//
// «Presentar» no es aprender; reconocer no consolida; nada llega a «consolidado» sin éxitos diferidos.
import type { CoreConfig } from './config';
import { evidenceWeight, isDeferredSuccess, isRetrievalFormat } from './evidence';
import type { Scheduler } from './scheduler';
import type { Attempt, Id, SkillStatus } from './types';

export interface SkillState {
  skillId: Id;
  unitId: Id;
  status: SkillStatus;
  /** Evidencia ponderada acumulada. */
  evidence: number;
  /** Aciertos en formato de recuperación (no reconocimiento). */
  retrievalSuccesses: number;
  /** Éxitos diferidos desde la última vez que se debilitó. */
  deferredSuccesses: number;
  consecutiveFailures: number;
  lapses: number;
  attempts: number;
  /** Precisión reciente ponderada (0–1). */
  accuracy: number;
  step: number;
  dueAt: number | null;
  presentedAt: number | null;
  lastExposureAt: number | null;
  lastAttemptAt: number | null;
}

export function newSkillState(skillId: Id, unitId: Id, config: CoreConfig): SkillState {
  return {
    skillId,
    unitId,
    status: 'new',
    evidence: 0,
    retrievalSuccesses: 0,
    deferredSuccesses: 0,
    consecutiveFailures: 0,
    lapses: 0,
    attempts: 0,
    accuracy: config.skill.initialAccuracy,
    step: 0,
    dueAt: null,
    presentedAt: null,
    lastExposureAt: null,
    lastAttemptAt: null,
  };
}

/** Presentación: `new → presented` y primer repaso programado. Volver a verla solo actualiza la exposición. */
export function exposeSkill(state: SkillState, at: number, scheduler: Scheduler, config: CoreConfig): SkillState {
  if (state.status !== 'new') return { ...state, lastExposureAt: Math.max(state.lastExposureAt ?? at, at) };
  const first = scheduler.initial(at, config);
  return { ...state, status: 'presented', presentedAt: at, lastExposureAt: at, step: first.step, dueAt: first.dueAt };
}

export interface SkillAttemptResult {
  state: SkillState;
  weight: number;
  deferredSuccess: boolean;
}

export function applySkillAttempt(state: SkillState, attempt: Attempt, scheduler: Scheduler, config: CoreConfig): SkillAttemptResult {
  const correct = attempt.correct && attempt.hint < 5;
  const weight = evidenceWeight(attempt, config);
  const retrieval = isRetrievalFormat(attempt.format, config);
  const deferredSuccess = isDeferredSuccess(attempt, state.lastExposureAt, config);
  const alpha = config.skill.accuracyAlpha;
  const signal = correct ? Math.min(1, weight / (config.evidence.formatWeight[attempt.format] || 1)) : 0;

  let next: SkillState = {
    ...state,
    attempts: state.attempts + 1,
    accuracy: state.accuracy * (1 - alpha) + signal * alpha,
    lastAttemptAt: Math.max(state.lastAttemptAt ?? attempt.at, attempt.at),
    lastExposureAt: Math.max(state.lastExposureAt ?? attempt.at, attempt.at),
    presentedAt: state.presentedAt ?? attempt.at,
    status: state.status === 'new' || state.status === 'presented' ? 'learning' : state.status,
  };

  if (correct) {
    next.evidence += weight;
    next.consecutiveFailures = 0;
    if (retrieval) next.retrievalSuccesses += 1;
    if (deferredSuccess) next.deferredSuccesses += 1;
  } else {
    next.consecutiveFailures += 1;
    if (retrieval) next.evidence = Math.max(0, next.evidence - config.skill.failEvidencePenalty);
  }

  next = transition(state.status, next, { correct, retrieval, deferredSuccess }, config);
  const decision = scheduler.next({ state: next, previousStep: state.step, correct, weight, retrieval, now: attempt.at }, config);
  return { state: { ...next, step: decision.step, dueAt: decision.dueAt }, weight, deferredSuccess };
}

function transition(
  before: SkillStatus,
  s: SkillState,
  o: { correct: boolean; retrieval: boolean; deferredSuccess: boolean },
  config: CoreConfig,
): SkillState {
  const retrievalFailure = !o.correct && o.retrieval;
  switch (s.status) {
    case 'learning':
      // Una sola transición por intento: la habilidad que acaba de empezar no salta etapas.
      if (before !== 'new' && before !== 'presented' && s.evidence >= config.skill.consolidatingEvidence && s.retrievalSuccesses >= 1) {
        return { ...s, status: 'consolidating' };
      }
      return s;
    case 'consolidating':
      if (retrievalFailure) {
        const deferredSuccesses = Math.max(0, s.deferredSuccesses - 1);
        if (s.consecutiveFailures >= config.skill.failuresToWeakenConsolidating) {
          return { ...s, status: 'weakened', deferredSuccesses: 0, lapses: s.lapses + 1 };
        }
        return { ...s, deferredSuccesses };
      }
      if (o.deferredSuccess && s.deferredSuccesses >= config.skill.deferredSuccessesToConsolidate) {
        return { ...s, status: 'consolidated' };
      }
      return s;
    case 'consolidated':
      if (retrievalFailure) return { ...s, status: 'weakened', deferredSuccesses: 0, lapses: s.lapses + 1 };
      return s;
    case 'weakened':
      // Volver a consolidación exige un éxito diferido; ese éxito ya cuenta como el primero.
      if (o.deferredSuccess) return { ...s, status: 'consolidating', deferredSuccesses: 1 };
      return s;
    default:
      return s;
  }
}

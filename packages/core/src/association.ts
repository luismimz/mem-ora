// Estado de una asociación (ayuda de memoria) para un alumno, separado del estado de la habilidad.
//
// Calendario propio de recuperación: +1 d, +3 d, +7 d, +14 d, +30 d (configurable).
// Escalera de pistas P0–P5: un fallo sube la pista recomendada, un acierto la baja.
// Responde si la asociación «se está quedando» o «se está perdiendo» y activa su revisión.
import type { CoreConfig } from './config';
import { isDeferredSuccess, isRetrievalFormat } from './evidence';
import type { Attempt, HintLevel, Id } from './types';

export type AssociationStatus = 'active' | 'review_needed';
export type AssociationTrajectory = 'insufficient_data' | 'forming' | 'holding' | 'losing';

export interface RetrievalRecord {
  at: number;
  hint: HintLevel;
  correct: boolean;
  deferred: boolean;
  step: number;
}

export interface AssociationState {
  associationId: Id;
  /** Versión de la asociación que se está midiendo; sube al resolver una revisión. */
  version: number;
  status: AssociationStatus;
  /** Pista que se recomienda ofrecer en la próxima recuperación. */
  hintLevel: HintLevel;
  step: number;
  dueAt: number | null;
  presentedAt: number | null;
  lastExposureAt: number | null;
  consecutiveFailures: number;
  retrievals: number;
  history: RetrievalRecord[];
  reviewRequestedAt: number | null;
  reviewReasons: string[];
}

export function newAssociationState(associationId: Id): AssociationState {
  return {
    associationId,
    version: 1,
    status: 'active',
    hintLevel: 0,
    step: 0,
    dueAt: null,
    presentedAt: null,
    lastExposureAt: null,
    consecutiveFailures: 0,
    retrievals: 0,
    history: [],
    reviewRequestedAt: null,
    reviewReasons: [],
  };
}

export function presentAssociation(state: AssociationState, at: number, config: CoreConfig): AssociationState {
  if (state.presentedAt !== null) return { ...state, lastExposureAt: Math.max(state.lastExposureAt ?? at, at) };
  return { ...state, presentedAt: at, lastExposureAt: at, step: 0, dueAt: at + (config.association.stepsMs[0] ?? 0) };
}

export interface AssociationAttemptResult {
  state: AssociationState;
  /** Falso si el intento no era una recuperación (reconocimiento): no cuenta para la asociación. */
  counted: boolean;
  deferredSuccess: boolean;
}

/** Pista recomendada para la próxima recuperación. */
export function recommendedHint(state: AssociationState | undefined): HintLevel {
  return state?.hintLevel ?? 0;
}

const clampHint = (value: number, max: HintLevel): HintLevel => Math.max(0, Math.min(max, value)) as HintLevel;

export function applyAssociationAttempt(state: AssociationState, attempt: Attempt, config: CoreConfig): AssociationAttemptResult {
  // Elegir entre opciones no demuestra que la asociación permita recuperar: no se cuenta.
  if (!isRetrievalFormat(attempt.format, config)) return { state, counted: false, deferredSuccess: false };

  const c = config.association;
  const steps = c.stepsMs;
  const last = steps.length - 1;
  const correct = attempt.correct && attempt.hint < 5;
  const deferredSuccess = isDeferredSuccess(attempt, state.lastExposureAt ?? state.presentedAt, config);
  const at = attempt.at;

  let step = state.step;
  let hintLevel: HintLevel;
  let consecutiveFailures: number;
  if (correct) {
    consecutiveFailures = 0;
    hintLevel = clampHint(attempt.hint - 1, c.maxRecommendedHint);
    if (deferredSuccess) step = Math.min(step + 1, last);
  } else {
    consecutiveFailures = state.consecutiveFailures + 1;
    hintLevel = clampHint(Math.max(attempt.hint, state.hintLevel) + 1, c.maxRecommendedHint);
    step = Math.max(0, step - c.failStepDrop);
  }

  const record: RetrievalRecord = { at, hint: attempt.hint, correct, deferred: deferredSuccess, step };
  let next: AssociationState = {
    ...state,
    step,
    hintLevel,
    consecutiveFailures,
    retrievals: state.retrievals + 1,
    dueAt: at + (steps[step] ?? steps[last] ?? 0),
    presentedAt: state.presentedAt ?? at,
    lastExposureAt: Math.max(state.lastExposureAt ?? at, at),
    history: [...state.history, record].slice(-c.historyLimit),
  };

  const triggers = reviewTriggers(next, config);
  if (triggers.length && next.status !== 'review_needed') {
    next = { ...next, status: 'review_needed', reviewRequestedAt: at, reviewReasons: triggers };
  }
  return { state: next, counted: true, deferredSuccess };
}

/** Motivos que activan la revisión humana de la asociación. */
export function reviewTriggers(state: AssociationState, config: CoreConfig): string[] {
  const c = config.association;
  const reasons: string[] = [];
  if (state.consecutiveFailures >= c.failuresToReview) reasons.push('consecutive_failures');
  const window = state.history.slice(-c.losingWindow);
  if (window.length >= c.losingWindow) {
    const failures = window.filter((r) => !r.correct).length;
    if (failures / window.length >= c.losingFailureRate) reasons.push('high_failure_rate');
  }
  return reasons;
}

export interface AssociationAssessment {
  trajectory: AssociationTrajectory;
  /** Códigos estables de los motivos (la interfaz los traduce). */
  reasons: string[];
  needsReview: boolean;
}

/** ¿La asociación se está quedando o se está perdiendo? */
export function assessAssociation(state: AssociationState, config: CoreConfig): AssociationAssessment {
  const c = config.association;
  const needsReview = state.status === 'review_needed';
  if (state.history.length < c.minRetrievals) {
    return { trajectory: 'insufficient_data', reasons: ['too_few_retrievals'], needsReview };
  }

  const losing: string[] = [...reviewTriggers(state, config)];
  if (state.hintLevel >= c.losingHintLevel) losing.push('needs_strong_hint');
  const lastRecord = state.history.at(-1);
  const previous = state.history.at(-2);
  if (lastRecord && !lastRecord.correct && previous && previous.step >= c.establishedStep) losing.push('failed_after_established');
  if (needsReview && !losing.length) losing.push('review_pending');
  if (losing.length) return { trajectory: 'losing', reasons: [...new Set(losing)], needsReview };

  let streak = 0;
  for (let i = state.history.length - 1; i >= 0; i -= 1) {
    const r = state.history[i];
    if (!r || !r.correct || r.hint !== 0 || !r.deferred) break;
    streak += 1;
  }
  if (streak >= c.holdingStreak && state.hintLevel <= 1) {
    return { trajectory: 'holding', reasons: ['unaided_deferred_streak'], needsReview };
  }
  return { trajectory: 'forming', reasons: ['in_progress'], needsReview };
}

/**
 * Cierra una revisión. Si la asociación se cambió, sube la versión y su medición empieza de cero
 * (no se mezclan los resultados de dos asociaciones distintas).
 */
export function resolveAssociationReview(
  state: AssociationState,
  at: number,
  outcome: 'kept' | 'replaced',
  config: CoreConfig,
): AssociationState {
  const base = { ...state, status: 'active' as const, reviewRequestedAt: null, reviewReasons: [], consecutiveFailures: 0 };
  if (outcome === 'kept') return base;
  return {
    ...base,
    version: state.version + 1,
    hintLevel: 0,
    step: 0,
    retrievals: 0,
    history: [],
    presentedAt: at,
    lastExposureAt: at,
    dueAt: at + (config.association.stepsMs[0] ?? 0),
  };
}

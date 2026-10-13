// Programador de repasos de una habilidad. La interfaz permite cambiar la implementación
// (por ejemplo, evaluar FSRS) sin tocar el resto del núcleo.
import type { CoreConfig } from './config';
import type { SkillState } from './skill';

export interface ScheduleInput {
  /** Estado tras contar el intento (precisión y contadores ya actualizados). */
  state: SkillState;
  /** Escalón antes del intento. */
  previousStep: number;
  correct: boolean;
  /** Peso de evidencia del intento (0 si falla). */
  weight: number;
  retrieval: boolean;
  now: number;
}

export interface ScheduleDecision {
  step: number;
  dueAt: number;
}

export interface Scheduler {
  readonly id: string;
  /** Primer repaso tras presentar la habilidad. */
  initial(now: number, config: CoreConfig): ScheduleDecision;
  next(input: ScheduleInput, config: CoreConfig): ScheduleDecision;
}

/** Factor de facilidad lineal en la precisión reciente: más precisión, intervalos más largos. */
export function easeFactor(accuracy: number, config: CoreConfig): number {
  const { easeMin, easeMax } = config.scheduler;
  const clamped = Math.max(0, Math.min(1, accuracy));
  return easeMin + (easeMax - easeMin) * clamped;
}

/**
 * Implementación simple adaptativa:
 * - fallo: baja `failStepDrop` escalones y vuelve tras `retryDelayMs`;
 * - acierto de recuperación con peso ≥ `advanceMinWeight`: sube un escalón;
 * - acierto débil (reconocimiento o con mucha pista): sube, pero nunca por encima de `weakSuccessMaxStep`
 *   (los intervalos largos exigen recuperación; sin este tope, lo reconocido se repasaría a diario);
 * - el intervalo se multiplica por un factor de facilidad según la precisión reciente.
 */
export const adaptiveScheduler: Scheduler = {
  id: 'adaptive-v1',
  initial(now, config) {
    return { step: 0, dueAt: now + (config.scheduler.stepsMs[0] ?? 0) };
  },
  next({ state, previousStep, correct, weight, retrieval, now }, config) {
    const { stepsMs, retryDelayMs, advanceMinWeight, weakSuccessMaxStep, failStepDrop } = config.scheduler;
    const last = stepsMs.length - 1;
    if (!correct) {
      return { step: Math.max(0, previousStep - failStepDrop), dueAt: now + retryDelayMs };
    }
    const strong = retrieval && weight >= advanceMinWeight;
    const ceiling = strong ? last : Math.min(last, Math.max(previousStep, weakSuccessMaxStep));
    const step = Math.min(previousStep + 1, ceiling);
    const interval = (stepsMs[step] ?? stepsMs[last] ?? 0) * easeFactor(state.accuracy, config);
    return { step, dueAt: now + Math.round(interval) };
  },
};

/** Registro de programadores disponibles. Un FSRS se añadiría aquí tras evaluarlo. */
export const schedulers: Record<string, Scheduler> = { [adaptiveScheduler.id]: adaptiveScheduler };

// Rampa de contenido nuevo (D-057): se empieza con pocas unidades nuevas por sesión y se sube según los aciertos,
// hasta el objetivo del curso. Si el alumno empieza a fallar, baja un escalón. Agnóstico de la materia.
import type { DayActivity } from './learner';

export interface RampOptions {
  /** Unidades nuevas de la primera sesión. */
  start: number;
  /** Cuánto sube o baja cada escalón. */
  step: number;
  /** Aciertos para subir (0–1). */
  upAt: number;
  /** Por debajo de esto, baja (0–1). */
  downAt: number;
  /** Intentos mínimos de un día para que cuente. */
  minAttempts: number;
}

export const DEFAULT_RAMP: RampOptions = { start: 8, step: 2, upAt: 0.8, downAt: 0.6, minAttempts: 5 };

/** Nuevas por sesión según el historial diario de aciertos; nunca supera `target` ni baja de `min(start, target)`. */
export function newUnitsFor(activity: Record<string, DayActivity>, target: number, options: RampOptions = DEFAULT_RAMP): number {
  const floor = Math.min(options.start, target);
  let n = floor;
  const days = Object.keys(activity).map(Number).sort((a, b) => a - b);
  for (const d of days) {
    const a = activity[String(d)];
    if (!a || a.attempts < options.minAttempts) continue;
    const rate = a.correct / a.attempts;
    if (rate >= options.upAt) n = Math.min(target, n + options.step);
    else if (rate < options.downAt) n = Math.max(floor, n - options.step);
  }
  return n;
}

export interface FlowNewInput {
  /** Nuevas por ronda según la rampa (`newUnitsFor`). */
  perRound: number;
  /** Unidades vistas por primera vez hoy. */
  newToday: number;
  /** Rondas de nuevas al día como mucho; `null` = sin tope diario (lo decide la ronda anterior). */
  dailyRounds: number | null;
  /** Respuestas de la ronda anterior de hoy (si la hubo). */
  lastRound?: { answered: number; correct: number };
}
/** Aciertos mínimos en la ronda anterior para seguir con nuevas cuando no hay tope diario. */
export const FLOW_NEW_IF = 0.8;
/** Respuestas mínimas de la ronda anterior para que cuente. */
export const FLOW_NEW_MIN_ANSWERS = 4;

/**
 * Nuevas para la siguiente ronda del Flujo. Con tope diario (D-077), `perRound` hasta agotar `dailyRounds` rondas.
 * Sin tope (cursos intensivos, decisión del usuario 22-oct-2026): siempre `perRound`, salvo que la ronda anterior
 * bajara del 80 % de aciertos; entonces esa ronda es de repaso (0 nuevas) y la siguiente vuelve a traer nuevas.
 */
export function flowNewUnits({ perRound, newToday, dailyRounds, lastRound }: FlowNewInput): number {
  if (dailyRounds !== null) return Math.max(0, Math.min(perRound, perRound * dailyRounds - newToday));
  if (lastRound && lastRound.answered >= FLOW_NEW_MIN_ANSWERS && lastRound.correct / lastRound.answered < FLOW_NEW_IF) return 0;
  return perRound;
}

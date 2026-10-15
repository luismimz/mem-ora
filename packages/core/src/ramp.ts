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

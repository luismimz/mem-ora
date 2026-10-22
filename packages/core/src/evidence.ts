// Evidencia ponderada de un intento (tabla de CLAUDE.md) y definición de «éxito diferido».
import type { CoreConfig } from './config';
import { EXERCISE_FORMATS, type Attempt, type ExerciseFormat } from './types';

export class InvalidAttemptError extends Error {
  constructor(readonly problems: string[]) {
    super(`Intento inválido: ${problems.join(', ')}`);
    this.name = 'InvalidAttemptError';
  }
}

/** Devuelve los problemas de un intento; vacío si es válido. */
export function validateAttempt(attempt: Attempt): string[] {
  const problems: string[] = [];
  if (!attempt.id) problems.push('id vacío');
  if (!attempt.userId) problems.push('userId vacío');
  if (!attempt.skillId) problems.push('skillId vacío');
  if (!attempt.unitId) problems.push('unitId vacío');
  if (!Number.isFinite(attempt.at)) problems.push('at no es un instante');
  if (!(EXERCISE_FORMATS as readonly string[]).includes(attempt.format)) problems.push(`formato desconocido: ${attempt.format}`);
  if (!Number.isInteger(attempt.hint) || attempt.hint < 0 || attempt.hint > 5) problems.push('pista fuera de P0–P5');
  if (!Number.isFinite(attempt.timeMs) || attempt.timeMs < 0) problems.push('timeMs inválido');
  if (attempt.format === 'recall_unaided' && attempt.hint !== 0) problems.push('recall_unaided no admite pista');
  // Volver a oír el audio no es una pista; una pista en escucha es, por ejemplo, ver la primera letra o el texto parcial.
  if (attempt.format === 'recall_cued' && attempt.hint === 0) problems.push('recall_cued exige pista');
  if (attempt.hint === 5 && attempt.correct) problems.push('P5 revela la respuesta: no puede ser acierto');
  return problems;
}

export function assertValidAttempt(attempt: Attempt): void {
  const problems = validateAttempt(attempt);
  if (problems.length) throw new InvalidAttemptError(problems);
}

export function isRetrievalFormat(format: ExerciseFormat, config: CoreConfig): boolean {
  return config.evidence.retrievalFormats.includes(format);
}

/** Acierto «dudado»: correcto pero más lento que el umbral, o marcado «No estoy seguro» por el alumno. */
export function isHesitant(attempt: Pick<Attempt, 'correct' | 'timeMs' | 'doubt'>, config: CoreConfig): boolean {
  return attempt.correct && (Boolean(attempt.doubt) || attempt.timeMs > config.evidence.slowMs);
}

/** Peso del intento como evidencia (0–1): formato × pista × dudado. Un fallo no aporta peso. */
export function evidenceWeight(attempt: Pick<Attempt, 'format' | 'hint' | 'correct' | 'timeMs' | 'doubt'>, config: CoreConfig): number {
  if (!attempt.correct || attempt.hint === 5) return 0;
  const base = config.evidence.formatWeight[attempt.format];
  const hint = config.evidence.hintFactor[attempt.hint] ?? 0;
  const slow = attempt.doubt ? config.evidence.doubtFactor : isHesitant(attempt, config) ? config.evidence.slowFactor : 1;
  return base * hint * slow;
}

/**
 * Acierto sin pista (≤ `deferred.maxHint`), en formato de recuperación o producción (`deferred.formats`,
 * nunca reconocimiento) y tras al menos `minElapsedMs` desde la última exposición.
 */
export function isUnaidedSuccessAfter(
  attempt: Pick<Attempt, 'at' | 'format' | 'hint' | 'correct' | 'doubt'>,
  lastExposureAt: number | null,
  minElapsedMs: number,
  config: CoreConfig,
): boolean {
  // Un acierto con «No estoy seguro» no demuestra que se sepa sin ayuda.
  if (!attempt.correct || attempt.doubt || lastExposureAt === null) return false;
  if (attempt.hint > config.deferred.maxHint) return false;
  if (!config.deferred.formats.includes(attempt.format)) return false;
  return attempt.at - lastExposureAt >= minElapsedMs;
}

/** Éxito diferido: acierto sin pista en recuperación o producción tras `deferred.minElapsedMs` (20 h). */
export function isDeferredSuccess(
  attempt: Pick<Attempt, 'at' | 'format' | 'hint' | 'correct' | 'doubt'>,
  lastExposureAt: number | null,
  config: CoreConfig,
): boolean {
  return isUnaidedSuccessAfter(attempt, lastExposureAt, config.deferred.minElapsedMs, config);
}

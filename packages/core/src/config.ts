// Todos los umbrales del núcleo. Son HIPÓTESIS a validar con uso real; el porqué de cada uno está en
// docs/NUCLEO-UMBRALES.md. Cambiar un valor aquí no requiere tocar la lógica.
import { DAY, HOUR } from './time';
import type { ExerciseFormat, HintLevel, SkillKind, SkillStatus } from './types';

export interface CoreConfig {
  evidence: {
    /** Peso de un acierto según su formato (bajo 0,2 · medio 0,5 · alto 0,75 · muy alto 1). */
    formatWeight: Record<ExerciseFormat, number>;
    /** Multiplicador por nivel de pista P0–P5. P5 siempre 0. */
    hintFactor: [number, number, number, number, number, number];
    /** Un acierto más lento que esto cuenta como «dudado». */
    slowMs: number;
    /** Multiplicador del peso de un acierto dudado. */
    slowFactor: number;
    /** Formatos que cuentan como recuperación (no reconocimiento). */
    retrievalFormats: ExerciseFormat[];
  };
  /** Definición de «éxito diferido». */
  deferred: {
    /** Tiempo mínimo desde la última exposición. */
    minElapsedMs: number;
    /** Formatos admitidos: recuperación o producción, nunca reconocimiento. */
    formats: ExerciseFormat[];
    /** Pista máxima permitida (0 = sin pista). */
    maxHint: HintLevel;
  };
  /**
   * Niveles por encima de «aprendida». Exigen un acierto sin pista (`deferred.maxHint`) en un formato de
   * `deferred.formats` tras al menos `minElapsedMs` desde la última exposición a la habilidad.
   */
  levels: {
    stable: { minElapsedMs: number };
    mastered: { minElapsedMs: number };
  };
  /**
   * Formatos que admite cada tipo de habilidad. Una habilidad solo puede consolidar si su tipo admite algún formato
   * de `deferred.formats`; si no (reconocimiento puro), nunca pasa de «en aprendizaje».
   */
  skillFormats: Record<SkillKind, ExerciseFormat[]>;
  /** Nivel de una unidad, derivado de sus habilidades. */
  unitLevels: {
    /** Formatos distintos con éxito diferido que exige «dominada» (o todos los que admita la unidad, si son menos). */
    masteredMinFormats: number;
    /** Contextos distintos con éxito diferido que exige «dominada». */
    masteredMinContexts: number;
    /** Contextos que se recuerdan por habilidad. */
    contextsLimit: number;
  };
  skill: {
    /** Evidencia acumulada para pasar de «en aprendizaje» a «en consolidación». */
    consolidatingEvidence: number;
    /** Evidencia que resta un fallo en formato de recuperación. */
    failEvidencePenalty: number;
    /** Éxitos diferidos necesarios para «aprendida». */
    deferredSuccessesToLearn: number;
    /** Fallos seguidos en recuperación que debilitan una habilidad en consolidación (lo aprendido se debilita con uno). */
    failuresToWeakenConsolidating: number;
    /** Suavizado de la precisión reciente (media móvil exponencial). */
    accuracyAlpha: number;
    /** Precisión inicial supuesta. */
    initialAccuracy: number;
  };
  scheduler: {
    /** Intervalo de cada escalón de la habilidad. */
    stepsMs: number[];
    /** Espera tras un fallo. */
    retryDelayMs: number;
    /** Peso mínimo de un acierto de recuperación para subir de escalón sin límite. */
    advanceMinWeight: number;
    /** Escalón máximo al que puede llevar un acierto débil (reconocimiento o con mucha pista). */
    weakSuccessMaxStep: number;
    /** Escalones que baja un fallo. */
    failStepDrop: number;
    /** Rango del factor de facilidad derivado de la precisión reciente. */
    easeMin: number;
    easeMax: number;
  };
  association: {
    /** Calendario de recuperación de la asociación: +1 d, +3 d, +7 d, +14 d, +30 d. */
    stepsMs: number[];
    /** Escalones que baja un fallo. */
    failStepDrop: number;
    /** Pista máxima que se recomienda (P5 es revelar, no una pista). */
    maxRecommendedHint: HintLevel;
    /** Fallos seguidos que activan la revisión. */
    failuresToReview: number;
    /** Éxitos diferidos sin pista seguidos para decir «se está quedando». */
    holdingStreak: number;
    /** Recuperaciones mínimas para emitir un diagnóstico. */
    minRetrievals: number;
    /** Ventana de recuperaciones recientes para la tasa de fallos. */
    losingWindow: number;
    /** Tasa de fallos en la ventana que significa «se está perdiendo» y activa revisión. */
    losingFailureRate: number;
    /** Nivel de pista recomendado que ya significa «se está perdiendo». */
    losingHintLevel: HintLevel;
    /** Escalón a partir del cual un fallo indica pérdida y no solo falta de práctica. */
    establishedStep: number;
    /** Recuperaciones que se guardan en el historial. */
    historyLimit: number;
  };
  prerequisites: {
    /** Estado mínimo de lo requerido para desbloquear. */
    minStatus: SkillStatus;
  };
  load: {
    /** Origen y duración del día (permite la zona horaria del alumno). */
    dayOriginMs: number;
    dayLengthMs: number;
    /** Habilidades nuevas por día. */
    newCap: number;
    /** Repasos por día. */
    reviewCap: number;
    /** Total de elementos por día. */
    totalCap: number;
    /** Días anteriores usados para adaptar la carga. */
    adaptWindowDays: number;
    /** Intentos mínimos en la ventana para adaptar. */
    adaptMinAttempts: number;
    /** Por debajo de esta precisión se reduce lo nuevo a la mitad. */
    lowAccuracy: number;
    /** Por debajo de esta precisión no se introduce nada nuevo. */
    veryLowAccuracy: number;
    /** Habilidades nuevas que entran cada día pase lo que pase (con atasco de repasos o mala racha). */
    minNewPerDay: number;
    /** Repasos vencidos que quedan fuera del día a partir de los cuales solo entra el mínimo de lo nuevo. */
    backlogSuppressNew: number;
    /** Tope del retraso relativo al priorizar (evita que lo muy antiguo lo acapare todo). */
    overdueCapRatio: number;
    /** Prioridad extra de una habilidad debilitada. */
    weakenedBonus: number;
    /** Prioridad extra si su asociación se está perdiendo o está en revisión. */
    associationLosingBonus: number;
  };
}

export const defaultConfig: CoreConfig = {
  evidence: {
    formatWeight: {
      recognition_choice: 0.2,
      recognition_listening: 0.5,
      listening_transcribe: 0.75,
      listening_explain: 0.75,
      recall_cued: 0.5,
      recall_unaided: 0.75,
      production: 1,
      application: 1,
    },
    hintFactor: [1, 0.8, 0.6, 0.4, 0.2, 0],
    slowMs: 9_000,
    slowFactor: 0.7,
    retrievalFormats: ['listening_transcribe', 'listening_explain', 'recall_cued', 'recall_unaided', 'production', 'application'],
  },
  deferred: {
    minElapsedMs: 20 * HOUR,
    formats: ['listening_transcribe', 'listening_explain', 'recall_unaided', 'production', 'application'],
    maxHint: 0,
  },
  levels: {
    stable: { minElapsedMs: 7 * DAY },
    mastered: { minElapsedMs: 30 * DAY },
  },
  skillFormats: {
    recognize: ['recognition_choice'],
    listen: ['recognition_listening', 'listening_transcribe', 'listening_explain'],
    recall: ['recall_cued', 'recall_unaided'],
    produce: ['production'],
    apply: ['application'],
    speak: ['production'],
  },
  unitLevels: {
    masteredMinFormats: 3,
    masteredMinContexts: 2,
    contextsLimit: 10,
  },
  skill: {
    consolidatingEvidence: 1.5,
    failEvidencePenalty: 0.5,
    deferredSuccessesToLearn: 2,
    failuresToWeakenConsolidating: 2,
    accuracyAlpha: 0.3,
    initialAccuracy: 0.6,
  },
  scheduler: {
    stepsMs: [1 * HOUR, 3 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY],
    retryDelayMs: 4 * HOUR,
    advanceMinWeight: 0.5,
    weakSuccessMaxStep: 3,
    failStepDrop: 1,
    easeMin: 0.8,
    easeMax: 1.2,
  },
  association: {
    stepsMs: [1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY],
    failStepDrop: 2,
    maxRecommendedHint: 4,
    failuresToReview: 2,
    holdingStreak: 2,
    minRetrievals: 2,
    losingWindow: 5,
    losingFailureRate: 0.5,
    losingHintLevel: 3,
    establishedStep: 2,
    historyLimit: 10,
  },
  prerequisites: {
    minStatus: 'consolidating',
  },
  load: {
    dayOriginMs: 0,
    dayLengthMs: DAY,
    newCap: 8,
    reviewCap: 30,
    totalCap: 36,
    adaptWindowDays: 3,
    adaptMinAttempts: 10,
    lowAccuracy: 0.65,
    veryLowAccuracy: 0.45,
    minNewPerDay: 3,
    backlogSuppressNew: 10,
    overdueCapRatio: 3,
    weakenedBonus: 1,
    associationLosingBonus: 0.5,
  },
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) out[key] = merge((base as Record<string, unknown>)[key], value);
  return out as T;
}

/** Configuración por defecto con los cambios indicados (las listas se sustituyen enteras). */
export function resolveConfig(patch: DeepPartial<CoreConfig> = {}): CoreConfig {
  return merge(defaultConfig, patch);
}

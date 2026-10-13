// Tipos del dominio. Agnósticos de la materia: ningún campo sabe de qué trata la unidad.

export type Id = string;

/** Formatos de ejercicio según la tabla de evidencia de CLAUDE.md. */
export const EXERCISE_FORMATS = [
  'recognition_choice', // elegir entre opciones
  'recognition_listening', // reconocer al escuchar
  'listening_transcribe', // escuchar y reproducir lo oído por escrito (dictado)
  'listening_explain', // escuchar y expresar el sentido con palabras propias (traducción libre, explicación)
  'recall_cued', // recuperar con pistas
  'recall_unaided', // recuperar escribiendo o diciendo, sin pistas
  'production', // producir (frase, comando, código)
  'application', // aplicar en un caso o conversación
] as const;
export type ExerciseFormat = (typeof EXERCISE_FORMATS)[number];

/**
 * Escalera de pistas P0–P5.
 * P0 sin pista · P1 pista mínima · P2 contexto · P3 la ayuda de memoria · P4 escena o ejemplo completo ·
 * P5 respuesta revelada (nunca cuenta como acierto).
 */
export type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const HINT_LEVELS: readonly HintLevel[] = [0, 1, 2, 3, 4, 5];

export const SKILL_KINDS = ['recognize', 'recall', 'produce', 'apply', 'listen', 'speak'] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

/**
 * Estados honestos (regla 11): «vista» (presented) no es «aprendida» (learned) y «aprendida» no es «dominada» (mastered).
 * new → presented → learning → consolidating → learned → stable → mastered; cualquier nivel aprendido puede pasar a weakened.
 */
export const SKILL_STATUSES = ['new', 'presented', 'learning', 'consolidating', 'learned', 'stable', 'mastered', 'weakened'] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

/** Intento con evidencia. Guarda formato, acierto, pista y tiempo; «dudar» se deriva del tiempo. */
export interface Attempt {
  id: Id;
  userId: Id;
  skillId: Id;
  unitId: Id;
  associationId?: Id;
  /** Situación concreta en la que se practicó (escena, frase, caso). Sirve para exigir variedad de contextos. */
  contextId?: Id;
  at: number;
  format: ExerciseFormat;
  correct: boolean;
  hint: HintLevel;
  timeMs: number;
}

/** Presentación de una habilidad (ver o escuchar el contenido). No es evidencia de aprendizaje. */
export interface Exposure {
  id: Id;
  userId: Id;
  skillId: Id;
  unitId: Id;
  associationId?: Id;
  at: number;
}

export interface UnitDef {
  id: Id;
  courseId: Id;
  /** Tipo de conocimiento (term, concept, command…). El núcleo no lo interpreta. */
  type: string;
}

export interface SkillDef {
  id: Id;
  unitId: Id;
  kind: SkillKind;
  /** Asociación que esta habilidad recupera, si la hay. */
  associationId?: Id;
}

export type Ref = { unit: Id } | { skill: Id };

/** `subject` no se puede practicar hasta que `requires` esté preparado. */
export interface Prerequisite {
  subject: Ref;
  requires: Ref;
}

/** Catálogo de un curso. El orden de `skills` es el orden de introducción. */
export interface Catalog {
  units: UnitDef[];
  skills: SkillDef[];
  prerequisites: Prerequisite[];
}

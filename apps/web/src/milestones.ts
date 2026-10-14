// Hitos de la espiral que el alumno debe ver (D-038): truco de gramática cada 15 palabras, Arcade sorpresa desde 20
// y chat tras 3 sesiones de gramática. Se calculan con el progreso del servidor.
import type { Progress } from './api';

export const GRAMMAR_EVERY = 15;
export const ARCADE_FROM = 20;
export const CHAT_AFTER_GRAMMAR = 3;

export interface Milestones {
  words: number;
  total: number;
  grammarNext: number;
  arcadeLeft: number;
  grammarSessions: number;
}

/** Palabras trabajadas = unidades con alguna habilidad ya practicada (no solo vista). */
export function milestones(p: Progress): Milestones {
  const units = new Set(p.skills.map((s) => s.unit));
  const worked = new Set(p.skills.filter((s) => !['new', 'presented'].includes(s.status)).map((s) => s.unit));
  const words = worked.size;
  return {
    words,
    total: units.size,
    grammarNext: GRAMMAR_EVERY - (words % GRAMMAR_EVERY),
    arcadeLeft: Math.max(0, ARCADE_FROM - words),
    grammarSessions: 0, // el modo Gramática aún no existe: llegará en el siguiente paso
  };
}

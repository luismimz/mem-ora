// Simulacro de examen (idea de benrios.dev, 22-oct-2026): 30 preguntas de TODOS los temas del curso, 60 minutos, sin
// ayudas hasta el final y se aprueba con un 7. Solo mide: las respuestas cuentan como reconocimiento (peso bajo, regla
// 9), así que nunca suben de nivel; los fallos entran en «Vacía tus fallos». Agnóstico de la materia: usa los ejercicios
// con opciones que ya tienen las unidades.
import { exercisesOf, seeded, shuffle } from './associations';
import type { SessionUnit } from './session';

export const EXAM_SIZE = 30;
export const EXAM_MINUTES = 60;
export const EXAM_PASS = 7;
/** Por debajo de esto no hay simulacro: sería un test de pocas preguntas, no un examen. */
export const EXAM_MIN_QUESTIONS = 10;

export interface ExamQuestion {
  id: string;
  unitKey: string;
  skillKey: string;
  exercise: number;
  /** La respuesta y sus opciones falsas (como mucho 4), barajadas. */
  options: string[];
}

/** Ejercicios de una unidad que valen para el examen: tienen respuesta y al menos una opción falsa. */
export function examExercises(u: SessionUnit): number[] {
  return exercisesOf(u).map((e, i) => ({ e, i })).filter(({ e }) => e.kind !== 'order_steps' && Boolean(e.answer) && (e.distractors?.length ?? 0) > 0).map(({ i }) => i);
}

const examSkill = (u: SessionUnit) => (u.skills.find((s) => s.kind === 'apply') ?? u.skills.find((s) => s.kind === 'recall'))?.key;

/**
 * Elige las preguntas repartidas entre todas las misiones (una vuelta por misión cada vez), una por unidad, y las baraja.
 * Mismo `examId` → mismo examen (se puede retomar).
 */
export function buildExam(input: { examId: string; units: Record<string, SessionUnit>; missions: Array<{ key: string; units: string[] }>; size?: number }): ExamQuestion[] {
  const rand = seeded(input.examId);
  const size = input.size ?? EXAM_SIZE;
  const pools = input.missions
    .map((m) => shuffle(m.units.filter((k) => input.units[k] && examExercises(input.units[k]!).length && examSkill(input.units[k]!)), rand))
    .filter((p) => p.length);
  const chosen: string[] = [];
  while (chosen.length < size && pools.some((p) => p.length)) {
    for (const p of pools) if (p.length && chosen.length < size) chosen.push(p.shift()!);
  }
  return shuffle(chosen, rand).map((k, n) => {
    const u = input.units[k]!;
    const options = examExercises(u);
    const exercise = options[Math.floor(rand() * options.length)]!;
    const ex = exercisesOf(u)[exercise]!;
    return { id: `${input.examId}-${n}`, unitKey: k, skillKey: examSkill(u)!, exercise, options: shuffle([ex.answer!, ...(ex.distractors ?? []).slice(0, 3)], rand) };
  });
}

/** ¿Es correcta la opción elegida? */
export function examCorrect(q: ExamQuestion, units: Record<string, SessionUnit>, picked: string | null): boolean {
  return picked !== null && picked === exercisesOf(units[q.unitKey]!)[q.exercise]?.answer;
}

/** Nota sobre 10 con un decimal. */
export function examGrade(correct: number, total: number): number {
  return total ? Math.round((correct / total) * 100) / 10 : 0;
}

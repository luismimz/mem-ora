// Modo Asociaciones (D-038): las historias absurdas en el centro. Sesión = repasos vencidos + escenas de 5 unidades
// nuevas + cierre con rescate inverso. Sin teclear en la primera exposición; teclear solo en los repasos, con pistas.
// Agnóstico de la materia: funciona con palabras de un idioma o con conceptos de Java.
import type { ExerciseFormat, HintLevel, PlanItem } from '@memora/core';
import type { ConceptExercise, ConceptPayload, MemoryChallengePayload, PatternPayload, TermPayload } from '@memora/content';
import { firstLetterHint, sameAnswer } from './answers';
import type { SessionUnit } from './session';

export type AssocStepKind = 'review' | 'check' | 'cue' | 'card' | 'recall' | 'story' | 'sceneResult' | 'arcade' | 'rescue' | 'challenge' | 'summary';

export interface AssocStep {
  id: string;
  kind: AssocStepKind;
  unitKey: string;
  /** Escena (0, 1, 2…) a la que pertenece el paso. */
  scene: number;
  /** Repasos: habilidad y pista inicial (escalera de la asociación). */
  skillKey?: string;
  startHint?: HintLevel;
  /** Arcade sorpresa: unidades que entran en la ronda. */
  arcadeUnits?: string[];
  /** Reto de aplicación (conceptos con ejercicios): qué ejercicio y si se responde escribiendo (repaso) o con opciones. */
  exercise?: number;
  typed?: boolean;
  /** Repesca (D-064): solo se hace si el alumno falló esa unidad antes en la sesión; si no, se salta. */
  retry?: boolean;
}

export interface AssocPlan {
  mode: 'associations';
  sessionId: string;
  courseId: string;
  day: number;
  createdAt: number;
  steps: AssocStep[];
  /** Escenas de la sesión, con las unidades de cada una. */
  scenes: string[][];
}

export const SCENE_SIZE = 5;
/** A partir de cuántas unidades aprendidas puede saltar un Arcade sorpresa. */
export const ARCADE_MIN_KNOWN = 20;

/** Número pseudoaleatorio estable a partir de un texto (misma sesión ⇒ mismo resultado al reanudar). */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return h / 4294967296;
  };
}

export function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function buildAssociationSession(input: {
  sessionId: string;
  courseId: string;
  day: number;
  createdAt: number;
  items: PlanItem[];
  units: Record<string, SessionUnit>;
  /** Unidades que el alumno ya ha trabajado antes de esta sesión (para el Arcade sorpresa). */
  knownUnits: string[];
  sceneSize?: number;
  /** Unidades nuevas como máximo en esta sesión (el ritmo del curso). */
  maxNewUnits?: number;
  /** Unidades cuyo contenido cambió desde que el alumno las vio: se vuelven a enseñar antes de repasarlas (D-062). */
  refreshUnits?: string[];
  /**
   * Ayuda de la comprobación selectiva en los repasos, por unidad (D-063): 0 = asociación completa, 1 = solo la imagen,
   * 2 = solo el significado, 3 o más = sin comprobación (recuperación directa). Sin dato, 0.
   */
  reviewHelp?: Record<string, number>;
}): AssocPlan {
  const { items, units, sessionId } = input;
  const size = input.sceneSize ?? SCENE_SIZE;
  const rand = seeded(sessionId);
  const steps: AssocStep[] = [];
  const add = (s: Omit<AssocStep, 'id'>) => steps.push({ ...s, id: `${steps.length + 1}-${s.kind}-${s.unitKey || 'x'}` });

  // 1. Repasos vencidos: uno por habilidad de recuperación (escuchar se repasa al oír la tarjeta; producir, en Gramática).
  //    Los conceptos con ejercicios repasan también «aplicar» con un reto sin opciones.
  // Agrupados por unidad, en el orden de prioridad: [ficha si cambió] → comprobación → escribir → reto (D-062, D-063).
  const refresh = new Set(input.refreshUnits ?? []);
  const reviewed: string[] = [];
  const byUnit = new Map<string, PlanItem[]>();
  for (const item of items.filter((i) => i.reason === 'review')) {
    if (!units[item.unitId]) continue;
    byUnit.set(item.unitId, [...(byUnit.get(item.unitId) ?? []), item]);
  }
  for (const [key, list] of byUnit) {
    const unit = units[key]!;
    const kinds = new Map(list.map((i) => [i.skillId, unit.skills.find((s) => s.key === i.skillId)?.kind]));
    const recall = list.find((i) => kinds.get(i.skillId) === 'recall');
    const apply = list.find((i) => kinds.get(i.skillId) === 'apply' && exercisesOf(unit).length);
    if (!recall && !apply) continue; // escuchar se repasa al oír la tarjeta; producir, en Gramática.
    const writes = unit.type === 'term'; // D-064: se escribe solo en idiomas; el resto se responde eligiendo.
    // Enseñar antes de evaluar (D-065): todo repaso empieza por su asociación; «renovada» si la ficha cambió.
    add({ kind: 'card', unitKey: key, scene: refresh.has(key) ? -1 : -3 });
    // Pista e intento: elegir con una pista de la mnemotecnia que se retira repaso a repaso (D-063).
    const help = Math.max(0, Math.min(3, input.reviewHelp?.[key] ?? 0));
    if (help < 3 || !writes) add({ kind: 'check', unitKey: key, scene: -1, startHint: help as HintLevel });
    if (recall && writes) add({ kind: 'review', unitKey: key, scene: -1, skillKey: recall.skillId, startHint: recall.recommendedHint });
    if (apply) add({ kind: 'challenge', unitKey: key, scene: -1, skillKey: apply.skillId, exercise: Math.floor(rand() * exercisesOf(unit).length), typed: writes });
    reviewed.push(key);
  }

  // 2. Escenas de 5 unidades nuevas.
  const fresh = [...new Set(items.filter((i) => i.reason === 'new').map((i) => i.unitId))].filter((k) => units[k]).slice(0, input.maxNewUnits ?? Infinity);
  const scenes: string[][] = [];
  for (let i = 0; i < fresh.length; i += size) scenes.push(fresh.slice(i, i + size));
  const known = new Set(input.knownUnits);
  scenes.forEach((scene, n) => {
    // D-064: 1) las asociaciones; 2) ¿qué clave te recuerda cada una?; 3) la historia → elegir de qué habla.
    for (const u of scene) add({ kind: 'card', unitKey: u, scene: n });
    const withCue = scene.filter((u) => units[u]!.association?.cue);
    if (withCue.length >= 2) for (const u of shuffle(withCue, rand)) add({ kind: 'cue', unitKey: u, scene: n });
    for (const u of shuffle(scene, rand)) add({ kind: 'rescue', unitKey: u, scene: n });
    add({ kind: 'sceneResult', unitKey: '', scene: n });
    for (const u of scene) known.add(u);
    // Arcade sorpresa: al azar, con 20 o más unidades ya trabajadas, y nunca tras la última escena.
    if (known.size >= ARCADE_MIN_KNOWN && n < scenes.length - 1 && rand() < 0.5) {
      const pool = shuffle([...known].filter((k) => units[k]), rand).slice(0, 6);
      if (pool.length >= 3) add({ kind: 'arcade', unitKey: '', scene: n, arcadeUnits: pool });
    }
  });

  // 3. La pregunta: retos con opciones de lo nuevo (el primer día nunca se teclea).
  for (const u of fresh) {
    const unit = units[u]!;
    const apply = unit.skills.find((s) => s.kind === 'apply');
    if (apply && exercisesOf(unit).length) add({ kind: 'challenge', unitKey: u, scene: scenes.length, skillKey: apply.key, exercise: Math.floor(rand() * exercisesOf(unit).length), typed: false });
  }
  // 4. Solo en idiomas: escribir la palabra al final, con pistas si hacen falta.
  for (const u of shuffle(fresh, rand)) {
    const unit = units[u]!;
    const recall = unit.skills.find((s) => s.kind === 'recall');
    if (recall && unit.type === 'term') add({ kind: 'review', unitKey: u, scene: scenes.length, skillKey: recall.key, startHint: 0 });
  }
  // 5. Repesca: lo fallado hoy se vuelve a enseñar y se comprueba otra vez (se salta si no hubo fallo).
  for (const u of [...reviewed, ...fresh]) {
    add({ kind: 'card', unitKey: u, scene: -2, retry: true });
    add({ kind: 'check', unitKey: u, scene: -2, startHint: 0, retry: true });
  }
  if (steps.length) add({ kind: 'summary', unitKey: '', scene: scenes.length });
  return { mode: 'associations', sessionId, courseId: input.courseId, day: input.day, createdAt: input.createdAt, steps, scenes };
}

// ─── Lo que se muestra en cada paso ─────────────────────────────────────────────────────────────────────

/** Texto principal de la unidad: la palabra (term), el nombre (concepto) o la pieza fija (patrón). */
export function unitText(u: SessionUnit): string {
  if (u.type === 'memory_challenge') return (u.payload as MemoryChallengePayload).title;
  if (u.type === 'concept') return (u.payload as ConceptPayload).name;
  return u.type === 'term' ? (u.payload as TermPayload).text : (u.payload as PatternPayload).pieces.filter((p) => p.role === 'fixed').map((p) => p.text).join(' ');
}
/** Lo que significa, en corto: el significado (term), la idea clave (concepto) o la meta (patrón). */
export function unitMeaning(u: SessionUnit): string {
  if (u.type === 'memory_challenge') return 'reto de memoria';
  if (u.type === 'concept') return (u.payload as ConceptPayload).gist;
  return u.type === 'term' ? (u.payload as TermPayload).meaning : (u.payload as PatternPayload).goal;
}
export function unitExample(u: SessionUnit): { text: string; translation?: string; explanation?: string } | undefined {
  return 'examples' in u.payload ? u.payload.examples[0] : undefined;
}
/** Respuestas que se dan por buenas al recordar la unidad (el nombre y, en conceptos, sus alternativas). */
export function acceptedAnswers(u: SessionUnit): string[] {
  return [unitText(u), ...(u.type === 'concept' ? ((u.payload as ConceptPayload).answers ?? []) : [])];
}

export interface Choice {
  label: string;
  correct: boolean;
}

/** Opciones con la correcta y distractores tomados SOLO de unidades ya enseñadas (principio 1). */
export function choicesFor(correct: string, taught: string[], seed: string, count = 3): Choice[] {
  const rand = seeded(seed);
  const others = shuffle([...new Set(taught.filter((t) => t.toLowerCase() !== correct.toLowerCase()))], rand).slice(0, count - 1);
  return shuffle([{ label: correct, correct: true }, ...others.map((label) => ({ label, correct: false }))], rand);
}

/**
 * «Completa la historia»: la escena con el SIGNIFICADO oculto (D-038). El puente es solo el sonido; la historia lleva al
 * significado y de ahí a la palabra. Si la escena no contiene el significado tal cual, se pregunta por el significado.
 */
export function storyGap(u: SessionUnit): { text: string; answer: string } {
  const meaning = unitMeaning(u);
  const scene = u.association?.text ?? '';
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Una palabra con contenido: nunca «la», «el», «sin»… (el hueco debe ser algo que se aprende).
  const word = (x: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(x)}(?![\\p{L}\\p{N}])`, 'iu');
  const content = meaning.split(/[\s,.;:()«»"¿?¡!]+/).filter((w) => [...w].length >= 4);
  // 1) el significado entero, 2) su primera palabra con contenido que esté en la historia,
  // 3) la pieza clave en MAYÚSCULAS (mejor si no es el puente), 4) sin hueco posible: el significado.
  const caps = [...scene.matchAll(/(?<![\p{L}])\p{Lu}{3,}(?![\p{L}])/gu)].map((m) => m[0]);
  const cue = u.association?.cue?.toUpperCase();
  const pieces = [meaning, ...content, ...caps.filter((c) => c !== cue), ...caps];
  for (const piece of pieces) {
    if (!piece) continue;
    const re = word(piece);
    const m = scene.match(re);
    if (m) return { text: scene.replace(re, '______'), answer: m[0].toUpperCase() };
  }
  return { text: scene || meaning, answer: meaning.toUpperCase() };
}

/** Pistas del repaso tecleado: primera letra → pronunciación figurada → puente → escena (P1–P4). */
export function reviewHints(u: SessionUnit): string[] {
  const text = unitText(u);
  const respelling = u.type === 'term' ? (u.payload as TermPayload).pronunciation?.respelling : undefined;
  return [firstLetterHint(text), respelling ? `Suena ≈ ${respelling}` : firstLetterHint(text), u.association?.cue ? `Suena a ${u.association.cue}` : unitMeaning(u), u.association?.text ?? unitExample(u)?.text ?? ''];
}

export interface AssocOutcome {
  correct: boolean;
  format: ExerciseFormat;
  hint: HintLevel;
}

/** Corrige un repaso tecleado. */
export function gradeReview(u: SessionUnit, answer: string, startHint: HintLevel, hintUsed: HintLevel, revealed: boolean): AssocOutcome {
  const hint = (revealed ? 5 : Math.max(startHint, hintUsed)) as HintLevel;
  return { correct: hint < 5 && acceptedAnswers(u).some((a) => sameAnswer(answer, a)), format: hint > 0 ? 'recall_cued' : 'recall_unaided', hint };
}

// ─── Retos de aplicación (conceptos con ejercicios) ─────────────────────────────────────────────────────────

export function exercisesOf(u: SessionUnit): ConceptExercise[] {
  return u.type === 'concept' ? ((u.payload as ConceptPayload).exercises ?? []) : [];
}

/** Opciones del reto (primer día): la respuesta y sus opciones falsas, en orden estable. */
export function challengeChoices(ex: ConceptExercise, seed: string): Choice[] {
  if (!ex.answer) return [];
  return shuffle([{ label: ex.answer, correct: true }, ...(ex.distractors ?? []).map((label) => ({ label, correct: false }))], seeded(seed));
}

/** Pasos desordenados para «ordenar pasos» (nunca en el orden correcto si se puede evitar). */
export function shuffledSteps(ex: ConceptExercise, seed: string): string[] {
  const steps = ex.steps ?? [];
  let out = shuffle(steps, seeded(seed));
  if (steps.length > 1 && out.every((s, i) => s === steps[i])) out = [...out.slice(1), out[0]!];
  return out;
}

/**
 * Corrige un reto. El primer día (opciones u ordenar) es reconocimiento, peso bajo; en el repaso, escrito u ordenado sin
 * ayuda, es aplicación, peso muy alto.
 * El código se compara sin tener en cuenta espacios de más ni mayúsculas.
 */
export function gradeChallenge(ex: ConceptExercise, answer: string | string[], typed: boolean, revealed = false): AssocOutcome {
  const format: ExerciseFormat = typed ? 'application' : 'recognition_choice';
  if (revealed) return { correct: false, format, hint: 5 };
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
  const correct = Array.isArray(answer)
    ? answer.length === (ex.steps ?? []).length && answer.every((s, i) => s === ex.steps![i])
    : [ex.answer ?? '', ...(ex.accepted ?? [])].some((a) => a && sameAnswer(norm(answer), norm(a)));
  return { correct, format, hint: 0 };
}

// ─── Retos de memoria (D-056) ────────────────────────────────────────────────────────────────────────────

const plain = (t: string) => t.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export interface RecallScore {
  /** Palabras de la lista que ha recordado (en cualquier orden). */
  remembered: number;
  /** Cuántas seguidas desde la primera ha dicho en el orden exacto. */
  inOrder: number;
  /** Palabras falsas elegidas. */
  wrong: number;
  total: number;
}

/** Puntúa un intento: lo recordado en cualquier orden y la racha en orden exacto desde el principio. */
export function scoreRecall(words: string[], answer: string[], reverse = false): RecallScore {
  const target = (reverse ? [...words].reverse() : words).map(plain);
  const given = answer.map(plain);
  const set = new Set(target);
  let inOrder = 0;
  while (inOrder < given.length && given[inOrder] === target[inOrder]) inOrder++;
  return { remembered: new Set(given.filter((g) => set.has(g))).size, inOrder, wrong: given.filter((g) => !set.has(g)).length, total: words.length };
}

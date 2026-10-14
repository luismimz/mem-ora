// Modo Asociaciones (D-038): las historias absurdas en el centro. Sesión = repasos vencidos + escenas de 5 unidades
// nuevas + cierre con rescate inverso. Sin teclear en la primera exposición; teclear solo en los repasos, con pistas.
// Agnóstico de la materia: funciona con palabras de un idioma o con conceptos de Java.
import type { ExerciseFormat, HintLevel, PlanItem } from '@memora/core';
import type { Example, PatternPayload, TermPayload } from '@memora/content';
import { firstLetterHint, sameAnswer } from './answers';
import type { SessionUnit } from './session';

export type AssocStepKind = 'review' | 'card' | 'recall' | 'story' | 'sceneResult' | 'arcade' | 'rescue' | 'summary';

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
}): AssocPlan {
  const { items, units, sessionId } = input;
  const size = input.sceneSize ?? SCENE_SIZE;
  const rand = seeded(sessionId);
  const steps: AssocStep[] = [];
  const add = (s: Omit<AssocStep, 'id'>) => steps.push({ ...s, id: `${steps.length + 1}-${s.kind}-${s.unitKey || 'x'}` });

  // 1. Repasos vencidos: uno por habilidad de recuperación (escuchar se repasa al oír la tarjeta; producir, en Gramática).
  const seen = new Set<string>();
  for (const item of items.filter((i) => i.reason === 'review')) {
    const unit = units[item.unitId];
    const kind = unit?.skills.find((s) => s.key === item.skillId)?.kind;
    if (!unit || kind !== 'recall' || seen.has(item.skillId)) continue;
    seen.add(item.skillId);
    add({ kind: 'review', unitKey: unit.key, scene: -1, skillKey: item.skillId, startHint: item.recommendedHint });
  }

  // 2. Escenas de 5 unidades nuevas.
  const fresh = [...new Set(items.filter((i) => i.reason === 'new').map((i) => i.unitId))].filter((k) => units[k]).slice(0, input.maxNewUnits ?? Infinity);
  const scenes: string[][] = [];
  for (let i = 0; i < fresh.length; i += size) scenes.push(fresh.slice(i, i + size));
  const known = new Set(input.knownUnits);
  scenes.forEach((scene, n) => {
    for (const u of scene) add({ kind: 'card', unitKey: u, scene: n });
    for (const u of shuffle(scene, rand)) add({ kind: 'recall', unitKey: u, scene: n });
    for (const u of shuffle(scene, rand)) add({ kind: 'story', unitKey: u, scene: n });
    add({ kind: 'sceneResult', unitKey: '', scene: n });
    for (const u of scene) known.add(u);
    // Arcade sorpresa: al azar, con 20 o más unidades ya trabajadas, y nunca tras la última escena.
    if (known.size >= ARCADE_MIN_KNOWN && n < scenes.length - 1 && rand() < 0.5) {
      const pool = shuffle([...known].filter((k) => units[k]), rand).slice(0, 6);
      if (pool.length >= 3) add({ kind: 'arcade', unitKey: '', scene: n, arcadeUnits: pool });
    }
  });

  // 3. Cierre: rescate inverso (escena → unidad) mezclando todo lo de hoy.
  if (fresh.length) for (const u of shuffle(fresh, rand)) add({ kind: 'rescue', unitKey: u, scene: scenes.length });
  if (steps.length) add({ kind: 'summary', unitKey: '', scene: scenes.length });
  return { mode: 'associations', sessionId, courseId: input.courseId, day: input.day, createdAt: input.createdAt, steps, scenes };
}

// ─── Lo que se muestra en cada paso ─────────────────────────────────────────────────────────────────────

/** Texto principal de la unidad: la palabra (term) o la pieza fija (patrón). */
export function unitText(u: SessionUnit): string {
  return u.type === 'term' ? (u.payload as TermPayload).text : (u.payload as PatternPayload).pieces.filter((p) => p.role === 'fixed').map((p) => p.text).join(' ');
}
export function unitMeaning(u: SessionUnit): string {
  return u.type === 'term' ? (u.payload as TermPayload).meaning : (u.payload as PatternPayload).goal;
}
export function unitExample(u: SessionUnit): Example | undefined {
  return u.payload.examples[0];
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
  const pieces = [meaning, meaning.split(/\s+/)[0] ?? meaning];
  for (const piece of pieces) {
    const re = new RegExp(`\\b${piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const m = scene.match(re);
    if (piece && m) return { text: scene.replace(re, '______'), answer: m[0].toUpperCase() };
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
  return { correct: hint < 5 && sameAnswer(answer, unitText(u)), format: hint > 0 ? 'recall_cued' : 'recall_unaided', hint };
}

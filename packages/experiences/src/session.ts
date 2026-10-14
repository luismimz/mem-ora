// Sesión mínima (H2.2a): convierte el plan del día del núcleo en pasos, prepara cada ejercicio, lo corrige y produce
// los eventos (exposiciones e intentos) que recalcula el servidor. Sin IA y sin nada específico de una materia: usa
// los tipos de unidad (`term`, `pattern`) y sus campos. Las recetas en JSON llegarán en el H4.
import type { ExerciseFormat, HintLevel, PlanItem, SkillKind } from '@memora/core';
import type { ConceptPayload, Example, PatternPayload, TermPayload, UnitType } from '@memora/content';
import { checkOwnSentence, containsPhrase, firstLetterHint, normalizeAnswer, orderTiles, sameAnswer, type OwnSentenceProblem } from './answers';

export interface SessionSkill {
  key: string;
  kind: SkillKind;
  associationId?: string | null;
}

export interface SessionAssociation {
  id: string;
  technique: string;
  cue?: string | null;
  text: string;
  /** La misma escena en el idioma del contenido. */
  sceneTarget?: string | null;
  /** Ilustración provisional (emoji) mientras no haya imagen aprobada. */
  emoji?: string | null;
}

export interface SessionUnit {
  key: string;
  type: UnitType;
  /** Idioma del contenido (para la voz). */
  language: string;
  payload: TermPayload | PatternPayload | ConceptPayload;
  skills: SessionSkill[];
  association?: SessionAssociation | null;
  /** Versión publicada: sirve para invalidar la caché (H2.2b). */
  version: number;
  /** Lugar o módulo donde vive la unidad (por ejemplo, «Dormitorio»). */
  place?: string | null;
}

export type StepKind = 'listen' | 'associate' | 'structure' | 'recall' | 'order' | 'produce' | 'dictation' | 'result';

export interface SessionStep {
  id: string;
  kind: StepKind;
  unitKey: string;
  skillKey: string;
  reason: 'new' | 'review';
  /** Pista con la que empieza el ejercicio (la escalera de la asociación). */
  startHint: HintLevel;
  /** Primer paso de una habilidad nueva: antes del ejercicio se registra la exposición. */
  exposeFirst: boolean;
  associationId?: string;
}

export interface SessionPlan {
  sessionId: string;
  courseId: string;
  day: number;
  createdAt: number;
  steps: SessionStep[];
}

const REVIEW_STEP: Record<SkillKind, StepKind | null> = {
  listen: 'dictation',
  recall: 'recall',
  produce: 'produce',
  speak: 'produce',
  apply: 'produce',
  recognize: null, // reconocer puro: sin ejercicio en la sesión mínima (Arcade, H3)
};

/** Pasos de una habilidad nueva, en orden. */
function newSteps(kind: SkillKind, unit: SessionUnit): StepKind[] {
  if (kind === 'listen') return ['listen'];
  if (kind === 'recall') return [unit.type === 'pattern' ? 'structure' : 'associate', 'recall'];
  if (kind === 'produce' || kind === 'speak' || kind === 'apply') return ['order', 'produce'];
  return [];
}

const KIND_ORDER: SkillKind[] = ['listen', 'recall', 'produce', 'speak', 'apply', 'recognize'];

export function buildSession(input: { sessionId: string; courseId: string; day: number; createdAt: number; items: PlanItem[]; units: Record<string, SessionUnit> }): SessionPlan {
  const { items, units } = input;
  const steps: SessionStep[] = [];
  const push = (kind: StepKind, unit: SessionUnit, item: PlanItem, exposeFirst: boolean) => {
    steps.push({
      id: `${steps.length + 1}-${kind}-${item.skillId}`,
      kind,
      unitKey: unit.key,
      skillKey: item.skillId,
      reason: item.reason,
      startHint: kind === 'recall' && item.reason === 'review' ? item.recommendedHint : 0,
      exposeFirst,
      ...(item.associationId ? { associationId: item.associationId } : {}),
    });
  };
  const kindOf = (unit: SessionUnit, skillKey: string) => unit.skills.find((s) => s.key === skillKey)?.kind;

  // Primero los repasos (el plan ya los trae ordenados por prioridad).
  for (const item of items.filter((i) => i.reason === 'review')) {
    const unit = units[item.unitId];
    const kind = unit && kindOf(unit, item.skillId);
    const step = kind ? REVIEW_STEP[kind] : null;
    if (unit && step) push(step, unit, item, false);
  }
  // Después lo nuevo, agrupado por unidad y con sus habilidades en un orden natural.
  const newItems = items.filter((i) => i.reason === 'new');
  const unitOrder = [...new Set(newItems.map((i) => i.unitId))];
  for (const unitKey of unitOrder) {
    const unit = units[unitKey];
    if (!unit) continue;
    const mine = newItems
      .filter((i) => i.unitId === unitKey)
      .sort((a, b) => KIND_ORDER.indexOf(kindOf(unit, a.skillId) ?? 'recognize') - KIND_ORDER.indexOf(kindOf(unit, b.skillId) ?? 'recognize'));
    for (const item of mine) {
      const kind = kindOf(unit, item.skillId);
      if (!kind) continue;
      newSteps(kind, unit).forEach((s, i) => push(s, unit, item, i === 0));
    }
  }
  if (steps.length) steps.push({ id: `${steps.length + 1}-result`, kind: 'result', unitKey: '', skillKey: '', reason: 'new', startHint: 0, exposeFirst: false });
  return { sessionId: input.sessionId, courseId: input.courseId, day: input.day, createdAt: input.createdAt, steps };
}

// ─── Ejercicios ──────────────────────────────────────────────────────────────────────────────────────────

export type Exercise =
  | { kind: 'listen'; speak: string; language: string; text: string; meaning: string; example?: Example }
  | { kind: 'associate'; speak: string; language: string; text: string; meaning: string; association?: SessionAssociation; example?: Example }
  | { kind: 'structure'; goal: string; rule: string; pieces: PatternPayload['pieces']; examples: Example[]; pitfalls: string[] }
  | { kind: 'recall'; mode: 'meaning' | 'blank'; prompt: string; expected: string; hints: string[]; contextId: string }
  | { kind: 'order'; translation: string; tiles: string[]; answer: string[]; speak: string; language: string; contextId: string }
  | { kind: 'produce'; goal: string; required: string[]; examples: string[]; model: Example; contextId: string }
  | { kind: 'dictation'; speak: string; language: string; expected: string; contextId: string }
  | { kind: 'result' };

const isPattern = (u: SessionUnit): u is SessionUnit & { payload: PatternPayload } => u.type === 'pattern';
const isTerm = (u: SessionUnit): u is SessionUnit & { payload: TermPayload } => u.type === 'term';

/** Elige un ejemplo distinto según la sesión, para variar el contexto entre repasos. */
const pick = <T>(list: T[], seed: string): T => list[[...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length]!;

function fixedPieces(p: PatternPayload): string[] {
  return p.pieces.filter((x) => x.role === 'fixed').map((x) => x.text);
}

/** Prepara el ejercicio de un paso. `others` aporta distractores de otras unidades de la sesión. */
export function exerciseFor(step: SessionStep, unit: SessionUnit | undefined, others: SessionUnit[], sessionId: string): Exercise {
  if (step.kind === 'result' || !unit) return { kind: 'result' };
  const seed = `${sessionId}:${step.id}`;
  if (isTerm(unit)) {
    const p = unit.payload;
    const example = pick(p.examples, seed);
    const exampleIndex = p.examples.indexOf(example);
    switch (step.kind) {
      case 'listen':
        return { kind: 'listen', speak: p.text, language: unit.language, text: p.text, meaning: p.meaning, example };
      case 'associate':
        return { kind: 'associate', speak: p.text, language: unit.language, text: p.text, meaning: p.meaning, ...(unit.association ? { association: unit.association } : {}), example };
      case 'recall': {
        const blank = example.text.replace(new RegExp(p.text.replace(/[.*+?^${}()|[\]\\…]/g, '\\$&'), 'i'), '_____');
        return {
          kind: 'recall',
          mode: 'meaning',
          prompt: p.meaning,
          expected: p.text,
          hints: [firstLetterHint(p.text), blank !== example.text ? blank : example.translation, unit.association?.cue ?? p.meaning, unit.association?.text ?? example.text],
          contextId: `${unit.key}#recall`,
        };
      }
      case 'order': {
        const distractors = others.filter((o) => o.key !== unit.key).flatMap((o) => o.payload.examples.flatMap((e) => e.text.split(/\s+/))).slice(0, 2);
        return { kind: 'order', translation: example.translation, ...orderTiles(example.text, distractors), speak: example.text, language: unit.language, contextId: `${unit.key}#example${exampleIndex}` };
      }
      case 'produce':
        return { kind: 'produce', goal: p.meaning, required: [p.text], examples: p.examples.map((e) => e.text), model: example, contextId: `${unit.key}#own:${sessionId}` };
      case 'dictation':
        return { kind: 'dictation', speak: p.text, language: unit.language, expected: p.text, contextId: `${unit.key}#dictation` };
      default:
        return { kind: 'result' };
    }
  }
  if (isPattern(unit)) {
    const p = unit.payload;
    const fixed = fixedPieces(p);
    const withFixed = p.examples.filter((e) => fixed.some((f) => containsPhrase(e.text, f)));
    const example = pick(withFixed.length ? withFixed : p.examples, seed);
    const exampleIndex = p.examples.indexOf(example);
    switch (step.kind) {
      case 'structure':
        return { kind: 'structure', goal: p.goal, rule: p.rule, pieces: p.pieces, examples: p.examples, pitfalls: p.pitfalls ?? [] };
      case 'recall': {
        const piece = fixed.find((f) => containsPhrase(example.text, f)) ?? fixed[0] ?? '';
        const blank = example.text.replace(new RegExp(piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____');
        const other = p.examples.find((e) => e !== example) ?? example;
        return { kind: 'recall', mode: 'blank', prompt: `${blank}\n(${example.translation})`, expected: piece, hints: [firstLetterHint(piece), p.goal, p.rule, other.text], contextId: `${unit.key}#example${exampleIndex}` };
      }
      case 'order': {
        const distractors = others.filter((o) => o.key !== unit.key).flatMap((o) => o.payload.examples.flatMap((e) => e.text.split(/\s+/))).slice(0, 2);
        return { kind: 'order', translation: example.translation, ...orderTiles(example.text, distractors), speak: example.text, language: unit.language, contextId: `${unit.key}#example${exampleIndex}` };
      }
      case 'produce':
        return { kind: 'produce', goal: p.goal, required: fixed, examples: p.examples.map((e) => e.text), model: example, contextId: `${unit.key}#own:${sessionId}` };
      default:
        return { kind: 'result' };
    }
  }
  return { kind: 'result' };
}

// ─── Corrección y eventos ───────────────────────────────────────────────────────────────────────────────

export interface StepAnswer {
  text?: string;
  order?: string[];
  /** Nivel de pista más alto que vio el alumno (P0–P4). */
  hintUsed?: HintLevel;
  /** Pidió ver la respuesta (P5). */
  revealed?: boolean;
  timeMs: number;
}

export interface StepOutcome {
  correct: boolean;
  format: ExerciseFormat;
  hint: HintLevel;
  expected?: string;
  problems?: OwnSentenceProblem[];
}

/** Corrige la respuesta. Devuelve `null` en los pasos que solo presentan contenido. */
export function gradeStep(step: SessionStep, exercise: Exercise, answer: StepAnswer): StepOutcome | null {
  switch (exercise.kind) {
    case 'recall': {
      const hint = (answer.revealed ? 5 : Math.max(step.startHint, answer.hintUsed ?? 0)) as HintLevel;
      const correct = hint < 5 && sameAnswer(answer.text ?? '', exercise.expected);
      return { correct, format: hint > 0 ? 'recall_cued' : 'recall_unaided', hint, expected: exercise.expected };
    }
    case 'order': {
      const correct = normalizeAnswer((answer.order ?? []).join(' ')) === normalizeAnswer(exercise.answer.join(' '));
      return { correct, format: 'recognition_choice', hint: 0, expected: exercise.answer.join(' ') };
    }
    case 'produce': {
      const problems = checkOwnSentence(answer.text ?? '', exercise.required, exercise.examples);
      return { correct: problems.length === 0, format: 'production', hint: 0, problems, expected: exercise.model.text };
    }
    case 'dictation': {
      const hint = (answer.revealed ? 5 : 0) as HintLevel;
      return { correct: hint < 5 && sameAnswer(answer.text ?? '', exercise.expected), format: 'listening_transcribe', hint, expected: exercise.expected };
    }
    default:
      return null;
  }
}

/** Evento que el cliente envía al servidor. El servidor pone el usuario; nunca se fía del cliente para eso. */
export interface ClientEvent {
  id: string;
  kind: 'exposure' | 'attempt';
  /** Hora del dispositivo (ms). */
  at: number;
  deviceId: string;
  seq: number;
  courseId: string;
  unitKey: string;
  skillKey: string;
  associationId?: string;
  contextId?: string;
  format?: ExerciseFormat;
  correct?: boolean;
  hint?: HintLevel;
  timeMs?: number;
}

export interface EventMeta {
  at: number;
  deviceId: string;
  nextSeq: () => number;
  newId: () => string;
}

export function eventsForStep(plan: SessionPlan, step: SessionStep, exercise: Exercise, outcome: StepOutcome | null, answer: StepAnswer | null, meta: EventMeta): ClientEvent[] {
  if (step.kind === 'result') return [];
  const base = { deviceId: meta.deviceId, courseId: plan.courseId, unitKey: step.unitKey, skillKey: step.skillKey, ...(step.associationId ? { associationId: step.associationId } : {}) };
  const events: ClientEvent[] = [];
  if (step.exposeFirst) events.push({ id: meta.newId(), kind: 'exposure', at: meta.at, seq: meta.nextSeq(), ...base });
  if (outcome) {
    const contextId = 'contextId' in exercise ? exercise.contextId : undefined;
    events.push({
      id: meta.newId(),
      kind: 'attempt',
      at: meta.at + 1,
      seq: meta.nextSeq(),
      ...base,
      ...(contextId ? { contextId } : {}),
      format: outcome.format,
      correct: outcome.correct,
      hint: outcome.hint,
      timeMs: Math.max(0, Math.round(answer?.timeMs ?? 0)),
    });
  }
  return events;
}

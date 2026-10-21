// Modo Flujo (D-068, D-077): un deslizar continuo e infinito, al estilo de las redes sociales. Cada ronda enseña antes de
// preguntar (regla de oro, D-067): asociación (reel) y, enseguida, relámpago o «¿verdad o mentira?»; si se falla, la
// ficha aparece en ese momento y la unidad vuelve unas tarjetas después. Cada pocas tarjetas, una pregunta tipo examen.
// Orden de una ronda: lo que toca repasar, «tus errores», lo nuevo y, si no queda nada de eso, refuerzo de lo más débil.
// Las preguntas suben de nivel: con dos repasos superados, en vez de elegir se completa escribiendo.
// La ronda acaba en un hito (resumen) y la siguiente se encadena sola al deslizar. Agnóstico de la materia: en idiomas
// (unidades `term`) también se escribe la palabra nueva; en el resto, solo se escribe al subir de nivel.
import type { PlanItem } from '@memora/core';
import { exercisesOf, seeded, shuffle, MAX_REVIEW_UNITS, type AssocPlan, type AssocStep } from './associations';
import type { SessionUnit } from './session';

/** Tarjetas entre una pregunta fallada y su repesca. */
export const FLOW_RETRY_GAP = 3;
/** Cada cuántas tarjetas llega una pregunta tipo examen. */
export const FLOW_BOSS_EVERY = 8;
/** Repasos superados a partir de los que la pregunta se completa escribiendo (D-077). */
export const FLOW_LEVEL_UP = 2;
/** Respuestas que se pueden escribir en el móvil sin fricción. */
export const FLOW_TYPED_MAX = 24;

/** Ejercicio que se puede completar escribiendo: respuesta corta y sin «ordenar pasos». */
export function typeableExercise(u: SessionUnit): number | null {
  const i = exercisesOf(u).findIndex((e) => e.kind !== 'order_steps' && Boolean(e.answer) && e.answer!.length <= FLOW_TYPED_MAX);
  return i < 0 ? null : i;
}

export function buildFlowSession(input: {
  sessionId: string;
  courseId: string;
  day: number;
  createdAt: number;
  items: PlanItem[];
  units: Record<string, SessionUnit>;
  maxNewUnits?: number;
  maxReviewUnits?: number;
  /** Unidades falladas o que se olvidaron (D-077): entran como «tus errores». */
  errorUnits?: string[];
  /** Refuerzo cuando no hay nada nuevo ni repasos (D-077): lo más débil ya trabajado. */
  practiceUnits?: string[];
  /** Repasos superados por unidad: decide si la pregunta sube de nivel. */
  levels?: Record<string, number>;
}): AssocPlan {
  const { units, items } = input;
  const rand = seeded(input.sessionId);
  const has = (k: string) => Boolean(units[k]);
  const reviews = [...new Set(items.filter((i) => i.reason === 'review').map((i) => i.unitId))].filter(has).slice(0, input.maxReviewUnits ?? MAX_REVIEW_UNITS);
  const fresh = [...new Set(items.filter((i) => i.reason === 'new').map((i) => i.unitId))].filter((k) => has(k) && !reviews.includes(k)).slice(0, input.maxNewUnits ?? Infinity);
  const errors = (input.errorUnits ?? []).filter((k) => has(k) && !reviews.includes(k) && !fresh.includes(k));
  const practice = reviews.length || fresh.length ? [] : (input.practiceUnits ?? []).filter((k) => has(k) && !errors.includes(k));
  const focus = (u: string): AssocStep['focus'] => (errors.includes(u) ? 'errors' : practice.includes(u) ? 'practice' : undefined);
  const known = new Set([...reviews, ...errors, ...practice]);

  // 1. Secuencia base (regla de oro, D-067): TODA unidad se enseña (reel) antes de su primera pregunta, también los
  //    repasos. Parejas: reel A, reel B, pregunta A, pregunta B. Primero lo que toca repasar y luego lo nuevo,
  //    alternando para que no se acumule; «tus errores» y el refuerzo van entre los repasos.
  type Draft = Omit<AssocStep, 'id'>;
  const base: Draft[] = [];
  const all = [...reviews, ...errors, ...practice, ...fresh];
  const tag = (u: string) => { const f = focus(u); return f ? { focus: f } : {}; };
  const quick = (u: string): Draft => ({ kind: 'quick', unitKey: u, scene: -4, reverse: rand() < 0.5, ...tag(u) });
  // «¿Verdad o mentira?» (D-072): el término con su significado (verdad) o con el de otra unidad (mentira), al 50 %.
  const judge = (u: string): Draft => {
    const others = all.filter((k) => k !== u);
    const lie = others.length > 0 && rand() < 0.5;
    return { kind: 'judge', unitKey: u, scene: -4, statementOf: lie ? others[Math.floor(rand() * others.length)]! : u, ...tag(u) };
  };
  // Sube de nivel (D-077): lo ya repasado con éxito se recupera escribiendo, no eligiendo.
  const levelUp = (u: string): Draft | null => {
    if (!known.has(u) || (input.levels?.[u] ?? 0) < FLOW_LEVEL_UP) return null;
    const unit = units[u]!;
    if (unit.type === 'term') {
      const recall = unit.skills.find((s) => s.kind === 'recall');
      return recall ? { kind: 'review', unitKey: u, scene: -4, skillKey: recall.key, startHint: 0, levelUp: true, ...tag(u) } : null;
    }
    const n = typeableExercise(unit);
    const skill = unit.skills.find((s) => s.kind === 'apply') ?? unit.skills.find((s) => s.kind === 'recall');
    return n === null || !skill ? null : { kind: 'challenge', unitKey: u, scene: -4, skillKey: skill.key, exercise: n, typed: true, levelUp: true, ...tag(u) };
  };
  const order: string[] = [];
  const rv = shuffle([...reviews, ...errors, ...practice], rand);
  const nw = [...fresh];
  while (rv.length || nw.length) { if (rv.length) order.push(...rv.splice(0, 2)); if (nw.length) order.push(...nw.splice(0, 2)); }
  for (let i = 0; i < order.length; i += 2) {
    const pair = order.slice(i, i + 2);
    for (const u of pair) base.push({ kind: 'reel', unitKey: u, scene: -4, ...tag(u) });
    // Variedad: la primera de la pareja, relámpago; la segunda, ¿verdad o mentira?; lo dominado, escribiendo.
    pair.forEach((u, j) => base.push(levelUp(u) ?? (j === 0 ? quick(u) : judge(u))));
  }

  // 2. Repesca intercalada: tras cada pregunta, su repetición FLOW_RETRY_GAP tarjetas después (se salta si se acertó).
  const withRetry: Draft[] = [];
  const pending: Array<{ at: number; step: Draft }> = [];
  for (const d of base) {
    withRetry.push(d);
    if (['quick', 'judge', 'challenge', 'review'].includes(d.kind)) pending.push({ at: withRetry.length + FLOW_RETRY_GAP, step: { kind: 'quick', unitKey: d.unitKey, scene: -4, retry: true, reverse: !d.reverse } });
    for (let j = pending.length - 1; j >= 0; j -= 1) if (pending[j]!.at <= withRetry.length) withRetry.push(pending.splice(j, 1)[0]!.step);
  }
  for (const p of pending) withRetry.push(p.step);

  // 3. Pregunta tipo examen cada FLOW_BOSS_EVERY tarjetas, de algo ya visto en el flujo.
  const steps: AssocStep[] = [];
  const seenUnits: string[] = [];
  const bossDone = new Set<string>();
  let sinceBoss = 0;
  const push = (d: Draft) => steps.push({ ...d, id: `${steps.length + 1}-${d.kind}-${d.unitKey || 'x'}` });
  for (const d of withRetry) {
    push(d);
    if (d.unitKey && !seenUnits.includes(d.unitKey)) seenUnits.push(d.unitKey);
    if (d.levelUp) bossDone.add(d.unitKey);
    if (!d.retry) sinceBoss += 1;
    if (sinceBoss >= FLOW_BOSS_EVERY) {
      const answerable = (k: string) => exercisesOf(units[k]!).map((e, n) => ({ e, n })).filter(({ e }) => e.kind !== 'order_steps');
      const u = seenUnits.find((k) => !bossDone.has(k) && answerable(k).length && units[k]!.skills.some((s) => s.kind === 'apply'));
      if (u) {
        bossDone.add(u);
        const apply = units[u]!.skills.find((s) => s.kind === 'apply')!;
        const options = answerable(u);
        push({ kind: 'challenge', unitKey: u, scene: -4, skillKey: apply.key, exercise: options[Math.floor(rand() * options.length)]!.n, typed: false });
      }
      sinceBoss = 0;
    }
  }
  // 4. Solo en idiomas: escribir lo nuevo al final.
  for (const u of fresh) {
    const recall = units[u]!.skills.find((s) => s.kind === 'recall');
    if (recall && units[u]!.type === 'term') push({ kind: 'review', unitKey: u, scene: -4, skillKey: recall.key, startHint: 0 });
  }
  // 5. Hito: resumen de la ronda dentro del feed; al deslizar empieza la siguiente.
  if (steps.length) push({ kind: 'summary', unitKey: '', scene: -4 });
  return { mode: 'flow', sessionId: input.sessionId, courseId: input.courseId, day: input.day, createdAt: input.createdAt, steps, scenes: [] };
}

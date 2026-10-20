// Modo Flujo (D-068): un deslizar continuo, al estilo de las redes sociales y del Arcade. Lo nuevo entra como
// asociación rápida (reel) y, enseguida, preguntas relámpago; si se falla, la asociación aparece en ese momento y la
// unidad vuelve unas tarjetas después (repesca intercalada). Cada pocas tarjetas, una pregunta tipo examen.
// Los pasos usan escena -4 (no hay escenas en el Flujo). Agnóstico de la materia: en idiomas (unidades `term`) se escribe al final; en el resto, nunca.
import type { PlanItem } from '@memora/core';
import { exercisesOf, seeded, shuffle, MAX_REVIEW_UNITS, type AssocPlan, type AssocStep } from './associations';
import type { SessionUnit } from './session';

/** Tarjetas entre una pregunta fallada y su repesca. */
export const FLOW_RETRY_GAP = 3;
/** Cada cuántas tarjetas llega una pregunta tipo examen. */
export const FLOW_BOSS_EVERY = 8;

export function buildFlowSession(input: {
  sessionId: string;
  courseId: string;
  day: number;
  createdAt: number;
  items: PlanItem[];
  units: Record<string, SessionUnit>;
  maxNewUnits?: number;
  maxReviewUnits?: number;
}): AssocPlan {
  const { units, items } = input;
  const rand = seeded(input.sessionId);
  const has = (k: string) => Boolean(units[k]);
  const reviews = [...new Set(items.filter((i) => i.reason === 'review').map((i) => i.unitId))].filter(has).slice(0, input.maxReviewUnits ?? MAX_REVIEW_UNITS);
  const fresh = [...new Set(items.filter((i) => i.reason === 'new').map((i) => i.unitId))].filter((k) => has(k) && !reviews.includes(k)).slice(0, input.maxNewUnits ?? Infinity);

  // 1. Secuencia base (regla de oro, D-067): TODA unidad se enseña (reel) antes de su primera pregunta, también los
  //    repasos. Parejas: reel A, reel B, relámpago A, relámpago B. Primero lo que toca repasar y luego lo nuevo,
  //    alternando para que no se acumule.
  type Draft = Omit<AssocStep, 'id'>;
  const base: Draft[] = [];
  const quick = (u: string): Draft => ({ kind: 'quick', unitKey: u, scene: -4, reverse: rand() < 0.5 });
  const order: string[] = [];
  const rv = shuffle(reviews, rand);
  const nw = [...fresh];
  while (rv.length || nw.length) { if (rv.length) order.push(...rv.splice(0, 2)); if (nw.length) order.push(...nw.splice(0, 2)); }
  for (let i = 0; i < order.length; i += 2) {
    const pair = order.slice(i, i + 2);
    for (const u of pair) base.push({ kind: 'reel', unitKey: u, scene: -4 });
    for (const u of pair) base.push(quick(u));
  }

  // 2. Repesca intercalada: tras cada relámpago, su repetición FLOW_RETRY_GAP tarjetas después (se salta si se acertó).
  const withRetry: Draft[] = [];
  const pending: Array<{ at: number; step: Draft }> = [];
  for (const d of base) {
    withRetry.push(d);
    if (d.kind === 'quick') pending.push({ at: withRetry.length + FLOW_RETRY_GAP, step: { ...d, retry: true, reverse: !d.reverse } });
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
    if (!d.retry) sinceBoss += 1;
    if (sinceBoss >= FLOW_BOSS_EVERY) {
      const u = seenUnits.find((k) => !bossDone.has(k) && exercisesOf(units[k]!).length && units[k]!.skills.some((s) => s.kind === 'apply'));
      if (u) {
        bossDone.add(u);
        const apply = units[u]!.skills.find((s) => s.kind === 'apply')!;
        push({ kind: 'challenge', unitKey: u, scene: -4, skillKey: apply.key, exercise: Math.floor(rand() * exercisesOf(units[u]!).length), typed: false });
      }
      sinceBoss = 0;
    }
  }
  // 4. Solo en idiomas: escribir lo nuevo al final.
  for (const u of fresh) {
    const recall = units[u]!.skills.find((s) => s.kind === 'recall');
    if (recall && units[u]!.type === 'term') push({ kind: 'review', unitKey: u, scene: -4, skillKey: recall.key, startHint: 0 });
  }
  if (steps.length) push({ kind: 'summary', unitKey: '', scene: -4 });
  return { mode: 'flow', sessionId: input.sessionId, courseId: input.courseId, day: input.day, createdAt: input.createdAt, steps, scenes: [] };
}

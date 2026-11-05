// Feed infinito (D-077): qué se practica cuando no queda nada nuevo ni ningún repaso vencido, y qué unidades son «tus
// errores». Agnóstico de la materia: solo mira el estado de las habilidades.
import type { SkillState } from './skill';

/** Unidades con un fallo pendiente (falladas desde su último acierto) o que se olvidaron alguna vez, más recientes primero. */
export function errorUnits(skills: Record<string, SkillState>, limit = 4, exclude: Iterable<string> = []): string[] {
  const skip = new Set(exclude);
  const by = new Map<string, { last: number; weight: number }>();
  for (const s of Object.values(skills)) {
    if (s.attempts === 0 || skip.has(s.unitId)) continue;
    const weight = s.consecutiveFailures * 3 + s.lapses;
    if (weight === 0) continue;
    const prev = by.get(s.unitId);
    by.set(s.unitId, { last: Math.max(prev?.last ?? 0, s.lastAttemptAt ?? 0), weight: (prev?.weight ?? 0) + weight });
  }
  return [...by.entries()].sort((a, b) => b[1].weight - a[1].weight || b[1].last - a[1].last).slice(0, limit).map(([k]) => k);
}

/**
 * Refuerzo: las unidades ya trabajadas más débiles (menos precisión, más fallos y la que vence antes), para seguir
 * practicando cuando el plan del día está vacío. Nunca devuelve unidades sin empezar.
 */
export function weakUnits(skills: Record<string, SkillState>, limit = 8, exclude: Iterable<string> = []): string[] {
  const skip = new Set(exclude);
  const by = new Map<string, { score: number; due: number }>();
  for (const s of Object.values(skills)) {
    if (s.attempts === 0 || skip.has(s.unitId)) continue;
    const score = (1 - s.accuracy) * 4 + s.consecutiveFailures * 3 + s.lapses - Math.min(s.deferredSuccesses, 5) * 0.5;
    const prev = by.get(s.unitId);
    by.set(s.unitId, { score: Math.max(prev?.score ?? -Infinity, score), due: Math.min(prev?.due ?? Infinity, s.dueAt ?? Infinity) });
  }
  return [...by.entries()].sort((a, b) => b[1].score - a[1].score || a[1].due - b[1].due).slice(0, limit).map(([k]) => k);
}

/**
 * Fallos pendientes («Vacía tus fallos»): unidades con alguna habilidad fallada desde su último acierto, la más reciente
 * primero. Una unidad sale de aquí en cuanto se acierta esa habilidad (sus fallos seguidos vuelven a 0).
 */
export function pendingFailures(skills: Record<string, SkillState>, limit = Infinity): string[] {
  const last = new Map<string, number>();
  for (const s of Object.values(skills)) {
    if (s.attempts === 0 || s.consecutiveFailures === 0) continue;
    last.set(s.unitId, Math.max(last.get(s.unitId) ?? 0, s.lastAttemptAt ?? 0));
  }
  return [...last.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}

/** Unidades que conviene repasar ya: alguna habilidad trabajada vence en `now` o antes. */
export function dueUnits(skills: Record<string, SkillState>, now: number): Set<string> {
  const out = new Set<string>();
  for (const s of Object.values(skills)) if (s.attempts > 0 && s.dueAt !== null && s.dueAt <= now) out.add(s.unitId);
  return out;
}

/** Escalón del programador desde el que una palabra se repasa recordándola (no eligiendo): los intervalos largos exigen recuperar. */
export const MATURE_STEP = 3;

/**
 * Repaso por palabra (D-094): de los repasos vencidos del plan (ya ordenados por urgencia), las palabras cuya habilidad
 * de recordar toca hoy según su curva. Una palabra sale una sola vez aunque venzan varias de sus habilidades; las de
 * escuchar y producir se practican con lo nuevo. `recall` indica que ya es madura y se repasa recordándola.
 */
export function dueWords(items: Array<{ skillId: string; unitId: string; reason: string }>, kindOf: (skillId: string) => string | undefined, isWord: (unitId: string) => boolean, skills: Record<string, SkillState>): Array<{ unitKey: string; recall: boolean }> {
  const out: Array<{ unitKey: string; recall: boolean }> = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (it.reason !== 'review' || seen.has(it.unitId) || !isWord(it.unitId) || kindOf(it.skillId) !== 'recall') continue;
    seen.add(it.unitId);
    out.push({ unitKey: it.unitId, recall: (skills[it.skillId]?.step ?? 0) >= MATURE_STEP });
  }
  return out;
}

/**
 * Todas las palabras que tocan repasar (su «recordar» ha vencido), SIN el tope diario del plan, ordenadas para que salgan
 * primero las MENOS practicadas (menos intentos en total) y, a igualdad, las que más tiempo llevan esperando. Antes el
 * Repaso rápido salía del plan del día (los 30 repasos de más prioridad) y repetía siempre las mismas palabras
 * recientes; el resto no llegaba nunca (usuario, 5-nov-2026: «que aparezcan siempre las menos vistas»).
 */
export function dueWordsLeastSeen(defs: Array<{ id: string; unitId: string; kind: string }>, skills: Record<string, SkillState>, isWord: (unitId: string) => boolean, now: number, dayStart?: number): Array<{ unitKey: string; recall: boolean }> {
  const attempts = new Map<string, number>();
  // Usuario (6-nov-2026): «siempre las mismas». Lo aprendido HOY volvía a la hora y a las 3 horas y, como tenía menos
  // intentos que lo antiguo, se ponía delante y tapaba lo de días atrás. Con `dayStart`, lo ya practicado hoy sin fallo
  // espera a mañana; el repaso se llena con lo de otros días, de menos a más veces practicado.
  const today = new Set<string>();
  const failing = new Set<string>();
  for (const s of Object.values(skills)) {
    attempts.set(s.unitId, (attempts.get(s.unitId) ?? 0) + s.attempts);
    if (dayStart !== undefined && (s.lastAttemptAt ?? 0) >= dayStart) today.add(s.unitId);
    if (s.consecutiveFailures > 0) failing.add(s.unitId);
  }
  const out: Array<{ unitKey: string; recall: boolean; n: number; due: number }> = [];
  const seen = new Set<string>();
  for (const d of defs) {
    if (d.kind !== 'recall' || seen.has(d.unitId) || !isWord(d.unitId)) continue;
    const s = skills[d.id];
    if (!s || s.status === 'new' || s.dueAt === null || s.dueAt > now) continue;
    if (today.has(d.unitId) && !failing.has(d.unitId)) continue;
    seen.add(d.unitId);
    out.push({ unitKey: d.unitId, recall: (s.step ?? 0) >= MATURE_STEP, n: attempts.get(d.unitId) ?? 0, due: s.dueAt });
  }
  return out.sort((a, b) => a.n - b.n || a.due - b.due || (a.unitKey < b.unitKey ? -1 : 1)).map(({ unitKey, recall }) => ({ unitKey, recall }));
}

/**
 * Decisión del usuario (6-nov-2026): en idiomas, el repaso no depende de las horas. Sale TODO lo ya aprendido, de menos
 * a más veces practicado (a igualdad, lo que hace más tiempo que no se practica). Así, si ayer una palabra salió 1 vez y
 * hoy otra 4, la de ayer vuelve antes. El estado honesto de cada palabra (regla 9) se sigue calculando igual.
 */
export function wordsLeastPracticed(defs: Array<{ id: string; unitId: string; kind: string }>, skills: Record<string, SkillState>, isWord: (unitId: string) => boolean, rand?: () => number): Array<{ unitKey: string; recall: boolean }> {
  const attempts = new Map<string, number>();
  const last = new Map<string, number>();
  for (const s of Object.values(skills)) {
    attempts.set(s.unitId, (attempts.get(s.unitId) ?? 0) + s.attempts);
    last.set(s.unitId, Math.max(last.get(s.unitId) ?? 0, s.lastAttemptAt ?? s.lastExposureAt ?? 0));
  }
  const out: Array<{ unitKey: string; recall: boolean; n: number; at: number }> = [];
  const seen = new Set<string>();
  for (const d of defs) {
    if (d.kind !== 'recall' || seen.has(d.unitId) || !isWord(d.unitId)) continue;
    const s = skills[d.id];
    if (!s || s.status === 'new') continue;
    seen.add(d.unitId);
    // Con `rand`, a igualdad de intentos el orden es al azar (cada repaso empieza distinto).
    out.push({ unitKey: d.unitId, recall: (s.step ?? 0) >= MATURE_STEP, n: attempts.get(d.unitId) ?? 0, at: rand ? rand() : last.get(d.unitId) ?? 0 });
  }
  return out.sort((a, b) => a.n - b.n || a.at - b.at || (a.unitKey < b.unitKey ? -1 : 1)).map(({ unitKey, recall }) => ({ unitKey, recall }));
}

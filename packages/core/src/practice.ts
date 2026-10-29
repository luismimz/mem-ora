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

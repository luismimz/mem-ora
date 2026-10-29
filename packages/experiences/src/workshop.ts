// El Taller (D-090): saber USAR lo aprendido, no solo recordarlo. En los cursos de conceptos (DAM), cada pocas fichas
// llega un minijuego de 5 retos mezclados con lo ya enseñado: «¿Qué es esto?» (un ejemplo o un caso y eliges qué
// concepto es), «Completa el código», «¿Qué imprime?», «Caza el bug» (tocando la línea) y, en interfaces, «¿Qué
// componente es?» con el componente dibujado. Solo entra lo que ya se ha enseñado (regla de oro, D-067).
import type { ConceptExample, ConceptExercise, ConceptPayload } from '@memora/content';
import { exercisesOf, shuffle, unitText } from './associations';
import type { SessionUnit } from './session';

export type WorkshopItem =
  | { kind: 'whatis'; unitKey: string; source: 'case' | 'example'; index: number; options: string[] }
  | { kind: 'code'; unitKey: string; exercise: number }
  | { kind: 'widget'; unitKey: string; options: string[] };

/** Retos por Taller, opciones de «¿Qué es esto?» y fichas enseñadas (las que se ven en la ficha del concepto). */
export const WORKSHOP_SIZE = 5;
export const WORKSHOP_OPTIONS = 4;
export const WORKSHOP_TAUGHT_EXAMPLES = 4;
/** Fichas de conceptos entre un Taller y el siguiente. */
export const WORKSHOP_EVERY = 4;

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** El ejemplo sin el nombre del concepto (ni sus otras respuestas): si no, la respuesta estaría a la vista. */
export function maskName(text: string, u: SessionUnit): string {
  const p = u.payload as ConceptPayload;
  const names = [p.name, ...(p.answers ?? [])].filter((n): n is string => Boolean(n && n.trim().length >= 3)).sort((a, b) => b.length - a.length);
  let out = text;
  for (const n of names) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escape(n.trim())}(?![\\p{L}\\p{N}_])`, 'giu'), '▢▢▢');
  return out;
}

/** Lo que se puede reconocer de un concepto: sus casos nuevos (mejor, es transferir) o, si no tiene, sus ejemplos enseñados. */
export function recognizables(u: SessionUnit): Array<{ source: 'case' | 'example'; index: number }> {
  if (u.type !== 'concept') return [];
  const p = u.payload as ConceptPayload;
  const ok = (e: ConceptExample) => e.text.length <= 500 && !e.text.startsWith('🔗') && maskName(e.text, u).replace(/▢/g, '').trim().length >= 12;
  const cases = (p.cases ?? []).flatMap((e, index) => (ok(e) ? [{ source: 'case' as const, index }] : []));
  if (cases.length) return cases;
  return (p.examples ?? []).slice(0, WORKSHOP_TAUGHT_EXAMPLES).flatMap((e, index) => (ok(e) ? [{ source: 'example' as const, index }] : []));
}

/** Ejercicios de código jugables: completar (con hueco y opciones), ¿qué imprime? y cazar el bug. */
export function codeExercises(u: SessionUnit): number[] {
  if (u.type !== 'concept') return [];
  return exercisesOf(u).flatMap((e: ConceptExercise, i) => {
    if (!e.code || !e.answer) return [];
    const opts = (e.distractors?.length ?? 0) >= 1;
    if (e.kind === 'fill_gap') return e.code.includes('___') && opts ? [i] : [];
    if (e.kind === 'predict_output') return opts ? [i] : [];
    if (e.kind === 'find_bug') return e.bugLine !== undefined || opts ? [i] : [];
    return [];
  });
}

export const widgetOf = (u: SessionUnit) => (u.type === 'concept' ? (u.payload as ConceptPayload).widget : undefined);

/**
 * Un Taller con los conceptos recién enseñados (`block`) y, para completar, lo ya aprendido (`pool`). Cada concepto
 * del bloque aporta un reto (código si lo tiene, si no «¿Qué es esto?» o su componente). Las opciones son conceptos
 * cercanos en el curso (los que más se confunden). `null` si no llega a 3 retos.
 */
export function buildWorkshop(block: string[], pool: string[], units: Record<string, SessionUnit>, rand: () => number): WorkshopItem[] | null {
  const order = Object.keys(units);
  const near = (u: string, among: string[]) => [...among].sort((a, b) => Math.abs(order.indexOf(a) - order.indexOf(u)) - Math.abs(order.indexOf(b) - order.indexOf(u)) || (rand() - 0.5));
  const names = (u: string) => unitText(units[u]!).trim().toLowerCase();
  const optionsFor = (u: string, candidates: string[]): string[] | null => {
    const seen = new Set([names(u)]);
    const others: string[] = [];
    for (const k of near(u, candidates.filter((k) => k !== u)).slice(0, 10)) {
      if (seen.has(names(k))) continue;
      seen.add(names(k)); others.push(k);
    }
    const picked = shuffle(others.slice(0, 6), rand).slice(0, WORKSHOP_OPTIONS - 1);
    return picked.length >= 2 ? shuffle([u, ...picked], rand) : null;
  };
  const concepts = [...new Set([...block, ...pool])].filter((k) => units[k]?.type === 'concept');
  const widgets = concepts.filter((k) => widgetOf(units[k]!));
  const itemFor = (u: string): WorkshopItem | null => {
    const unit = units[u]!;
    const w = widgetOf(unit);
    if (w && widgets.length >= 3) {
      const options = optionsFor(u, widgets);
      if (options) return { kind: 'widget', unitKey: u, options };
    }
    const code = codeExercises(unit);
    const rec = recognizables(unit);
    const useCode = code.length && (!rec.length || rand() < 0.55);
    if (useCode) return { kind: 'code', unitKey: u, exercise: code[Math.floor(rand() * code.length)]! };
    if (rec.length) {
      const options = optionsFor(u, concepts);
      if (options) { const r = rec[Math.floor(rand() * rec.length)]!; return { kind: 'whatis', unitKey: u, source: r.source, index: r.index, options }; }
    }
    return null;
  };
  const items: WorkshopItem[] = [];
  for (const u of block) { const it = units[u]?.type === 'concept' ? itemFor(u) : null; if (it) items.push(it); }
  for (const u of shuffle(pool.filter((k) => !block.includes(k) && units[k]?.type === 'concept'), rand)) {
    if (items.length >= WORKSHOP_SIZE) break;
    const it = itemFor(u);
    if (it) items.push(it);
  }
  return items.length >= 3 ? shuffle(items.slice(0, WORKSHOP_SIZE), rand) : null;
}

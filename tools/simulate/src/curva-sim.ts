// Carga del repaso por curva en idiomas (D-094) durante 30 días: cuántos repasos pide el calendario con 33 nuevas al día.
// Por defecto el alumno simulado lo recuerda todo (S0 alto): mide el calendario, no la memoria. Con S0 (días), GR y GW se
// prueba una memoria que olvida (e^(−t/S); S × GR al recordar, × GW al reconocer). No forma parte de la app:
//   node_modules/.bin/tsx --tsconfig tools/simulate/tsconfig.json tools/simulate/src/curva-sim.ts
import { applyAttempt, applyExposure, createLearner, dueWords, MATURE_STEP, planDay, resolveConfig, type Catalog, type LearnerState } from '@memora/core';

const HOUR = 3_600_000; const DAY = 24 * HOUR;
const N = 1000; const GOAL = 33; const PER_ROUND = 11; const REVIEW_MAX = Number(process.env.RMAX ?? 999);
const config = resolveConfig({ load: { newCap: 300, minNewPerDay: 0, reviewCap: 9999, totalCap: 99999, backlogSuppressNew: 99999 } });
const catalog: Catalog = { units: [], skills: [], prerequisites: [] };
for (let i = 0; i < N; i++) { const u = `w${i}`; catalog.units.push({ id: u, courseId: 'en', type: 'term' }); for (const k of ['recall', 'listen', 'produce'] as const) catalog.skills.push({ id: `${u}.${k}`, unitId: u, kind: k }); }
const kind = new Map(catalog.skills.map((s) => [s.id, s.kind as string]));
// Memoria «real» del alumno simulado: estabilidad en días; probabilidad de recordar = e^(−t/S).
const mem: Record<string, { s: number; last: number }> = {};
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const recallP = (u: string, now: number) => { const m = mem[u]!; return Math.exp(-(now - m.last) / DAY / m.s); };
let learner: LearnerState = createLearner('sim'); let n = 0;
const attempt = (u: string, k: string, format: Parameters<typeof applyAttempt>[1]['format'], correct: boolean, at: number) => { learner = applyAttempt(learner, { id: `a${n++}`, userId: 'sim', skillId: `${u}.${k}`, unitId: u, at, format, correct, hint: 0, timeMs: 3000, contextId: `${u}#${n}` }, config).learner; };
const learnt = (u: string, ok: boolean, strong: boolean, now: number) => { const m = mem[u]!; m.s = ok ? m.s * (strong ? Number(process.env.GR ?? 2.5) : Number(process.env.GW ?? 1.4)) : Math.max(0.4, m.s * 0.5); m.last = now; };
let introduced = 0;
for (let day = 0; day < 30; day++) {
  let reviews = 0; let fresh = 0; let ok = 0;
  for (const h of [9, 14, 20]) {
    const now = day * DAY + h * HOUR;
    const plan = planDay({ catalog, learner, now, config });
    const words = dueWords(plan.items, (id) => kind.get(id), () => true, learner.skills);
    for (const w of words.slice(0, REVIEW_MAX)) {
      const p = recallP(w.unitKey, now);
      const right = rnd() < (w.recall ? p : Math.min(1, p + 0.25));
      attempt(w.unitKey, 'recall', w.recall ? 'recall_unaided' : 'recognition_choice', right, now);
      learnt(w.unitKey, right, w.recall, now); reviews++; if (right) ok++;
      if (!right) { attempt(w.unitKey, 'recall', 'recognition_choice', true, now + 60_000); reviews++; }
    }
    const backlog = words.length > REVIEW_MAX * 3;
    const take = Math.min(backlog ? 4 : PER_ROUND, fresh >= GOAL ? 0 : GOAL - fresh, N - introduced);
    for (let i = 0; i < take; i++) {
      const u = `w${introduced++}`; fresh++;
      for (const k of ['recall', 'listen', 'produce']) learner = applyExposure(learner, { id: `e${n++}`, userId: 'sim', skillId: `${u}.${k}`, unitId: u, at: now }, config);
      mem[u] = { s: Number(process.env.S0 ?? 1000), last: now };
      attempt(u, 'recall', 'recognition_choice', rnd() < 0.95, now + 60_000);
      attempt(u, 'produce', 'production', rnd() < 0.85, now + 120_000);
      attempt(u, 'recall', 'recall_unaided', rnd() < 0.85, now + 300_000);
    }
  }
  const end = (day + 1) * DAY;
  const known = Object.keys(mem).filter((u) => recallP(u, end) > 0.8).length;
  const mature = Object.values(learner.skills).filter((s) => s.skillId.endsWith('.recall') && s.step >= MATURE_STEP + 1).length;
  console.log(`día ${String(day + 1).padStart(2)}: nuevas ${String(fresh).padStart(2)} · repasos ${String(reviews).padStart(3)} (${reviews ? Math.round((ok / Math.max(1, reviews)) * 100) : 0}% bien) · vistas ${String(introduced).padStart(4)} · las recordarías hoy ${String(known).padStart(4)} · con intervalo ≥ 7 días ${mature}`);
}

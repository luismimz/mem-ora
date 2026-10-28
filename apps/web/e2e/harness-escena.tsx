// Banco de pruebas de «La escena que cambia» (D-084) con el planificador real y el truco ¿Dónde está? del curso de
// inglés (las mismas escenas del 🐛 y el 🎩 que se publican). Sin servidor. Solo lo usa `e2e/escena-touch.mjs`.
import { createRoot } from 'react-dom/client';
import { buildFlowSession, type SessionUnit } from '@memora/experiences';
import '../src/styles.css';
import { Feed } from '../src/Feed';
import type { SessionPayload } from '../src/api';

// Cualquier truco del curso con escenas: ?k=g-comparatives (por defecto, ¿Dónde está?).
const files = import.meta.glob('../../../content/ingles-1000/*.json', { eager: true, import: 'default' }) as Record<string, { modules: Array<{ units: Array<Record<string, unknown>> }> }>;
const wanted = (new URLSearchParams(location.search).get('k') ?? 'g-place').split(',');
const all = Object.values(files).flatMap((f) => f.modules.flatMap((m) => m.units));
const units: Record<string, SessionUnit> = {};
for (const w of wanted) {
  const raw = all.find((u) => u.key === w)!;
  const { key, type, association, ...payload } = raw as { key: string; type: string; association?: { technique: string; scene: string; emoji?: string; cue?: string; sceneTarget?: string } } & Record<string, unknown>;
  units[key] = {
    key, type, language: 'en', version: 1, payload,
    skills: [{ key: `${key}.recall`, kind: 'recall' }, { key: `${key}.produce`, kind: 'produce' }],
    association: association ? { id: `a-${key}`, technique: association.technique, text: association.scene, emoji: association.emoji, cue: association.cue, sceneTarget: association.sceneTarget } : null,
  } as unknown as SessionUnit;
}
const key = wanted[0]!;
const sessionId = new URLSearchParams(location.search).get('s') ?? 'e2e-escena';
const items = wanted.map((k) => ({ skillId: `${k}.recall`, unitId: k, reason: 'new' as const, priority: 0, recommendedHint: 0 as const }));
// ?a=1: lo ya aprendido son las unidades pedidas (Arcade sorpresa, D-087); ?solo=arcade deja solo el Arcade y el resumen.
const q = new URLSearchParams(location.search);
const plan = buildFlowSession({ sessionId, courseId: 'e2e', day: 1, createdAt: 0, items, units, audio: true, ...(q.get('a') ? { arcadeUnits: wanted } : {}) });
if (q.get('solo')) plan.steps = plan.steps.filter((x) => x.kind === q.get('solo') || x.kind === 'summary');
const state = { plan, index: 0, outcomes: {}, finished: false };
const w = window as unknown as { __plan: unknown; __units: unknown };
w.__plan = plan; w.__units = units;
// ?next=ms: la siguiente ronda tarda ms en prepararse (o nunca, con ?next=never); sin ?next, modo sin conexión.
const delay = q.get('next');
const nextRound = delay === null ? undefined : () => new Promise<SessionPayload>((resolve) => {
  if (delay === 'never') return;
  window.setTimeout(() => resolve({ state: { ...state, plan: { ...plan, sessionId: `${sessionId}-2`, steps: plan.steps.filter((x) => x.kind !== 'summary').concat(plan.steps.filter((x) => x.kind === 'summary')) } }, units } as unknown as SessionPayload), Number(delay));
});
(window as unknown as { __again: number }).__again = 0;
createRoot(document.getElementById('root')!).render(<Feed payload={{ state, units } as unknown as SessionPayload} courseId="e2e" offline={!nextRound} {...(nextRound ? { next: nextRound } : {})} onExit={() => undefined} onAgain={() => { (window as unknown as { __again: number }).__again += 1; }} />);

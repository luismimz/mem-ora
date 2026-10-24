// Banco de pruebas de «La escena que cambia» (D-084) con el planificador real y el truco ¿Dónde está? del curso de
// inglés (las mismas escenas del 🐛 y el 🎩 que se publican). Sin servidor. Solo lo usa `e2e/escena-touch.mjs`.
import { createRoot } from 'react-dom/client';
import { buildFlowSession, type SessionUnit } from '@memora/experiences';
import '../src/styles.css';
import { Feed } from '../src/Feed';
import type { SessionPayload } from '../src/api';

// Cualquier truco del curso con escenas: ?k=g-comparatives (por defecto, ¿Dónde está?).
const files = import.meta.glob('../../../content/ingles-1000/*.json', { eager: true, import: 'default' }) as Record<string, { modules: Array<{ units: Array<Record<string, unknown>> }> }>;
const wanted = new URLSearchParams(location.search).get('k') ?? 'g-place';
const raw = Object.values(files).flatMap((f) => f.modules.flatMap((m) => m.units)).find((u) => u.key === wanted)!;
const { key, type, association, ...payload } = raw as { key: string; type: string; association?: { technique: string; scene: string; emoji?: string } } & Record<string, unknown>;
const units: Record<string, SessionUnit> = {
  [key]: {
    key, type, language: 'en', version: 1, payload,
    skills: [{ key: `${key}.recall`, kind: 'recall' }, { key: `${key}.produce`, kind: 'produce' }],
    association: association ? { id: `a-${key}`, technique: association.technique, text: association.scene, emoji: association.emoji } : null,
  } as unknown as SessionUnit,
};
const sessionId = new URLSearchParams(location.search).get('s') ?? 'e2e-escena';
const items = [{ skillId: `${key}.recall`, unitId: key, reason: 'new' as const, priority: 0, recommendedHint: 0 as const }];
const plan = buildFlowSession({ sessionId, courseId: 'e2e', day: 1, createdAt: 0, items, units, audio: true });
const state = { plan, index: 0, outcomes: {}, finished: false };
const w = window as unknown as { __plan: unknown; __units: unknown };
w.__plan = plan; w.__units = units;
createRoot(document.getElementById('root')!).render(<Feed payload={{ state, units } as unknown as SessionPayload} courseId="e2e" offline onExit={() => undefined} onAgain={() => undefined} />);

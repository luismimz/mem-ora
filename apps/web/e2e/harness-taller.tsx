// Banco de pruebas del Taller (D-090) con el planificador real y conceptos de prueba propios (fixtures/taller.json).
// Sin servidor. Solo lo usa `e2e/taller-touch.mjs`. ?k=a,b (unidades), ?s= (semilla), ?solo=workshop, ?a=1 (Arcade con los conceptos pedidos).
import { createRoot } from 'react-dom/client';
import { buildFlowSession, type SessionUnit } from '@memora/experiences';
import '../src/styles.css';
import { Feed } from '../src/Feed';
import type { SessionPayload } from '../src/api';
import data from './fixtures/taller.json';

const q = new URLSearchParams(location.search);
const raw = (data as { units: Array<Record<string, unknown> & { key: string }> }).units;
const wanted = (q.get('k') ?? raw.map((u) => u.key).join(',')).split(',');
const units: Record<string, SessionUnit> = {};
for (const w of wanted) {
  const { key, ...payload } = raw.find((u) => u.key === w)!;
  units[key] = { key, type: 'concept', language: 'es', version: 1, payload,
    skills: [{ key: `${key}.recall`, kind: 'recall' }, { key: `${key}.apply`, kind: 'apply' }], association: null } as unknown as SessionUnit;
}
const items = wanted.map((k) => ({ skillId: `${k}.recall`, unitId: k, reason: 'new' as const, priority: 0, recommendedHint: 0 as const }));
const plan = buildFlowSession({ sessionId: q.get('s') ?? 'e2e-taller', courseId: 'e2e', day: 1, createdAt: 0, items, units, ...(q.get('a') ? { arcadeUnits: wanted } : {}) });
if (q.get('solo')) plan.steps = plan.steps.filter((x) => x.kind === q.get('solo') || x.kind === 'summary');
const w = window as unknown as { __plan: unknown; __units: unknown };
w.__plan = plan; w.__units = units;
createRoot(document.getElementById('root')!).render(<Feed payload={{ state: { plan, index: 0, outcomes: {}, finished: false }, units } as unknown as SessionPayload} courseId="e2e" offline onExit={() => undefined} onAgain={() => undefined} />);

// Lógica del lado del servidor para el alumno, sin dependencias de Directus (se prueba sola).
// El servidor es la fuente de verdad: guarda los eventos y recalcula el estado del alumno a partir de todos ellos.
import { applyEvents, assertValidAttempt, createLearner, EXERCISE_FORMATS, type Attempt, type CoreConfig, type Exposure, type HintLevel, type LearnerState } from '@memora/core';
import type { ClientEvent, SessionUnit } from '@memora/experiences';

export const MAX_EVENTS_PER_BATCH = 100;
/** Margen para relojes adelantados: una hora del dispositivo más allá de esto se sustituye por la de recepción. */
export const FUTURE_TOLERANCE_MS = 5 * 60_000;

export interface SkillRef {
  key: string;
  unitKey: string;
  associationId: string | null;
}

export interface StoredEvent {
  event_id: string;
  kind: 'exposure' | 'attempt';
  payload: ClientEvent;
  device_time: number;
}

/** Hora que usa el núcleo: la del dispositivo, salvo que venga del futuro. */
export function effectiveTime(deviceTime: number, receivedAt: number): number {
  return deviceTime > receivedAt + FUTURE_TOLERANCE_MS ? receivedAt : deviceTime;
}

/** Comprueba un evento del cliente contra las habilidades publicadas del curso. Devuelve el motivo del rechazo o null. */
export function rejectReason(e: unknown, skills: Map<string, SkillRef>, courseId: string): string | null {
  if (!e || typeof e !== 'object') return 'not_object';
  const ev = e as Partial<ClientEvent>;
  if (typeof ev.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(ev.id)) return 'bad_id';
  if (ev.kind !== 'exposure' && ev.kind !== 'attempt') return 'bad_kind';
  if (typeof ev.at !== 'number' || !Number.isFinite(ev.at)) return 'bad_time';
  if (typeof ev.deviceId !== 'string' || !ev.deviceId || ev.deviceId.length > 64) return 'bad_device';
  if (!Number.isInteger(ev.seq) || (ev.seq as number) < 0) return 'bad_seq';
  if (ev.courseId !== courseId) return 'wrong_course';
  const skill = typeof ev.skillKey === 'string' ? skills.get(ev.skillKey) : undefined;
  if (!skill) return 'unknown_skill';
  if (ev.unitKey !== skill.unitKey) return 'wrong_unit';
  if (ev.associationId !== undefined && ev.associationId !== skill.associationId) return 'wrong_association';
  if (ev.contextId !== undefined && (typeof ev.contextId !== 'string' || ev.contextId.length > 128)) return 'bad_context';
  if (ev.kind === 'attempt') {
    if (!(EXERCISE_FORMATS as readonly string[]).includes(ev.format as string)) return 'bad_format';
    if (typeof ev.correct !== 'boolean') return 'bad_correct';
    if (!Number.isInteger(ev.hint) || (ev.hint as number) < 0 || (ev.hint as number) > 5) return 'bad_hint';
    if (typeof ev.timeMs !== 'number' || ev.timeMs < 0) return 'bad_time_ms';
    try {
      assertValidAttempt(toAttempt(ev as ClientEvent, 'u', ev.at));
    } catch {
      return 'invalid_attempt';
    }
  }
  return null;
}

function toAttempt(e: ClientEvent, userId: string, at: number): Attempt {
  return {
    id: e.id,
    userId,
    skillId: e.skillKey,
    unitId: e.unitKey,
    at,
    format: e.format!,
    correct: e.correct!,
    hint: e.hint as HintLevel,
    timeMs: e.timeMs ?? 0,
    ...(e.associationId ? { associationId: e.associationId } : {}),
    ...(e.contextId ? { contextId: e.contextId } : {}),
  };
}

function toExposure(e: ClientEvent, userId: string, at: number): Exposure {
  return { id: e.id, userId, skillId: e.skillKey, unitId: e.unitKey, at, ...(e.associationId ? { associationId: e.associationId } : {}) };
}

/**
 * Recalcula el estado del alumno con todos sus eventos del curso, en orden cronológico. Los eventos que el núcleo
 * rechace (por ejemplo, por un cambio posterior del contenido) se ignoran y se devuelven para registrarlos.
 */
export function recompute(userId: string, events: StoredEvent[], config: CoreConfig): { learner: LearnerState; skipped: string[] } {
  const items = events.map((row) =>
    row.kind === 'exposure'
      ? ({ kind: 'exposure', event: toExposure(row.payload, userId, row.device_time) } as const)
      : ({ kind: 'attempt', event: toAttempt(row.payload, userId, row.device_time) } as const),
  );
  const skipped: string[] = [];
  let learner = createLearner(userId);
  // applyEvents ordena y deduplica; aplicamos de uno en uno para que un evento malo no tire todo el recálculo.
  const sorted = [...items].sort((a, b) => a.event.at - b.event.at || (a.event.id < b.event.id ? -1 : 1));
  for (const item of sorted) {
    try {
      learner = applyEvents(learner, [item], config);
    } catch {
      skipped.push(item.event.id);
    }
  }
  return { learner, skipped };
}

export interface UnitRow {
  id: string;
  key: string;
  type: 'term' | 'pattern';
  language: string | null;
  payload: unknown;
  version: number | null;
}
export interface SkillRow {
  id: string;
  key: string;
  kind: SessionUnit['skills'][number]['kind'];
  unit: string;
  association: string | null;
  sort: number | null;
}
export interface AssociationRow {
  id: string;
  unit: string;
  technique: string;
  cue: string | null;
  text: string | null;
  status: string;
}

/** Unidades publicadas listas para la sesión. Solo se usan asociaciones publicadas. */
export function sessionUnits(units: UnitRow[], skills: SkillRow[], associations: AssociationRow[], courseLanguage: string): Record<string, SessionUnit> {
  const published = new Map(associations.filter((a) => a.status === 'published' && a.text).map((a) => [a.id, a]));
  const out: Record<string, SessionUnit> = {};
  for (const u of units) {
    const mine = skills.filter((s) => s.unit === u.id).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const linked = mine.map((s) => (s.association ? published.get(s.association) : undefined)).find(Boolean);
    out[u.key] = {
      key: u.key,
      type: u.type,
      language: u.language ?? courseLanguage,
      payload: (typeof u.payload === 'string' ? JSON.parse(u.payload) : u.payload) as SessionUnit['payload'],
      version: u.version ?? 0,
      skills: mine.map((s) => ({ key: s.key, kind: s.kind, associationId: s.association && published.has(s.association) ? s.association : null })),
      association: linked ? { id: linked.id, technique: linked.technique, cue: linked.cue, text: linked.text! } : null,
    };
  }
  return out;
}

/** Índice de habilidades del curso para validar eventos. */
export function skillIndex(units: Record<string, SessionUnit>): Map<string, SkillRef> {
  const map = new Map<string, SkillRef>();
  for (const u of Object.values(units)) for (const s of u.skills) map.set(s.key, { key: s.key, unitKey: u.key, associationId: s.associationId ?? null });
  return map;
}

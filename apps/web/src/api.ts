// Cliente de la API. La sesión va en una cookie httpOnly de Directus (modo `session`): no hay tokens en el navegador.
import type { AssocPlan, ClientEvent, ExamQuestion, SessionUnit } from '@memora/experiences';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

/** Tiempo máximo de una petición. */
export const REQUEST_TIMEOUT_MS = 25000;

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  // Sin cobertura, fetch lanza TypeError: se convierte en un error reconocible («OFFLINE»).
  // Tiempo máximo (28-oct-2026): con mala cobertura una petición podía quedarse esperando para siempre y la tarjeta
  // «Preparando la siguiente ronda…» no salía nunca. Pasado el tiempo cuenta como sin conexión (se reintenta luego).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: ctrl.signal,
  }).catch(() => { throw new ApiError(0, 'OFFLINE', 'Sin conexión.'); }).finally(() => clearTimeout(timer));
  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'session' }) });
    if (refreshed.ok) return request<T>(method, path, body, false);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = json.errors?.[0];
    throw new ApiError(res.status, first?.extensions?.code ?? 'ERROR', first?.message ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export interface Me {
  id: string;
  first_name: string | null;
  email: string;
}
export interface Course {
  id: string;
  key: string;
  title: string;
  subject?: string | null;
  ui_language: string;
  content_language: string;
  audio_enabled: boolean;
  new_per_session: number;
  modes: Array<'associations' | 'grammar' | 'arcade' | 'chat' | 'memory'>;
}
export interface MissionRef {
  key: string;
  title: string;
  index: number;
  total: number;
  next: { key: string; title: string } | null;
}
export interface Mission {
  key: string;
  title: string;
  index: number;
  total: number;
  worked: number;
  learned: number;
  /** Unidades de la misión que conviene repasar ya (se están olvidando). */
  due?: number;
  status: 'pending' | 'active' | 'done';
}
export interface StudioMission {
  id: string;
  key: string;
  title: string;
  status: string;
  total: number;
  draft: number;
  review: number;
  approved: number;
  published: number;
  rejected: number;
}
export interface SessionState {
  plan: AssocPlan;
  mission?: MissionRef;
  /** Ronda especial «Vacía tus fallos». */
  focus?: 'fallos';
  index: number;
  outcomes: Record<string, { correct: boolean; hint: number; expected?: string }>;
  finished: boolean;
}
export interface SessionPayload {
  state: SessionState;
  units: Record<string, SessionUnit>;
  resumed?: boolean;
  preview?: boolean;
  status?: string;
  /** Vista previa: si el curso tiene audio. */
  audio?: boolean;
}
export interface Progress {
  /** Días seguidos con actividad (D-072). */
  streak?: number;
  /** Simulacros de examen: mejor nota, cuántos y el último. */
  exam?: ExamStats;
  /** La racha más larga que ha tenido (para los logros). */
  bestStreak?: number;
  /** Respuestas por día de las últimas 12 semanas (84 días; el último es hoy). */
  calendar?: number[];
  /** Protectores de racha guardados (D-077). */
  shields?: number;
  todayAttempts?: number;
  /** Fallos pendientes: unidades falladas desde su último acierto. */
  failures?: number;
  /** Meta del día (D-081): unidades nuevas de hoy y la meta del curso (en idiomas, 35 ⇒ 1.000 en 30 días). */
  today?: { newUnits: number; goal: number };
  skills: Array<{ key: string; unit: string; kind: string; status: string; dueAt: number | null }>;
  units: Array<{ key: string; level: 'none' | 'learned' | 'stable' | 'mastered'; missing: string[] }>;
}

/** Resultado de un simulacro guardado en el servidor. */
export interface ExamResult { examId: string; grade: number; correct: number; total: number; ms: number; at: number }
export interface ExamStats { taken: number; best: ExamResult | null; last: ExamResult | null }
export interface ExamPayload { examId: string; guided?: boolean; available: boolean; need: number; worked: number; questions: ExamQuestion[]; units: Record<string, SessionUnit>; minutes: number; pass: number; stats: ExamStats }
export type ReportReason = 'asociacion' | 'significado' | 'respuesta' | 'audio' | 'otro';
/** Aviso de un alumno en Studio: un error reportado o un «Explícame más». */
export interface StudioRequest { id: string; unitId: string; unit: string; label: string; kind: 'error' | 'explain'; reason: ReportReason | null; note: string | null; times: number; at: number }
export interface Reto {
  key: string;
  skillKey: string | null;
  payload: import('@memora/content').MemoryChallengePayload;
  best: { before: number; after: number; reverse: number; tries: number } | null;
  status: string;
  dueAt: number | null;
}

export interface ImportResult {
  ok: boolean;
  problems: Array<{ path: string; where: string; message: string }>;
  courseId?: string;
  modules?: number;
  units?: number;
  associations?: number;
}

export const api = {
  login: (email: string, password: string, otp?: string) => request<unknown>('POST', '/auth/login', { email, password, mode: 'session', ...(otp ? { otp } : {}) }),
  logout: () => request<unknown>('POST', '/auth/logout', { mode: 'session' }).catch(() => undefined),
  me: () => request<Me>('GET', '/users/me?fields=id,first_name,email'),
  courses: () => request<Course[]>('GET', '/memora/courses'),
  whoami: () => request<{ staff: boolean }>('GET', '/memora/me'),
  session: (course: string, mission?: string, focus?: 'fallos') => request<SessionPayload>('GET', `/memora/session?course=${encodeURIComponent(course)}${mission ? `&mission=${encodeURIComponent(mission)}` : ''}${focus ? `&focus=${focus}` : ''}`),
  missions: (course: string) => request<{ missions: Mission[]; current: string | null; newToday?: number; newTarget?: number }>('GET', `/memora/missions?course=${encodeURIComponent(course)}`),
  studioMissions: (course: string) => request<StudioMission[]>('GET', `/memora/studio/missions?course=${encodeURIComponent(course)}`),
  retos: (course: string) => request<{ retos: Reto[] }>('GET', `/memora/retos?course=${encodeURIComponent(course)}`),
  offline: (course: string) => request<import('./offline').OfflineBundle>('GET', `/memora/offline?course=${encodeURIComponent(course)}`),
  previewMission: (id: string) => request<SessionPayload>('GET', `/memora/preview/mission/${encodeURIComponent(id)}`),
  approveMission: (id: string) => request<{ published: number; failed: Array<{ key: string; message: string }> }>('POST', `/memora/studio/approve/${encodeURIComponent(id)}`),
  importCourse: (file: unknown, check: boolean) => request<ImportResult>('POST', `/memora/import${check ? '?check=1' : ''}`, file),
  studioCourses: () => request<Array<{ id: string; key: string; title: string; status: string }>>('GET', '/memora/studio/courses'),
  exportCourse: (id: string) => request<unknown>('GET', `/memora/export/${encodeURIComponent(id)}`),
  preview: (unitId: string) => request<SessionPayload>('GET', `/memora/preview/${encodeURIComponent(unitId)}`),
  events: (course: string, events: ClientEvent[]) => request<{ accepted: string[]; duplicates: string[]; rejected: Array<{ id: string; reason: string }> }>('POST', '/memora/events', { course, events }),
  position: (course: string, body: { sessionId: string; index: number; outcomes: SessionState['outcomes']; finished: boolean; deviceId: string }) =>
    request<{ saved: boolean }>('PUT', '/memora/session/position', { course, ...body }),
  progress: (course: string) => request<Progress>('GET', `/memora/progress?course=${encodeURIComponent(course)}`),
  /** Empezar de cero en un curso (D-082): borra el progreso del alumno en ese curso, con copia previa. */
  resetProgress: (course: string, confirm: string) => request<{ events: number }>('POST', '/memora/reset', { course, confirm }),
  pushKey: () => request<{ publicKey: string | null }>('GET', '/memora/push/key'),
  pushSubscribe: (subscription: unknown, deviceId: string) => request<{ saved: boolean }>('POST', '/memora/push/subscribe', { subscription, deviceId }),
  pushTest: () => request<{ sent: number }>('POST', '/memora/push/test'),
  exam: (course: string, guided = false) => request<ExamPayload>('GET', `/memora/exam?course=${encodeURIComponent(course)}${guided ? '&modo=guiado' : ''}`),
  examResult: (course: string, body: { examId: string; correct: number; total: number; ms: number }) => request<{ saved: boolean; grade: number; stats: ExamStats }>('POST', '/memora/exam/result', { course, ...body }),
  /** «Reportar un error» de una tarjeta: va a la cola de avisos de Studio. */
  report: (course: string, unit: string, reason: ReportReason, note?: string) => request<{ saved: boolean }>('POST', '/memora/report', { course, unit, reason, ...(note ? { note } : {}) }),
  studioRequests: (course: string) => request<StudioRequest[]>('GET', `/memora/studio/requests?course=${encodeURIComponent(course)}`),
  closeRequest: (id: string, status: 'done' | 'dismissed') => request<{ saved: boolean }>('POST', `/memora/studio/requests/${encodeURIComponent(id)}`, { status }),
  clarify: (course: string, unit: string, step: string, note?: string) => request<{ saved: boolean }>('POST', '/memora/clarify', { course, unit, step, ...(note ? { note } : {}) }),
};

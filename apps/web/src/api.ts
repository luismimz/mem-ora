// Cliente de la API. La sesión va en una cookie httpOnly de Directus (modo `session`): no hay tokens en el navegador.
import type { AssocPlan, ClientEvent, SessionUnit } from '@memora/experiences';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
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
  modes: Array<'associations' | 'grammar' | 'arcade' | 'chat'>;
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
}
export interface Progress {
  skills: Array<{ key: string; unit: string; kind: string; status: string; dueAt: number | null }>;
  units: Array<{ key: string; level: 'none' | 'learned' | 'stable' | 'mastered'; missing: string[] }>;
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
  session: (course: string, mission?: string) => request<SessionPayload>('GET', `/memora/session?course=${encodeURIComponent(course)}${mission ? `&mission=${encodeURIComponent(mission)}` : ''}`),
  missions: (course: string) => request<{ missions: Mission[]; current: string | null }>('GET', `/memora/missions?course=${encodeURIComponent(course)}`),
  studioMissions: (course: string) => request<StudioMission[]>('GET', `/memora/studio/missions?course=${encodeURIComponent(course)}`),
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
};

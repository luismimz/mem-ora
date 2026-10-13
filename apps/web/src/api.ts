// Cliente de la API. La sesión va en una cookie httpOnly de Directus (modo `session`): no hay tokens en el navegador.
import type { ClientEvent, SessionPlan, SessionUnit } from '@memora/experiences';

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
  ui_language: string;
  content_language: string;
}
export interface SessionState {
  plan: SessionPlan;
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

export const api = {
  login: (email: string, password: string) => request<unknown>('POST', '/auth/login', { email, password, mode: 'session' }),
  logout: () => request<unknown>('POST', '/auth/logout', { mode: 'session' }).catch(() => undefined),
  me: () => request<Me>('GET', '/users/me?fields=id,first_name,email'),
  courses: () => request<Course[]>('GET', '/memora/courses'),
  session: (course: string) => request<SessionPayload>('GET', `/memora/session?course=${encodeURIComponent(course)}`),
  preview: (unitId: string) => request<SessionPayload>('GET', `/memora/preview/${encodeURIComponent(unitId)}`),
  events: (course: string, events: ClientEvent[]) => request<{ accepted: string[]; duplicates: string[]; rejected: Array<{ id: string; reason: string }> }>('POST', '/memora/events', { course, events }),
  position: (course: string, body: { sessionId: string; index: number; outcomes: SessionState['outcomes']; finished: boolean; deviceId: string }) =>
    request<{ saved: boolean }>('PUT', '/memora/session/position', { course, ...body }),
  progress: (course: string) => request<Progress>('GET', `/memora/progress?course=${encodeURIComponent(course)}`),
};

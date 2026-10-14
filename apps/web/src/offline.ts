// Modo sin conexión (H2.2b mínimo, D-054). Guarda en el dispositivo los paquetes descargados y una cola de respuestas
// pendientes. La cola NO es el progreso: el progreso vive en el servidor, que lo recalcula al recibir los eventos
// (idempotentes) en cuanto vuelve la conexión (regla 10).
import type { ClientEvent, SessionUnit } from '@memora/experiences';
import { api, type Me, type SessionState } from './api';

export interface OfflineSession { id: string; title: string; state: SessionState }
export interface OfflineBundle {
  course: { id: string; title: string; ui_language: string; audio_enabled?: boolean };
  generatedAt: number;
  sessions: OfflineSession[];
  units: Record<string, SessionUnit>;
}
interface Progress { index: number; outcomes: SessionState['outcomes']; finished: boolean }

const K = { bundles: 'memora.offline.bundles', outbox: 'memora.offline.outbox', progress: 'memora.offline.progress', me: 'memora.offline.me' };
const read = <T>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } };
const write = (k: string, v: unknown): boolean => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const bundles = (): Record<string, OfflineBundle> => read(K.bundles, {});
export function saveBundle(b: OfflineBundle): boolean {
  return write(K.bundles, { ...bundles(), [b.course.id]: b });
}
export async function downloadBundle(courseId: string): Promise<OfflineBundle> {
  const b = await api.offline(courseId);
  if (!saveBundle(b)) throw new Error('No hay espacio en el dispositivo para guardar el curso.');
  return b;
}

/** Avance dentro de cada sesión descargada (para retomarla en el avión). */
export const sessionProgress = (id: string): Progress | undefined => read<Record<string, Progress>>(K.progress, {})[id];
export function saveSessionProgress(id: string, p: Progress): void {
  write(K.progress, { ...read<Record<string, Progress>>(K.progress, {}), [id]: p });
}

/** Respuestas pendientes de enviar, por curso. */
export const outbox = (): Record<string, ClientEvent[]> => read(K.outbox, {});
export const pendingCount = (): number => Object.values(outbox()).reduce((n, l) => n + l.length, 0);
export function enqueue(courseId: string, events: ClientEvent[]): void {
  if (!events.length) return;
  const all = outbox();
  write(K.outbox, { ...all, [courseId]: [...(all[courseId] ?? []), ...events] });
}
/** Envía la cola al servidor. Devuelve cuántos eventos se han sincronizado. */
export async function flush(): Promise<number> {
  const all = outbox();
  let sent = 0;
  for (const [course, events] of Object.entries(all)) {
    for (let i = 0; i < events.length; i += 200) {
      await api.events(course, events.slice(i, i + 200));
      sent += Math.min(200, events.length - i);
    }
    const rest = outbox(); delete rest[course]; write(K.outbox, rest);
  }
  return sent;
}

/** Datos de la cuenta para poder abrir la app sin red. */
export const cachedMe = (): Me | null => read<Me | null>(K.me, null);
export const cacheMe = (me: Me) => write(K.me, me);

/** ¿Es un fallo de red (sin cobertura) y no un error del servidor? */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (e as { code?: string })?.code === 'OFFLINE';

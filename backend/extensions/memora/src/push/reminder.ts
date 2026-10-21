// Qué dice el aviso de repaso (D-077) y si toca enviarlo. Puro: recibe el estado del alumno y la hora.
export interface CourseState { courseId: string; title: string; skills: Record<string, { unitId: string; dueAt: number | null; attempts?: number }> }

export interface Reminder { title: string; body: string; url: string; due: number }

/** Unidades con algún repaso vencido, por curso; el aviso apunta al curso con más. */
export function reminderFor(states: CourseState[], streakDays: number, now: number): Reminder | null {
  const per = states.map((s) => ({ s, due: new Set(Object.values(s.skills).filter((k) => k.dueAt !== null && k.dueAt <= now && (k.attempts ?? 1) > 0).map((k) => k.unitId)).size }));
  const total = per.reduce((n, x) => n + x.due, 0);
  if (total === 0) return null;
  const top = per.sort((a, b) => b.due - a.due)[0]!;
  const fire = streakDays >= 2 ? ` Mantén tu racha de ${streakDays} días 🔥` : '';
  return {
    title: total === 1 ? 'Tienes 1 repaso listo' : `Tienes ${total} repasos listos`,
    body: `${top.s.title}: unos minutos ahora y no se te olvida.${fire}`,
    url: '/',
    due: total,
  };
}

/** Hora en Madrid (0–23): de noche no se avisa (D-077). */
export function madridHour(now: number): number {
  return Number(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hourCycle: 'h23' }).format(now));
}

/** Se avisa entre las 9:00 y las 21:59, como mucho una vez cada 12 horas. */
export function shouldRing(lastSentAt: number | null, now: number): boolean {
  const h = madridHour(now);
  return h >= 9 && h < 22 && (lastSentAt === null || now - lastSentAt >= 12 * 3600 * 1000);
}

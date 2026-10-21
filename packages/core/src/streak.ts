// Racha con protector (D-077): días seguidos con alguna respuesta. Cada 7 días activos se gana un protector (como
// mucho 2 guardados); si un día no se estudia y queda un protector, la racha no se rompe y el protector se gasta.
import type { DayActivity } from './learner';

export interface StreakOptions { shieldEvery: number; maxShields: number }
export const DEFAULT_STREAK: StreakOptions = { shieldEvery: 7, maxShields: 2 };

export interface Streak {
  /** Días de racha (los días cubiertos por un protector no suman, pero no la rompen). */
  days: number;
  /** Protectores guardados para el próximo día perdido. */
  shields: number;
  /** Días que salvó un protector en la racha actual. */
  saved: number;
}

export function streakOf(activity: Record<string, DayActivity>, today: number, options: StreakOptions = DEFAULT_STREAK): Streak {
  const active = (d: number) => (activity[String(d)]?.attempts ?? 0) > 0;
  const days = Object.keys(activity).map(Number).filter((d) => active(d) && d <= today);
  if (!days.length) return { days: 0, shields: 0, saved: 0 };
  let streak = 0, shields = 0, saved = 0, sinceShield = 0;
  for (let d = Math.min(...days); d <= today; d += 1) {
    if (active(d)) {
      streak += 1; sinceShield += 1;
      if (sinceShield >= options.shieldEvery) { shields = Math.min(options.maxShields, shields + 1); sinceShield = 0; }
    } else if (d === today) {
      // Hoy aún no ha estudiado: la racha sigue viva hasta que acabe el día.
    } else if (shields > 0) {
      shields -= 1; saved += 1;
    } else {
      streak = 0; saved = 0; sinceShield = 0;
    }
  }
  return { days: streak, shields, saved };
}

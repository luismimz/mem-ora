// Lee del servidor lo que necesita el aviso de repaso de un alumno (D-077).
import { dayOf, resolveConfig, streakOf, type LearnerState } from '@memora/core';
import { reminderFor, type Reminder } from './reminder';

const config = resolveConfig();
type Db = any; // knex de Directus

export async function reminderForUser(db: Db, userId: string, now = Date.now()): Promise<Reminder | null> {
  const rows = await db('learner_states').join('courses', 'learner_states.course', 'courses.id')
    .where({ 'learner_states.user': userId, 'courses.status': 'published' })
    .select('learner_states.snapshot', 'courses.id as course', 'courses.title');
  const today = dayOf(now, config.load.dayOriginMs, config.load.dayLengthMs);
  let streak = 0;
  const states = rows.map((r: { snapshot: unknown; course: string; title: string }) => {
    const l = (typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot) as LearnerState;
    streak = Math.max(streak, streakOf(l.activity ?? {}, today).days);
    return { courseId: r.course, title: r.title, skills: l.skills ?? {} };
  });
  return reminderFor(states, streak, now);
}

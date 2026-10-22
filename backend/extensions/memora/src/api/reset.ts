// «Empezar de cero» (D-082): el alumno borra SU progreso de UN curso para verlo todo desde el principio. Antes se guarda
// una copia completa (eventos, estado y posición) y, si la copia falla, no se borra nada. Solo toca a ese alumno y ese
// curso; el contenido no cambia.
type Row = Record<string, any>;

export interface ResetBackup { user: string; course: string; at: string; events: Row[]; states: Row[]; positions: Row[] }

export async function resetProgress(db: any, userId: string, courseId: string, saveBackup: (b: ResetBackup) => Promise<string>): Promise<{ events: number; backup: string }> {
  const where = { user: userId, course: courseId };
  const backup: ResetBackup = {
    user: userId, course: courseId, at: new Date().toISOString(),
    events: await db('learning_events').where(where).select('*'),
    states: await db('learner_states').where(where).select('*'),
    positions: await db('session_positions').where(where).select('*'),
  };
  const id = await saveBackup(backup);
  if (!id) throw new Error('No se pudo guardar la copia: no se ha borrado nada.');
  await db('learning_events').where(where).del();
  await db('learner_states').where(where).del();
  await db('session_positions').where(where).del();
  return { events: backup.events.length, backup: id };
}

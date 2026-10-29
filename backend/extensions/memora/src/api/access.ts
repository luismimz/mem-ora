// Qué asignaturas ve cada alumno (D-091). Un curso público lo ven todos; uno privado, su propietario y los alumnos
// elegidos (lista de emails en `visible_to`, que se edita desde la app o desde Studio).
type Row = Record<string, any>;

export const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();

export function audience(course: Row): string[] {
  const raw = typeof course.visible_to === 'string' ? safeParse(course.visible_to) : course.visible_to;
  return Array.isArray(raw) ? [...new Set(raw.map(normEmail).filter(Boolean))] : [];
}

function safeParse(t: string): unknown {
  try { return JSON.parse(t); } catch { return null; }
}

/** ¿Puede este alumno ver el curso? */
export function canSee(course: Row, userId: string, email: string | null | undefined): boolean {
  if (course.visibility !== 'private') return true;
  if (course.owner && course.owner === userId) return true;
  const e = normEmail(email);
  return Boolean(e) && audience(course).includes(e);
}

// Importar y exportar un curso completo en JSON (D-041). Importar: se comprueba TODO antes de escribir nada; luego se
// crea con los servicios de Directus (pasan los mismos ganchos de Studio y los permisos del rol) y todo entra como
// borrador. Si algo falla a mitad, se borra el curso creado (los módulos, unidades y asociaciones caen en cascada).
import { COURSE_FILE_VERSION, describeContentIssue, issue, unitPayload, validateCourseFile, type ContentIssue, type CourseFile, type UnitEntry } from '@memora/content';
import { validateAssociation } from '@memora/techniques';

type Row = Record<string, any>;
const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);

export interface ImportProblem {
  path: string;
  /** Dónde está, en palabras: «Módulo 1 › Unidad 3 (pain)». */
  where: string;
  message: string;
}

function where(file: Row, path: string): string {
  const m = path.match(/^modules\.(\d+)(?:\.units\.(\d+))?/);
  if (!m) return path.startsWith('course') ? 'Curso' : 'Archivo';
  const mod = file.modules?.[Number(m[1])];
  const base = `Módulo ${Number(m[1]) + 1}${mod?.key ? ` (${mod.key})` : ''}`;
  if (m[2] === undefined) return base;
  const unit = mod?.units?.[Number(m[2])];
  return `${base} › Unidad ${Number(m[2]) + 1}${unit?.key ? ` (${unit.key})` : ''}`;
}

/**
 * Comprueba el archivo completo, incluida la técnica de cada asociación. Modo normal: el curso no debe existir.
 * Modo «añadir» (`append`): el curso debe existir y sus módulos y unidades nuevos no pueden repetir claves.
 */
export async function checkCourseFile(db: any, file: unknown, append = false): Promise<ImportProblem[]> {
  const issues: ContentIssue[] = validateCourseFile(file);
  const f = file as Row;
  const isObj = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
  (Array.isArray(f?.modules) ? f.modules : []).forEach((m: unknown, mi: number) =>
    (isObj(m) && Array.isArray(m.units) ? m.units : []).forEach((u: unknown, ui: number) => {
      if (!isObj(u) || !isObj(u.association)) return;
      const a = u.association;
      for (const i of validateAssociation({ technique: a.technique, cue: a.cue, text: a.scene, evidence: a.evidence }, u.type)) {
        issues.push({ ...i, path: `modules.${mi}.units.${ui}.association${i.path ? `.${i.path}` : ''}` });
      }
    }),
  );
  const existing = isObj(f?.course) && typeof f.course.key === 'string' ? await db('courses').where({ key: f.course.key }).first('id') : undefined;
  if (!append && existing) issues.push(issue('course_exists', 'course.key', { key: f.course.key }));
  if (append && isObj(f?.course) && !existing) issues.push(issue('course_missing', 'course.key', { key: f.course.key }));
  if (append && existing) {
    const moduleKeys = new Set((await db('modules').where({ course: existing.id }).select('key')).map((r: Row) => r.key));
    const unitKeys = new Set((await db('units').where({ course: existing.id }).select('key')).map((r: Row) => r.key));
    (Array.isArray(f.modules) ? f.modules : []).forEach((m: unknown, mi: number) => {
      if (!isObj(m)) return;
      if (moduleKeys.has(m.key)) issues.push(issue('key_taken', `modules.${mi}.key`, { key: m.key }));
      (Array.isArray(m.units) ? m.units : []).forEach((u: unknown, ui: number) => {
        if (isObj(u) && unitKeys.has(u.key)) issues.push(issue('key_taken', `modules.${mi}.units.${ui}.key`, { key: u.key }));
      });
    });
  }
  // El «dónde» ya nombra el módulo y la unidad; el mensaje usa solo el resto de la ruta (p. ej., «significado»).
  const rest = (path: string) => path.replace(/^modules\.\d+(?:\.units\.\d+)?\.?/, '').replace(/^course\./, '');
  return issues.map((i) => ({ path: i.path, where: where(f ?? {}, i.path), message: describeContentIssue({ ...i, path: rest(i.path) }) }));
}

/**
 * Crea el curso como borrador o, en modo «añadir», agrega sus módulos al curso existente (también como borrador).
 * Devuelve el id del curso y los recuentos. Lanza si algo falla y deshace lo creado.
 */
export async function importCourse(services: any, schema: any, accountability: any, file: CourseFile, db?: any, append = false) {
  const svc = (c: string) => new services.ItemsService(c, { schema, accountability });
  const c = file.course;
  const origin = file.origin === 'ai' ? 'ai' : 'human';
  let courseId: string;
  let sort = 0;
  let moduleSort = 0;
  if (append) {
    courseId = (await db('courses').where({ key: c.key }).first('id')).id;
    sort = Number((await db('units').where({ course: courseId }).max('sort as m').first())?.m ?? -1) + 1;
    moduleSort = Number((await db('modules').where({ course: courseId }).max('sort as m').first())?.m ?? -1) + 1;
  } else {
    courseId = await svc('courses').createOne({
      key: c.key, title: c.title, subject: c.subject ?? null, status: 'draft',
      ui_language: c.uiLanguage ?? 'es', learner_language: c.learnerLanguage ?? 'es', content_language: c.contentLanguage,
      visibility: c.visibility ?? 'private', risk_level: c.riskLevel ?? 'low', license: c.license ?? null, sources: c.sources ?? null,
      description: c.description ?? null, new_per_session: c.newPerSession ?? 15, audio_enabled: c.audio ?? true,
      modes: c.modes ?? ['associations', 'grammar', 'arcade', 'chat'],
    });
  }
  const createdModules: string[] = [];
  const createdUnits: string[] = [];
  let associations = 0;
  try {
    for (const [mi, m] of file.modules.entries()) {
      const moduleId = await svc('modules').createOne({ course: courseId, key: m.key, title: m.title, sort: moduleSort + mi, status: 'draft' });
      createdModules.push(moduleId);
      for (const u of m.units) {
        const unitId = await svc('units').createOne({
          course: courseId, module: moduleId, key: u.key, type: u.type, sort: sort++, payload: unitPayload(u),
          license: u.license ?? c.license ?? null, sources: u.sources ?? c.sources ?? null,
        });
        createdUnits.push(unitId);
        if (u.association) {
          const a = u.association;
          await svc('associations').createOne({
            unit: unitId, technique: a.technique, cue: a.cue ?? null, text: a.scene, scene_target: a.sceneTarget ?? null,
            emoji: a.emoji ?? null, evidence: a.evidence ?? null, origin,
            license: u.license ?? c.license ?? null, sources: u.sources ?? c.sources ?? null,
          });
          associations += 1;
        }
      }
    }
  } catch (e) {
    const admin = (col: string) => new services.ItemsService(col, { schema });
    if (append) {
      if (createdUnits.length) await admin('units').deleteMany(createdUnits);
      if (createdModules.length) await admin('modules').deleteMany(createdModules);
    } else await admin('courses').deleteOne(courseId);
    throw e;
  }
  return { courseId, modules: file.modules.length, units: createdUnits.length, associations };
}

/** Exporta un curso al mismo formato que se importa (cualquier estado: es una copia del contenido). */
export async function exportCourse(db: any, courseId: string): Promise<CourseFile | null> {
  const course = await db('courses').where({ id: courseId }).first();
  if (!course) return null;
  const modules: Row[] = await db('modules').where({ course: courseId }).orderBy('sort');
  const units: Row[] = await db('units').where({ course: courseId }).whereNot({ status: 'deprecated' }).orderBy('sort');
  const assocs: Row[] = units.length ? await db('associations').whereIn('unit', units.map((u) => u.id)).whereNot({ status: 'rejected' }) : [];
  const opt = <T>(k: string, v: T | null | undefined) => (v === null || v === undefined || v === '' ? {} : { [k]: v });
  const unitEntry = (u: Row): UnitEntry => {
    const p = parse(u.payload) ?? {};
    const a = assocs.filter((x) => x.unit === u.id).sort((x, y) => (x.status === 'published' ? -1 : 0) - (y.status === 'published' ? -1 : 0))[0];
    return {
      key: u.key, type: u.type, ...p, examples: p.examples ?? [],
      ...(a ? { association: { technique: a.technique, ...opt('cue', a.cue), scene: a.text ?? '', ...opt('sceneTarget', a.scene_target), ...opt('emoji', a.emoji), ...opt('evidence', parse(a.evidence)) } } : {}),
      ...opt('license', u.license), ...opt('sources', parse(u.sources)),
    };
  };
  const loose = units.filter((u) => !modules.some((m) => m.id === u.module));
  const out: CourseFile['modules'] = modules.map((m) => ({ key: m.key, title: m.title, units: units.filter((u) => u.module === m.id).map(unitEntry) })).filter((m) => m.units.length);
  if (loose.length) out.push({ key: 'sin-modulo', title: 'Sin módulo', units: loose.map(unitEntry) });
  return {
    schemaVersion: COURSE_FILE_VERSION,
    course: {
      key: course.key, title: course.title, ...opt('subject', course.subject), uiLanguage: course.ui_language, learnerLanguage: course.learner_language,
      contentLanguage: course.content_language, newPerSession: course.new_per_session ?? 15, audio: course.audio_enabled !== false,
      modes: parse(course.modes) ?? ['associations', 'grammar', 'arcade', 'chat'], visibility: course.visibility, riskLevel: course.risk_level,
      ...opt('license', course.license), ...opt('sources', parse(course.sources)), ...opt('description', course.description),
    },
    modules: out,
  };
}

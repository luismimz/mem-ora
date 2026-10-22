// Contenido desde git (D-080): los cursos propios viven como JSON en `content/<curso>/NN-*.json` dentro del repositorio
// y se vuelcan a la base de datos al arrancar Directus en producción (cada despliegue). Así, fusionar un PR con contenido
// lo publica, sin depender del Mac del usuario ni de copiar claves. Fusionar es la orden de publicar (regla 10).
//
// Idempotente y conservador:
// - Curso o misión que no existe → se importa entera (mismas comprobaciones que «Importar» en Studio) y se publica.
// - Unidad que ya existe → solo se actualiza si su contenido cambió; conserva su id, sus habilidades y el progreso.
// - Asociación de una unidad → se actualiza si cambió el texto, el puente, la escena en inglés o el emoji.
// - Nunca borra nada. Material de ILERNA: nunca va en `content/` (regla 13), solo en `private/`.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { unitPayload, validateCourseFile, describeContentIssue, type CourseFile, type UnitEntry } from '@memora/content';
import { validateAssociation } from '@memora/techniques';
import { importCourse } from '../api/courseIO';

type Row = Record<string, any>;
const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);

/** JSON con las claves ordenadas: para comparar contenido sin que importe el orden de las claves. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as Row).filter((k) => (v as Row)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Row)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

/** Problemas de un archivo de curso (forma, contenido de cada unidad y técnica de cada asociación), en palabras. */
export function fileProblems(file: unknown): string[] {
  const issues = validateCourseFile(file);
  const f = file as CourseFile;
  (Array.isArray(f?.modules) ? f.modules : []).forEach((m, mi) => (m.units ?? []).forEach((u, ui) => {
    if (!u.association) return;
    const a = u.association;
    for (const i of validateAssociation({ technique: a.technique, cue: a.cue, text: a.scene, evidence: a.evidence }, u.type)) issues.push({ ...i, path: `modules.${mi}.units.${ui}.association${i.path ? `.${i.path}` : ''}` });
  }));
  return issues.map((i) => `${i.path}: ${describeContentIssue(i)}`);
}

/** Lo que guarda la base de datos de una asociación, a partir del archivo. */
export function associationRow(a: NonNullable<UnitEntry['association']>) {
  return { technique: a.technique, cue: a.cue ?? null, text: a.scene, scene_target: a.sceneTarget ?? null, emoji: a.emoji ?? null, evidence: a.evidence ?? null };
}

/** Archivos de un curso, en orden de misión. */
export function courseFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => /^\d{2}-.*\.json$/.test(f)).sort().map((f) => join(dir, f));
}

const PATH: Record<string, string[]> = { draft: ['needs_review', 'approved', 'published'], needs_review: ['approved', 'published'], approved: ['published'] };

export interface SyncReport { course: string; imported: string[]; updatedUnits: number; updatedAssociations: number; createdUnits: number; published: number; problems: string[] }

/** Vuelca un curso (una carpeta de `content/`) a la base de datos. Escribe como sistema (sin `accountability`). */
export async function syncCourse(dir: string, ctx: { db: any; services: any; schema: any }): Promise<SyncReport> {
  const { db, services, schema } = ctx;
  const svc = (c: string) => new services.ItemsService(c, { schema });
  const report: SyncReport = { course: dir, imported: [], updatedUnits: 0, updatedAssociations: 0, createdUnits: 0, published: 0, problems: [] };
  const touched = new Set<string>();

  for (const path of courseFiles(dir)) {
    let file: CourseFile;
    try { file = JSON.parse(readFileSync(path, 'utf8')); } catch (e: any) { report.problems.push(`${path}: JSON inválido (${e.message})`); continue; }
    const problems = fileProblems(file);
    if (problems.length) { report.problems.push(...problems.map((p) => `${path} · ${p}`)); continue; }
    report.course = file.course.key;
    const course = await db('courses').where({ key: file.course.key }).first('id');
    if (!course) {
      await importCourse(services, schema, null, file, db, false);
      report.imported.push(path);
      for (const m of await db('modules').where({ course: (await db('courses').where({ key: file.course.key }).first('id')).id }).select('id')) touched.add(m.id);
      continue;
    }
    for (const m of file.modules) {
      const mod = await db('modules').where({ course: course.id, key: m.key }).first('id', 'status');
      if (!mod) {
        await importCourse(services, schema, null, { ...file, modules: [m] }, db, true);
        report.imported.push(`${path} (${m.key})`);
        touched.add((await db('modules').where({ course: course.id, key: m.key }).first('id')).id);
        continue;
      }
      if (mod.status !== 'published') touched.add(mod.id);
      let sort = Number((await db('units').where({ course: course.id }).max('sort as m').first())?.m ?? -1) + 1;
      for (const u of m.units) {
        const unit = await db('units').where({ course: course.id, key: u.key }).first('id', 'payload', 'status', 'module');
        if (!unit) {
          const id = await svc('units').createOne({ course: course.id, module: mod.id, key: u.key, type: u.type, sort: sort++, payload: unitPayload(u), license: u.license ?? file.course.license ?? null, sources: u.sources ?? file.course.sources ?? null });
          if (u.association) await svc('associations').createOne({ unit: id, ...associationRow(u.association), origin: file.origin === 'ai' ? 'ai' : 'human', license: u.license ?? file.course.license ?? null, sources: u.sources ?? file.course.sources ?? null });
          report.createdUnits += 1; touched.add(mod.id);
          continue;
        }
        if (stable(parse(unit.payload)) !== stable(unitPayload(u))) { await svc('units').updateOne(unit.id, { payload: unitPayload(u) }); report.updatedUnits += 1; }
        if (unit.status !== 'published') touched.add(unit.module);
        if (!u.association) continue;
        const want = associationRow(u.association);
        const current = await db('associations').where({ unit: unit.id }).whereNot({ status: 'rejected' }).first('id', 'technique', 'cue', 'text', 'scene_target', 'emoji', 'evidence', 'status');
        if (!current) {
          await svc('associations').createOne({ unit: unit.id, ...want, origin: file.origin === 'ai' ? 'ai' : 'human', license: u.license ?? file.course.license ?? null, sources: u.sources ?? file.course.sources ?? null });
          report.updatedAssociations += 1; touched.add(unit.module);
          continue;
        }
        const now = { technique: current.technique, cue: current.cue, text: current.text, scene_target: current.scene_target, emoji: current.emoji, evidence: parse(current.evidence) ?? null };
        if (stable(now) !== stable(want)) { await svc('associations').updateOne(current.id, want); report.updatedAssociations += 1; }
        if (current.status !== 'published') touched.add(unit.module);
      }
    }
  }

  // Publicar lo nuevo o lo que quedó en borrador (como «Aprobar y publicar» en Studio).
  for (const moduleId of touched) {
    const units: Row[] = await db('units').where({ module: moduleId }).select('id', 'status');
    let ok = true;
    for (const u of units) {
      if (u.status === 'rejected' || u.status === 'deprecated') continue;
      try {
        for (const a of await db('associations').where({ unit: u.id }).whereIn('status', Object.keys(PATH)).select('id', 'status')) for (const next of PATH[a.status] ?? []) await svc('associations').updateOne(a.id, { status: next });
        for (const next of PATH[u.status] ?? []) await svc('units').updateOne(u.id, { status: next });
        if (u.status !== 'published') report.published += 1;
      } catch (e: any) { ok = false; report.problems.push(`publicar ${u.id}: ${e?.message ?? e}`); }
    }
    if (ok) {
      await svc('modules').updateOne(moduleId, { status: 'published' });
      const mod = await db('modules').where({ id: moduleId }).first('course');
      const course = await db('courses').where({ id: mod.course }).first('id', 'status');
      if (course?.status === 'draft') await svc('courses').updateOne(course.id, { status: 'published' });
    }
  }

  // Orden: misiones por su clave «NN-…» y sus unidades detrás, en orden.
  const courseKey = report.course;
  const course = await db('courses').where({ key: courseKey }).first('id');
  if (course) {
    const mods: Row[] = (await db('modules').where({ course: course.id }).select('id', 'key', 'sort')).sort((a: Row, b: Row) => String(a.key).localeCompare(String(b.key)));
    let unitSort = 0;
    for (const [i, m] of mods.entries()) {
      if (m.sort !== i) await db('modules').where({ id: m.id }).update({ sort: i });
      for (const u of await db('units').where({ module: m.id }).orderBy('sort').select('id', 'sort')) {
        if (u.sort !== unitSort) await db('units').where({ id: u.id }).update({ sort: unitSort });
        unitSort += 1;
      }
    }
  }
  return report;
}

/** Carpeta con el contenido dentro de la imagen de Directus (`deploy/directus.Dockerfile`). */
export function contentRoot(): string | null {
  const root = process.env.MEMORA_CONTENT_DIR ?? '/directus/content';
  return existsSync(root) && statSync(root).isDirectory() ? root : null;
}

export async function syncAll(ctx: { db: any; services: any; getSchema: () => Promise<any>; logger: any }): Promise<SyncReport[]> {
  const root = contentRoot();
  if (!root) return [];
  const schema = await ctx.getSchema();
  const reports: SyncReport[] = [];
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    try {
      const r = await syncCourse(dir, { db: ctx.db, services: ctx.services, schema });
      reports.push(r);
      ctx.logger.info(`[memora-content] ${r.course}: ${r.imported.length} misiones nuevas, ${r.createdUnits} unidades nuevas, ${r.updatedUnits} unidades y ${r.updatedAssociations} asociaciones actualizadas, ${r.published} publicadas${r.problems.length ? ` · ${r.problems.length} problemas: ${r.problems.slice(0, 5).join(' | ')}` : ''}`);
    } catch (e: any) {
      ctx.logger.error(`[memora-content] ${name}: ${e?.message ?? e}`);
    }
  }
  return reports;
}

// Extensión de Directus para Memora Studio (H2.1). Aplica en el servidor, para cualquier cliente (panel o API):
// - validación del contenido según su tipo y su técnica, con mensajes para el autor;
// - flujo de estados draft → needs_review → approved → published (con rejected y deprecated) por rol;
// - bloqueo del contenido en revisión, aprobado o publicado;
// - validación de la estructura del curso (prerrequisitos) con el validador del núcleo;
// - habilidades por defecto, versión al publicar, copia de lo publicado e historial de quién cambió qué.
// Las escrituras internas (sin `accountability`) no pasan por estas comprobaciones.
import { createError } from '@directus/errors';
import {
  checkTransition,
  DEFAULT_SKILLS,
  describeCatalogIssue,
  describeContentIssue,
  issue,
  LOCKED_STATUSES,
  validateUnitPayload,
  type ContentIssue,
  type ContentRole,
  type ContentStatus,
  type RiskLevel,
} from '@memora/content';
import { resolveConfig, validateCatalog, type CatalogIssue } from '@memora/core';
import { validateAssociation } from '@memora/techniques';
import { buildCatalog, type CatalogRows } from '../catalog';

type Row = Record<string, any>;
type Accountability = { user?: string | null; role?: string | null; admin?: boolean } | null | undefined;
type Knex = any;

interface HookContext {
  database: Knex;
  services: any;
  getSchema: () => Promise<any>;
  logger: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
}

const ContentInvalidError = createError<{ issues: Array<ContentIssue & { message: string }> }>(
  'MEMORA_CONTENT_INVALID',
  (ext) => ext.issues.map((i) => i.message).join(' '),
  400,
);

const config = resolveConfig();
const KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const CONTENT_FIELDS: Record<'units' | 'associations', string[]> = {
  units: ['course', 'module', 'key', 'type', 'language', 'payload', 'license', 'sources', 'risk_level'],
  associations: ['unit', 'technique', 'cue', 'text', 'scene_target', 'emoji', 'evidence', 'language', 'license', 'sources', 'origin'],
};
const ROLE_NAMES: Record<string, ContentRole> = { Autor: 'author', Revisor: 'reviewer' };

function fail(issues: ContentIssue[], extra: string[] = []): never {
  const described = issues.map((i) => ({ ...i, message: describeContentIssue(i) }));
  throw new ContentInvalidError({ issues: [...described, ...extra.map((message) => ({ code: 'detail', path: '', params: {}, message }))] });
}

function catalogFail(problems: CatalogIssue[]): never {
  const errors = problems.filter((p) => p.severity === 'error');
  const lines = errors.map((p) => {
    const t = describeCatalogIssue(p);
    return `${t.message} Cómo arreglarlo: ${t.fix}`;
  });
  fail([issue('catalog_invalid', '', { count: errors.length })], lines);
}

const hasSources = (value: unknown) => Array.isArray(value) && value.length > 0 && value.every((s) => s && typeof s === 'object' && typeof s.title === 'string' && s.title.trim());

export default ({ filter, action }: any, ctx: HookContext) => {
  const { database, services, getSchema, logger } = ctx;
  /** Cambios de estado validados en el filtro, pendientes de registrar en la acción posterior. */
  const pendingTransitions = new Map<string, { from: ContentStatus; to: ContentStatus; role: ContentRole | null; user: string | null }>();

  async function roleOf(acc: Accountability): Promise<ContentRole | null> {
    if (!acc) return null;
    if (acc.admin) return 'admin';
    if (!acc.role) return null;
    const role = await database('directus_roles').where({ id: acc.role }).first('name');
    return role ? (ROLE_NAMES[role.name] ?? null) : null;
  }

  const one = (collection: string, id: unknown): Promise<Row | undefined> => database(collection).where({ id }).first();
  const parseJson = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value);

  async function courseRows(courseId: string): Promise<CatalogRows> {
    const units = await database('units').where({ course: courseId }).whereNot({ status: 'deprecated' }).select('id', 'key', 'type', 'status');
    const unitIds = units.map((u: Row) => u.id);
    const skills = unitIds.length ? await database('skills').whereIn('unit', unitIds).select('id', 'key', 'kind', 'unit', 'association') : [];
    const prerequisites = await database('prerequisites').where({ course: courseId }).select('id', 'subject_unit', 'subject_skill', 'requires_unit', 'requires_skill');
    return { units, skills, prerequisites };
  }

  async function checkKey(collection: 'courses' | 'modules' | 'units' | 'skills', key: unknown, courseId: string | null, selfId?: string) {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) fail([issue('key_format', 'key')]);
    let query = database(collection).where({ key });
    if (collection === 'modules' || collection === 'units') query = query.andWhere({ course: courseId });
    if (collection === 'skills') query = query.whereIn('unit', database('units').where({ course: courseId }).select('id'));
    if (selfId) query = query.andWhereNot({ id: selfId });
    if (await query.first('id')) fail([issue('key_taken', 'key', { key })]);
  }

  async function contentIssues(collection: 'units' | 'associations', item: Row): Promise<ContentIssue[]> {
    if (collection === 'units') return validateUnitPayload(item.type, parseJson(item.payload));
    const unit = await one('units', item.unit);
    return validateAssociation({ technique: item.technique, cue: item.cue, text: item.text, evidence: parseJson(item.evidence) }, unit?.type ?? '');
  }

  // ─── Unidades y asociaciones: validación, flujo de estados y bloqueo ───────────────────────────────────
  for (const collection of ['units', 'associations'] as const) {
    filter(`${collection}.items.create`, async (payload: Row, _meta: any, { accountability }: { accountability: Accountability }) => {
      if (!accountability) return payload;
      const next: Row = { ...payload, status: 'draft', version: 0, reviewed_by: null, reviewed_at: null };
      if (collection === 'units') {
        const course = await one('courses', next.course);
        await checkKey('units', next.key, next.course ?? null);
        next.language ??= course?.content_language ?? null;
        next.payload = parseJson(next.payload);
      } else {
        const unit = await one('units', next.unit);
        const course = unit ? await one('courses', unit.course) : undefined;
        next.language ??= course?.learner_language ?? null;
        next.evidence = parseJson(next.evidence);
      }
      // Al crear se acepta un borrador incompleto, pero el contenido que se envía debe tener la forma correcta.
      const problems = (await contentIssues(collection, next)).filter((i) => !['required', 'min_items', 'too_short'].includes(i.code));
      if (problems.length) fail(problems);
      return next;
    });

    filter(`${collection}.items.update`, async (payload: Row, meta: { keys: string[] }, { accountability }: { accountability: Accountability }) => {
      if (!accountability) return payload;
      const role = await roleOf(accountability);
      const out: Row = { ...payload };
      for (const id of meta.keys) {
        const current = await one(collection, id);
        if (!current) continue;
        const from = current.status as ContentStatus;
        const to = (payload.status ?? from) as ContentStatus;
        const touchesContent = CONTENT_FIELDS[collection].some((field) => field in payload && JSON.stringify(payload[field]) !== JSON.stringify(parseJson(current[field])));

        // Editar el contenido solo se permite en borrador o rechazado (o al devolverlo a borrador en la misma acción).
        if (touchesContent && LOCKED_STATUSES.includes(from) && to !== 'draft') fail([issue('content_locked', 'status', { status: from })]);
        if (collection === 'units' && 'key' in payload) await checkKey('units', payload.key, payload.course ?? current.course, id);

        const merged = { ...current, ...payload };
        if (from !== to) {
          if (!role) fail([issue('transition_forbidden_for_role', 'status', { from, to, role: 'none', roles: 'author, reviewer, admin' })]);
          const problems = await contentIssues(collection, merged);
          const transition = checkTransition({
            from,
            to,
            role,
            actorId: accountability.user ?? '',
            authorId: current.user_created ?? null,
            risk: ((collection === 'units' ? merged.risk_level : (await one('units', merged.unit))?.risk_level) ?? 'low') as RiskLevel,
            contentIssues: problems,
            hasSource: hasSources(parseJson(merged.sources)),
            hasLicense: Boolean(merged.license),
            reviewed: Boolean(current.reviewed_by),
          });
          if (transition.length) fail(transition, problems.map((p) => describeContentIssue(p)));

          if (collection === 'units' && to === 'published') await checkPublishStructure(current);
          if (to === 'approved') Object.assign(out, { reviewed_by: accountability.user, reviewed_at: new Date().toISOString() });
          if (to === 'draft' || to === 'needs_review') Object.assign(out, { reviewed_by: null, reviewed_at: null });
          if (to === 'published') {
            out.version = Number(current.version ?? 0) + 1;
            if (collection === 'units') out.published_at = new Date().toISOString();
          }
          pendingTransitions.set(`${collection}:${id}`, { from, to, role, user: accountability.user ?? null });
        } else if (touchesContent) {
          // Guardar un borrador con problemas está permitido, salvo errores de forma (tipo, campos inexistentes).
          const problems = (await contentIssues(collection, merged)).filter((i) => !['required', 'min_items', 'too_short'].includes(i.code));
          if (problems.length) fail(problems);
        }
      }
      return out;
    });

    action(`${collection}.items.update`, async ({ keys }: { keys: string[] }, { accountability }: { accountability: Accountability }) => {
      const schema = await getSchema();
      const events = new services.ItemsService('review_events', { schema });
      for (const id of keys) {
        const t = pendingTransitions.get(`${collection}:${id}`);
        if (!t) continue;
        pendingTransitions.delete(`${collection}:${id}`);
        const item = await one(collection, id);
        await events.createOne({ collection, item: id, item_key: item?.key ?? item?.cue ?? null, from_status: t.from, to_status: t.to, user: t.user, role: t.role });
        if (t.to === 'published' && item) {
          await new services.ItemsService('content_versions', { schema }).createOne({ collection, item: id, version: item.version, snapshot: item, user: accountability?.user ?? null });
          const courseId = collection === 'units' ? item.course : (await one('units', item.unit))?.course;
          if (courseId) await database('courses').where({ id: courseId }).increment('content_revision', 1);
        }
      }
    });
  }


  /** Al publicar una unidad: la estructura del curso es válida y todo lo que exige ya está publicado. */
  async function checkPublishStructure(unit: Row) {
    const rows = await courseRows(unit.course);
    const problems = validateCatalog(buildCatalog(rows), config);
    if (problems.some((p) => p.severity === 'error')) catalogFail(problems);
    const unitSkills = rows.skills.filter((s) => s.unit === unit.id).map((s) => s.id);
    const required = rows.prerequisites.filter((p) => p.subject_unit === unit.id || (p.subject_skill !== null && unitSkills.includes(p.subject_skill)));
    for (const p of required) {
      const target = p.requires_unit ? rows.units.find((u) => u.id === p.requires_unit) : rows.units.find((u) => u.id === rows.skills.find((s) => s.id === p.requires_skill)?.unit);
      if (target && target.status !== 'published') fail([issue('requires_unpublished', 'status', { key: target.key })]);
    }
  }

  // Al crear una unidad, sus habilidades por defecto; al crear una asociación, se vincula a la habilidad que la recupera.
  action('units.items.create', async ({ key, payload }: { key: string; payload: Row }) => {
    const unit = await one('units', key);
    const template = unit ? DEFAULT_SKILLS[unit.type as keyof typeof DEFAULT_SKILLS] : undefined;
    if (!unit || !template || payload.skills?.length) return;
    const service = new services.ItemsService('skills', { schema: await getSchema() });
    await service.createMany(template.map((t, sort) => ({ unit: unit.id, key: `${unit.key}.${t.suffix}`, kind: t.kind, sort })));
  });

  action('associations.items.create', async ({ key }: { key: string }) => {
    const association = await one('associations', key);
    if (!association) return;
    const unit = await one('units', association.unit);
    const template = unit ? DEFAULT_SKILLS[unit.type as keyof typeof DEFAULT_SKILLS] : undefined;
    const suffix = template?.find((t) => t.carriesAssociation)?.suffix;
    if (!unit || !suffix) return;
    await database('skills').where({ unit: unit.id, key: `${unit.key}.${suffix}` }).whereNull('association').update({ association: association.id });
  });

  // ─── Habilidades y prerrequisitos: claves, bloqueo y estructura del curso ──────────────────────────────
  async function unitLocked(unitId: unknown) {
    const unit = await one('units', unitId);
    if (unit && LOCKED_STATUSES.includes(unit.status)) fail([issue('parent_locked', 'unit', { key: unit.key, status: unit.status })]);
    return unit;
  }

  filter('skills.items.create', async (payload: Row, _m: any, { accountability }: { accountability: Accountability }) => {
    if (!accountability) return payload;
    const unit = await unitLocked(payload.unit);
    await checkKey('skills', payload.key, unit?.course ?? null);
    return payload;
  });
  filter('skills.items.update', async (payload: Row, meta: { keys: string[] }, { accountability }: { accountability: Accountability }) => {
    if (!accountability) return payload;
    for (const id of meta.keys) {
      const skill = await one('skills', id);
      const unit = await unitLocked(payload.unit ?? skill?.unit);
      if ('key' in payload) await checkKey('skills', payload.key, unit?.course ?? null, id);
    }
    return payload;
  });
  filter('skills.items.delete', async (keys: string[], _m: any, { accountability }: { accountability: Accountability }) => {
    if (!accountability) return keys;
    for (const id of keys) await unitLocked((await one('skills', id))?.unit);
    return keys;
  });

  async function checkPrerequisite(p: Row, selfId?: string) {
    const subjects = [p.subject_unit, p.subject_skill].filter(Boolean).length;
    const requirements = [p.requires_unit, p.requires_skill].filter(Boolean).length;
    if (subjects !== 1 || requirements !== 1) fail([issue('prerequisite_needs_both_sides', '')]);
    const rows = await courseRows(p.course);
    const others = rows.prerequisites.filter((x) => x.id !== selfId);
    const candidate = { id: selfId ?? 'nuevo', subject_unit: p.subject_unit ?? null, subject_skill: p.subject_skill ?? null, requires_unit: p.requires_unit ?? null, requires_skill: p.requires_skill ?? null };
    const problems = validateCatalog(buildCatalog({ ...rows, prerequisites: [...others, candidate] }), config);
    if (problems.some((x) => x.severity === 'error')) catalogFail(problems);
  }
  filter('prerequisites.items.create', async (payload: Row, _m: any, { accountability }: { accountability: Accountability }) => {
    if (!accountability) return payload;
    await checkPrerequisite(payload);
    return payload;
  });
  filter('prerequisites.items.update', async (payload: Row, meta: { keys: string[] }, { accountability }: { accountability: Accountability }) => {
    if (!accountability) return payload;
    for (const id of meta.keys) await checkPrerequisite({ ...(await one('prerequisites', id)), ...payload }, id);
    return payload;
  });

  // ─── Cursos y módulos: identificadores ─────────────────────────────────────────────────────────────────
  filter('courses.items.create', async (payload: Row, _m: any, { accountability }: { accountability: Accountability }) => {
    if (!accountability) return payload;
    await checkKey('courses', payload.key, null);
    return { owner: accountability.user ?? null, ...payload };
  });
  filter('modules.items.create', async (payload: Row, _m: any, { accountability }: { accountability: Accountability }) => {
    if (!accountability) return payload;
    await checkKey('modules', payload.key, payload.course ?? null);
    return payload;
  });

  logger.info('[memora] extensión de Studio cargada');
};


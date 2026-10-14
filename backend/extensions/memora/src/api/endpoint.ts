// Endpoint `/memora` para la app del alumno (H2.2a). El alumno no lee colecciones directamente (D-029): todo pasa por
// aquí, que aplica la visibilidad de los cursos, valida los eventos y recalcula su estado en el servidor.
//   GET  /memora/courses                 cursos visibles para el alumno
//   GET  /memora/session?course=…        sesión de hoy (la reanuda si ya estaba empezada)
//   POST /memora/events                  eventos idempotentes; devuelve el estado recalculado
//   PUT  /memora/session/position        punto exacto de la sesión
//   GET  /memora/progress?course=…       estado por habilidad, unidad y asociación
//   GET  /memora/preview/:unitId         vista previa como alumno (solo autoría, revisión y administración)
//   POST /memora/import?check=1          importa un curso completo en JSON como borrador (o solo lo comprueba)
//   GET  /memora/export/:courseId        exporta un curso al mismo formato
//   GET  /memora/studio/courses          cursos de cualquier estado, para exportar (autoría)
import { createHash, randomUUID } from 'node:crypto';
import { describeContentIssue, validateUnitPayload } from '@memora/content';
import { assessAssociation, dayOf, planDay, resolveConfig, unitLevel, type PlanItem } from '@memora/core';
import { buildAssociationSession, type AssocPlan, type SessionPlan, type SessionUnit } from '@memora/experiences';
import { buildCatalog } from '../catalog';
import { checkCourseFile, exportCourse, importCourse } from './courseIO';
import { effectiveTime, MAX_EVENTS_PER_BATCH, recompute, rejectReason, sessionUnits, skillIndex, type AssociationRow, type SkillRow, type StoredEvent, type UnitRow } from './learning';

type Row = Record<string, any>;
const config = resolveConfig();
const STAFF_ROLES = new Set(['Autor', 'Revisor']);

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

/** Ritmo del curso: N unidades nuevas por sesión (cada una con unas 3 habilidades). Configuración, no lógica (D-037). */
function courseConfig(course: Row) {
  const perSession = Math.max(1, Number(course.new_per_session) || 15);
  // El tope diario admite varias sesiones (meta de ≈1.000 al mes ⇒ 2–3 sesiones al día); cada sesión trae como mucho perSession.
  return resolveConfig({ load: { newCap: perSession * 3 * 3, minNewPerDay: Math.min(perSession * 3, 9), reviewCap: 120, totalCap: perSession * 3 * 3 + 120 } });
}

export interface SessionState {
  plan: SessionPlan | AssocPlan;
  index: number;
  outcomes: Record<string, { correct: boolean; hint: number; expected?: string }>;
  finished: boolean;
}

export default {
  id: 'memora',
  handler: (router: any, ctx: { database: any; logger: any; services: any; getSchema: () => Promise<any> }) => {
    const { database: db, logger, services, getSchema } = ctx;
    const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);

    const wrap = (fn: (req: any) => Promise<unknown>) => async (req: any, res: any) => {
      try {
        if (!req.accountability?.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Inicia sesión.');
        res.json(await fn(req));
      } catch (e) {
        const err = e instanceof HttpError ? e : new HttpError(500, 'INTERNAL', 'Error interno.');
        if (!(e instanceof HttpError)) logger.error(e, '[memora-api]');
        res.status(err.status).json({ errors: [{ message: err.message, extensions: { code: err.code } }] });
      }
    };

    async function visibleCourse(courseId: unknown, userId: string): Promise<Row> {
      if (typeof courseId !== 'string' || !courseId) throw new HttpError(400, 'BAD_REQUEST', 'Falta el curso.');
      const course = await db('courses').where({ id: courseId, status: 'published' }).first();
      if (!course || (course.visibility === 'private' && course.owner !== userId)) throw new HttpError(404, 'NOT_FOUND', 'Curso no disponible.');
      return course;
    }

    async function publishedContent(course: Row) {
      const units: UnitRow[] = await db('units')
        .leftJoin('modules', 'units.module', 'modules.id')
        .where({ 'units.course': course.id, 'units.status': 'published' })
        .orderBy([{ column: 'modules.sort', order: 'asc' }, { column: 'units.sort', order: 'asc' }, { column: 'units.date_created', order: 'asc' }])
        .select('units.id', 'units.key', 'units.type', 'units.language', 'units.payload', 'units.version', 'units.status', 'modules.title as place');
      const ids = units.map((u) => u.id);
      const skills: SkillRow[] = ids.length ? await db('skills').whereIn('unit', ids).select('id', 'key', 'kind', 'unit', 'association', 'sort') : [];
      const associations: AssociationRow[] = ids.length ? await db('associations').whereIn('unit', ids).select('id', 'unit', 'technique', 'cue', 'text', 'status', 'scene_target', 'emoji', 'evidence') : [];
      const prerequisites = await db('prerequisites').where({ course: course.id }).select('id', 'subject_unit', 'subject_skill', 'requires_unit', 'requires_skill');
      const sUnits = sessionUnits(units, skills, associations, course.content_language);
      const publishedAssoc = new Set(associations.filter((a) => a.status === 'published').map((a) => a.id));
      // Las habilidades siguen el orden de sus unidades (módulo y orden): así lo nuevo entra escena a escena.
      const unitOrder = new Map(units.map((u, i) => [u.id, i]));
      skills.sort((a, b) => (unitOrder.get(a.unit)! - unitOrder.get(b.unit)!) || (a.sort ?? 0) - (b.sort ?? 0));
      const catalog = buildCatalog({
        units: units.map((u: Row) => ({ id: u.id, key: u.key, type: u.type, status: 'published' })),
        skills: skills.map((s) => ({ id: s.id, key: s.key, kind: s.kind, unit: s.unit, association: s.association && publishedAssoc.has(s.association) ? s.association : null })),
        prerequisites,
      });
      return { units: sUnits, catalog };
    }

    async function storedEvents(userId: string, courseId: string): Promise<StoredEvent[]> {
      const rows = await db('learning_events').where({ user: userId, course: courseId }).select('event_id', 'kind', 'payload', 'device_time', 'received_at');
      return rows.map((r: Row) => ({ event_id: r.event_id, kind: r.kind, payload: parse(r.payload), device_time: new Date(r.device_time).getTime() }));
    }

    async function learnerFor(userId: string, courseId: string) {
      const { learner, skipped } = recompute(userId, await storedEvents(userId, courseId), config);
      if (skipped.length) logger.warn(`[memora-api] ${skipped.length} eventos ignorados al recalcular (${userId})`);
      const snapshot = JSON.stringify(learner);
      const existing = await db('learner_states').where({ user: userId, course: courseId }).first('id');
      if (existing) await db('learner_states').where({ id: existing.id }).update({ snapshot, date_updated: new Date() });
      else await db('learner_states').insert({ id: randomUUID(), user: userId, course: courseId, snapshot, date_updated: new Date() });
      return learner;
    }

    async function savePosition(userId: string, courseId: string, state: SessionState, deviceId: string | null) {
      const step = state.plan.steps[state.index]?.kind ?? 'done';
      const row = { session_id: state.plan.sessionId, step, state: JSON.stringify(state), device_id: deviceId, device_time: new Date(), date_updated: new Date() };
      const existing = await db('session_positions').where({ user: userId, course: courseId }).first('id');
      if (existing) await db('session_positions').where({ id: existing.id }).update(row);
      else await db('session_positions').insert({ id: randomUUID(), user: userId, course: courseId, ...row });
    }

    // Quién soy: el alumno no lee roles; la app solo necesita saber si puede usar el modo revisión.
    router.get('/me', wrap(async (req) => {
      const acc = req.accountability;
      const role = acc.role ? await db('directus_roles').where({ id: acc.role }).first('name') : null;
      return { data: { staff: Boolean(acc.admin || (role && STAFF_ROLES.has(role.name))) } };
    }));

    router.get('/courses', wrap(async (req) => {
      const userId = req.accountability.user;
      const rows = await db('courses')
        .where({ status: 'published' })
        .andWhere((q: any) => q.where({ visibility: 'public' }).orWhere({ owner: userId }))
        .select('id', 'key', 'title', 'subject', 'ui_language', 'learner_language', 'content_language', 'content_revision', 'audio_enabled', 'new_per_session', 'modes');
      // Sin configurar ⇒ todos los modos.
      return { data: rows.map((r: Row) => ({ ...r, modes: (typeof r.modes === 'string' ? JSON.parse(r.modes) : r.modes) ?? ['associations', 'grammar', 'arcade', 'chat'] })) };
    }));

    router.get('/session', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.query.course, userId);
      const { units, catalog } = await publishedContent(course);
      const now = Date.now();
      const today = dayOf(now, config.load.dayOriginMs, config.load.dayLengthMs);
      const saved = await db('session_positions').where({ user: userId, course: course.id }).first();
      const savedState: SessionState | null = saved ? parse(saved.state) : null;
      if (savedState && savedState.plan.day === today && !savedState.finished && savedState.plan.steps.every((s: { unitKey: string }) => !s.unitKey || units[s.unitKey])) {
        return { data: { state: savedState, units, resumed: true } };
      }
      const learner = await learnerFor(userId, course.id);
      const cfg = courseConfig(course);
      const plan = planDay({ catalog, learner, now, config: cfg });
      const modes: string[] = (typeof course.modes === 'string' ? JSON.parse(course.modes) : course.modes) ?? ['associations', 'grammar', 'arcade', 'chat'];
      // Sin Arcade en el curso, nunca salta el Arcade sorpresa.
      const knownUnits = !modes.includes('arcade') ? [] : [...new Set(Object.values(learner.skills).filter((x) => x.attempts > 0).map((x) => x.unitId))];
      const session = buildAssociationSession({ sessionId: randomUUID(), courseId: course.id, day: today, createdAt: now, items: plan.items as PlanItem[], units, knownUnits, maxNewUnits: Math.max(1, Number(course.new_per_session) || 15) });
      const state: SessionState = { plan: session, index: 0, outcomes: {}, finished: session.steps.length === 0 };
      await savePosition(userId, course.id, state, null);
      return { data: { state, units, resumed: false, stats: plan.stats } };
    }));

    router.post('/events', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.body?.course, userId);
      const events: unknown[] = Array.isArray(req.body?.events) ? req.body.events : [];
      if (!events.length || events.length > MAX_EVENTS_PER_BATCH) throw new HttpError(400, 'BAD_REQUEST', `Envía entre 1 y ${MAX_EVENTS_PER_BATCH} eventos.`);
      const { units } = await publishedContent(course);
      const skills = skillIndex(units);
      const receivedAt = Date.now();
      const accepted: string[] = [];
      const duplicates: string[] = [];
      const rejected: Array<{ id: unknown; reason: string }> = [];
      for (const raw of events) {
        const reason = rejectReason(raw, skills, course.id);
        const e = raw as Row;
        if (reason) {
          rejected.push({ id: e?.id, reason });
          continue;
        }
        const eventKey = createHash('sha256').update(`${userId}:${e.id}`).digest('hex');
        const inserted = await db('learning_events')
          .insert({
            event_key: eventKey,
            event_id: e.id,
            user: userId,
            course: course.id,
            kind: e.kind,
            payload: JSON.stringify(e),
            device_id: e.deviceId,
            device_seq: e.seq,
            device_time: new Date(effectiveTime(e.at, receivedAt)),
            received_at: new Date(receivedAt),
            schema_version: 1,
          })
          .onConflict('event_key')
          .ignore()
          .returning('id');
        (inserted.length ? accepted : duplicates).push(e.id);
      }
      const learner = await learnerFor(userId, course.id);
      const touched = new Set((events as Row[]).map((e) => e?.skillKey).filter(Boolean));
      const state = Object.fromEntries([...touched].map((k) => [k, learner.skills[k] ? { status: learner.skills[k]!.status, dueAt: learner.skills[k]!.dueAt } : null]));
      return { data: { accepted, duplicates, rejected, skills: state } };
    }));

    router.put('/session/position', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.body?.course, userId);
      const saved = await db('session_positions').where({ user: userId, course: course.id }).first();
      const state: SessionState | null = saved ? parse(saved.state) : null;
      if (!state || state.plan.sessionId !== req.body?.sessionId) throw new HttpError(409, 'SESSION_CHANGED', 'La sesión ha cambiado; vuelve a cargarla.');
      const index = Number(req.body.index);
      if (!Number.isInteger(index) || index < 0 || index > state.plan.steps.length) throw new HttpError(400, 'BAD_REQUEST', 'Posición no válida.');
      const next: SessionState = { ...state, index, outcomes: typeof req.body.outcomes === 'object' && req.body.outcomes ? req.body.outcomes : state.outcomes, finished: Boolean(req.body.finished) || index >= state.plan.steps.length };
      await savePosition(userId, course.id, next, typeof req.body.deviceId === 'string' ? req.body.deviceId.slice(0, 64) : null);
      return { data: { saved: true, index: next.index, finished: next.finished } };
    }));

    router.get('/progress', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.query.course, userId);
      const { catalog } = await publishedContent(course);
      const learner = await learnerFor(userId, course.id);
      return {
        data: {
          skills: catalog.skills.map((s) => ({ key: s.id, unit: s.unitId, kind: s.kind, status: learner.skills[s.id]?.status ?? 'new', dueAt: learner.skills[s.id]?.dueAt ?? null })),
          units: catalog.units.map((u) => {
            const r = unitLevel(u.id, catalog, learner.skills, config);
            return { key: u.id, level: r.level, missing: r.missing };
          }),
          associations: Object.values(learner.associations).map((a) => ({ id: a.associationId, hintLevel: a.hintLevel, dueAt: a.dueAt, status: a.status, ...assessAssociation(a, config) })),
        },
      };
    }));

    async function requireStaff(acc: Row, what: string) {
      const role = acc.role ? await db('directus_roles').where({ id: acc.role }).first('name') : null;
      if (!acc.admin && !(role && STAFF_ROLES.has(role.name))) throw new HttpError(403, 'FORBIDDEN', `${what} es solo para autoría, revisión y administración.`);
    }

    router.post('/import', wrap(async (req) => {
      await requireStaff(req.accountability, 'Importar');
      const problems = await checkCourseFile(db, req.body);
      if (problems.length) return { data: { ok: false, problems } };
      if (req.query.check) return { data: { ok: true, problems: [] } };
      try {
        const result = await importCourse(services, await getSchema(), req.accountability, req.body);
        return { data: { ok: true, problems: [], ...result } };
      } catch (e: any) {
        // Lo que rechace Studio (ganchos o permisos) se devuelve como problema; no queda nada a medias.
        const message = e?.extensions?.issues?.map((i: Row) => i.message).join(' ') || e?.message || 'Error al crear.';
        return { data: { ok: false, problems: [{ path: '', where: 'Studio', message }] } };
      }
    }));

    router.get('/studio/courses', wrap(async (req) => {
      await requireStaff(req.accountability, 'Exportar');
      return { data: await db('courses').orderBy('title').select('id', 'key', 'title', 'status') };
    }));

    router.get('/export/:courseId', wrap(async (req) => {
      await requireStaff(req.accountability, 'Exportar');
      const file = await exportCourse(db, req.params.courseId);
      if (!file) throw new HttpError(404, 'NOT_FOUND', 'Curso no encontrado.');
      return { data: file };
    }));

    router.get('/preview/:unitId', wrap(async (req) => {
      await requireStaff(req.accountability, 'La vista previa');
      const unit = await db('units').where({ id: req.params.unitId }).first();
      if (!unit) throw new HttpError(404, 'NOT_FOUND', 'Unidad no encontrada.');
      const issues = validateUnitPayload(unit.type, parse(unit.payload));
      if (issues.length) throw new HttpError(422, 'CONTENT_INVALID', `La unidad aún tiene problemas: ${issues.map((i) => describeContentIssue(i)).join(' ')}`);
      const course = await db('courses').where({ id: unit.course }).first();
      const skills: SkillRow[] = await db('skills').where({ unit: unit.id }).select('id', 'key', 'kind', 'unit', 'association', 'sort');
      // En la vista previa se muestran también asociaciones en borrador, marcadas como tales.
      const associations: AssociationRow[] = (await db('associations').where({ unit: unit.id }).select('id', 'unit', 'technique', 'cue', 'text', 'status', 'scene_target', 'emoji', 'evidence')).map((a: Row) => ({ ...a, status: 'published' }));
      const units: Record<string, SessionUnit> = sessionUnits([unit], skills, associations, course?.content_language ?? 'en');
      const items: PlanItem[] = skills.map((s) => ({ skillId: s.key, unitId: unit.key, reason: 'new', priority: 0, recommendedHint: 0, ...(units[unit.key]?.skills.find((x) => x.key === s.key)?.associationId ? { associationId: units[unit.key]!.skills.find((x) => x.key === s.key)!.associationId! } : {}) }));
      const plan = buildAssociationSession({ sessionId: `preview-${unit.id}`, courseId: unit.course, day: 0, createdAt: Date.now(), items, units, knownUnits: [] });
      return { data: { state: { plan, index: 0, outcomes: {}, finished: false }, units, preview: true, status: unit.status } };
    }));
  },
};

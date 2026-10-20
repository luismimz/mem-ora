// Endpoint `/memora` para la app del alumno (H2.2a). El alumno no lee colecciones directamente (D-029): todo pasa por
// aquí, que aplica la visibilidad de los cursos, valida los eventos y recalcula su estado en el servidor.
//   GET  /memora/courses                 cursos visibles para el alumno
//   GET  /memora/session?course=…        sesión de hoy (la reanuda si ya estaba empezada)
//   POST /memora/events                  eventos idempotentes; devuelve el estado recalculado
//   PUT  /memora/session/position        punto exacto de la sesión
//   GET  /memora/progress?course=…       estado por habilidad, unidad y asociación
//   GET  /memora/missions?course=…       misiones (módulos) del curso con el avance del alumno y la actual
//   GET  /memora/offline?course=…        paquete para jugar sin conexión: sesiones listas (repasos + misiones pendientes)
//   GET  /memora/retos?course=…          retos de memoria del curso con el mejor resultado del alumno y su repaso
//   GET  /memora/studio/missions?course=… misiones con el estado de revisión de sus unidades (autoría)
//   GET  /memora/preview/mission/:id     prueba una misión entera como alumno, borradores incluidos (autoría)
//   POST /memora/studio/approve/:id      revisa, aprueba y publica una misión entera con la cuenta que la pide
//   GET  /memora/preview/:unitId         vista previa como alumno (solo autoría, revisión y administración)
//   POST /memora/import?check=1&append=1 importa un curso en JSON como borrador, o añade módulos a uno existente
//   GET  /memora/export/:courseId        exporta un curso al mismo formato
//   GET  /memora/studio/courses          cursos de cualquier estado, para exportar (autoría)
import { createHash, randomUUID } from 'node:crypto';
import { describeContentIssue, validateUnitPayload } from '@memora/content';
import { assessAssociation, dayOf, focusCatalog, newUnitsFor, planDay, resolveConfig, unitLevel, type PlanItem } from '@memora/core';
import { buildAssociationSession, buildFlowSession, type AssocPlan, type SessionPlan, type SessionUnit } from '@memora/experiences';
import { buildCatalog } from '../catalog';
import { checkCourseFile, exportCourse, importCourse } from './courseIO';
import type { Catalog, LearnerState as Learner } from '@memora/core';
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

export interface MissionRef {
  key: string;
  title: string;
  /** Posición (1, 2…) y total de misiones del curso. */
  index: number;
  total: number;
  next: { key: string; title: string } | null;
}

export interface SessionState {
  plan: SessionPlan | AssocPlan;
  /** Misión de la sesión: solo entra contenido nuevo de ella (los repasos vencidos, de todo el curso). */
  mission?: MissionRef;
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
        .select('units.id', 'units.key', 'units.type', 'units.language', 'units.payload', 'units.version', 'units.status', 'units.date_updated', 'modules.title as place', 'modules.key as module_key');
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
      // Misiones = módulos con unidades publicadas, en su orden. Las unidades sin módulo forman una misión aparte.
      const missions: Array<{ key: string; title: string; units: string[] }> = [];
      for (const u of units as Array<UnitRow & { module_key?: string | null; place?: string | null }>) {
        const key = u.module_key ?? 'sin-mision';
        let m = missions.find((x) => x.key === key);
        if (!m) missions.push((m = { key, title: u.place ?? 'Sin misión', units: [] }));
        m.units.push(u.key);
      }
      // Última modificación de cada unidad (contenido o asociación republicada): sirve para volver a enseñarla (D-062).
      const changedAt: Record<string, number> = {};
      for (const u of units as Array<UnitRow & { date_updated?: string | Date | null }>) if (u.date_updated) changedAt[u.key] = new Date(u.date_updated).getTime();
      return { units: sUnits, catalog, missions, changedAt };
    }

    /**
     * Ayuda de la comprobación selectiva por unidad (D-063): cuántos repasos espaciados ha superado (éxitos diferidos
     * desde la última vez que se debilitó). 0 → asociación completa, 1 → imagen, 2 → solo la idea, 3 → escribir directo.
     */
    function reviewHelp(learner: Learner): Record<string, number> {
      const help: Record<string, number> = {};
      for (const s of Object.values(learner.skills)) help[s.unitId] = Math.max(help[s.unitId] ?? 0, s.deferredSuccesses ?? 0);
      return help;
    }

    /** Unidades ya vistas cuya ficha cambió después de la última vez que el alumno la vio. */
    function staleUnits(changedAt: Record<string, number>, learner: Learner): string[] {
      const seen: Record<string, number> = {};
      for (const s of Object.values(learner.skills)) {
        const at = Math.max(s.lastExposureAt ?? 0, s.presentedAt ?? 0);
        if (at) seen[s.unitId] = Math.max(seen[s.unitId] ?? 0, at);
      }
      return Object.keys(seen).filter((k) => (changedAt[k] ?? 0) > seen[k]!);
    }

    type Mission = { key: string; title: string; units: string[] };
    /** Avance del alumno en cada misión: unidades trabajadas (alguna habilidad empezada) y aprendidas. */
    function missionProgress(missions: Mission[], catalog: Catalog, learner: Learner) {
      const worked = new Set(Object.values(learner.skills).filter((x) => x.status !== 'new').map((x) => x.unitId));
      const list = missions.map((m, i) => {
        const learned = m.units.filter((u) => ['learned', 'stable', 'mastered'].includes(unitLevel(u, catalog, learner.skills, config).level)).length;
        const done = m.units.filter((u) => worked.has(u)).length;
        return { key: m.key, title: m.title, index: i + 1, total: m.units.length, worked: done, learned, status: done === 0 ? 'pending' : done === m.units.length ? 'done' : 'active' };
      });
      const current = list.find((m) => m.status !== 'done') ?? list[list.length - 1] ?? null;
      return { list, current, worked };
    }
    const missionRef = (missions: Mission[], key: string): MissionRef | undefined => {
      const i = missions.findIndex((m) => m.key === key);
      if (i < 0) return undefined;
      const next = missions[i + 1];
      return { key, title: missions[i]!.title, index: i + 1, total: missions.length, next: next ? { key: next.key, title: next.title } : null };
    };

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
      const wanted = typeof req.query.mission === 'string' && req.query.mission ? req.query.mission : null;
      const { units, catalog, missions, changedAt } = await publishedContent(course);
      if (wanted && !missions.some((m) => m.key === wanted)) throw new HttpError(404, 'NOT_FOUND', 'Misión no disponible.');
      const now = Date.now();
      const today = dayOf(now, config.load.dayOriginMs, config.load.dayLengthMs);
      const saved = await db('session_positions').where({ user: userId, course: course.id }).first();
      const savedState: SessionState | null = saved ? parse(saved.state) : null;
      // «Continuar aventura» (sin misión) retoma la sesión empezada; elegir una misión la retoma solo si es la misma.
      const sameMission = !wanted || savedState?.mission?.key === wanted;
      if (savedState && sameMission && savedState.plan.day === today && !savedState.finished && savedState.plan.steps.every((s: { unitKey: string }) => !s.unitKey || units[s.unitKey])) {
        return { data: { state: savedState, units, resumed: true } };
      }
      const learner = await learnerFor(userId, course.id);
      const progress = missionProgress(missions, catalog, learner);
      const target = wanted ?? progress.current?.key ?? null;
      const focus = missions.find((m) => m.key === target);
      // Solo entra contenido nuevo de la misión; los repasos vencidos llegan de todo lo ya trabajado.
      const planCatalog = focus ? focusCatalog(catalog, new Set(focus.units), progress.worked) : catalog;
      const cfg = courseConfig(course);
      const plan = planDay({ catalog: planCatalog, learner, now, config: cfg });
      const modes: string[] = (typeof course.modes === 'string' ? JSON.parse(course.modes) : course.modes) ?? ['associations', 'grammar', 'arcade', 'chat'];
      // Sin Arcade en el curso, nunca salta el Arcade sorpresa.
      const knownUnits = !modes.includes('arcade') ? [] : [...new Set(Object.values(learner.skills).filter((x) => x.attempts > 0).map((x) => x.unitId))];
      // Rampa (D-057): empieza con 8 nuevas y sube según los aciertos hasta el objetivo del curso.
      // Modo Flujo (D-068) si el curso lo tiene; si no, el de asociaciones por escenas.
      const newMax = newUnitsFor(learner.activity, Math.max(1, Number(course.new_per_session) || 15));
      const session = modes.includes('flow')
        ? buildFlowSession({ sessionId: randomUUID(), courseId: course.id, day: today, createdAt: now, items: plan.items as PlanItem[], units, maxNewUnits: newMax })
        : buildAssociationSession({ sessionId: randomUUID(), courseId: course.id, day: today, createdAt: now, items: plan.items as PlanItem[], units, knownUnits, refreshUnits: staleUnits(changedAt, learner), reviewHelp: reviewHelp(learner), maxNewUnits: newUnitsFor(learner.activity, Math.max(1, Number(course.new_per_session) || 15)) });
      const mission = target ? missionRef(missions, target) : undefined;
      const state: SessionState = { plan: session, ...(mission ? { mission } : {}), index: 0, outcomes: {}, finished: session.steps.length === 0 };
      await savePosition(userId, course.id, state, null);
      return { data: { state, units, resumed: false, stats: plan.stats } };
    }));

    // Paquete sin conexión (H2.2b mínimo, D-054): sesiones ya construidas para jugar en el móvil sin red. Los eventos se
    // guardan en el dispositivo y se envían al volver la conexión (son idempotentes). Primero los repasos que vencen
    // en las próximas 24 h; después, por misión, lo que aún no se ha trabajado, en sesiones del tamaño del curso.
    router.get('/offline', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.query.course, userId);
      const { units, catalog, missions, changedAt } = await publishedContent(course);
      const learner = await learnerFor(userId, course.id);
      const progress = missionProgress(missions, catalog, learner);
      const now = Date.now();
      const today = dayOf(now, config.load.dayOriginMs, config.load.dayLengthMs);
      // Misma rampa que en línea (D-057).
      const perSession = newUnitsFor(learner.activity, Math.max(1, Number(course.new_per_session) || 15));
      const sessions: Array<{ id: string; title: string; mission?: MissionRef; state: SessionState }> = [];
      // Repasos: lo trabajado que vence de aquí a mañana (se adelanta, porque en el vuelo no habrá red).
      const soon = now + 24 * 3600 * 1000;
      const reviewItems: PlanItem[] = [];
      for (const s of catalog.skills) {
        const st = learner.skills[s.id];
        if (!st || st.status === 'new' || !st.dueAt || st.dueAt > soon) continue;
        const unit = units[s.unitId];
        const skill = unit?.skills.find((x) => x.key === s.id);
        if (!unit || !skill) continue;
        reviewItems.push({ skillId: s.id, unitId: s.unitId, reason: 'review', priority: 0, recommendedHint: 0, ...(skill.associationId ? { associationId: skill.associationId } : {}) });
      }
      if (reviewItems.length) {
        const plan = buildAssociationSession({ sessionId: `offline-${course.id}-repasos-${today}`, courseId: course.id, day: today, createdAt: now, items: reviewItems, units, knownUnits: [], refreshUnits: staleUnits(changedAt, learner), reviewHelp: reviewHelp(learner) });
        if (plan.steps.length) sessions.push({ id: plan.sessionId, title: 'Repasos pendientes', state: { plan, index: 0, outcomes: {}, finished: false } });
      }
      for (const m of missions) {
        const pending = m.units.filter((u) => !progress.worked.has(u) && units[u] && units[u]!.type !== 'memory_challenge');
        for (let i = 0; i < pending.length; i += perSession) {
          const chunk = pending.slice(i, i + perSession);
          const items: PlanItem[] = chunk.flatMap((u) => units[u]!.skills.map((s) => ({ skillId: s.key, unitId: u, reason: 'new' as const, priority: 0, recommendedHint: 0 as const, ...(s.associationId ? { associationId: s.associationId } : {}) })));
          const plan = buildAssociationSession({ sessionId: `offline-${course.id}-${m.key}-${i / perSession + 1}`, courseId: course.id, day: today, createdAt: now, items, units, knownUnits: [], maxNewUnits: chunk.length });
          const ref = missionRef(missions, m.key);
          sessions.push({ id: plan.sessionId, title: `${m.title}${pending.length > perSession ? ` (${i / perSession + 1})` : ''}`, ...(ref ? { mission: ref } : {}), state: { plan, ...(ref ? { mission: ref } : {}), index: 0, outcomes: {}, finished: false } });
        }
      }
      // Solo las unidades que aparecen en alguna sesión.
      const used = new Set(sessions.flatMap((x) => x.state.plan.steps.flatMap((st: { unitKey: string; arcadeUnits?: string[] }) => [st.unitKey, ...(st.arcadeUnits ?? [])])).filter(Boolean));
      const slim = Object.fromEntries(Object.entries(units).filter(([k]) => used.has(k)));
      return { data: { course: { id: course.id, title: course.title, ui_language: course.ui_language, audio_enabled: course.audio_enabled }, generatedAt: now, sessions, units: slim } };
    }));

    // Retos de memoria (D-056). El resultado de cada intento llega como evento de aprendizaje sobre la habilidad del reto,
    // con contextId «reto:<fase>:<en orden>/<total>»; de ahí sale el mejor resultado antes y después de la historia.
    router.get('/retos', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.query.course, userId);
      const { units, missions } = await publishedContent(course);
      const learner = await learnerFor(userId, course.id);
      const events = await storedEvents(userId, course.id);
      const best: Record<string, { before: number; after: number; reverse: number; tries: number }> = {};
      for (const e of events) {
        const ctx = (e.payload as { contextId?: string; unitKey?: string }).contextId ?? '';
        const m = ctx.match(/^reto:(before|after|reverse):(\d+)\/(\d+)$/);
        const key = (e.payload as { unitKey?: string }).unitKey;
        if (!m || !key) continue;
        const b = (best[key] ??= { before: 0, after: 0, reverse: 0, tries: 0 });
        b[m[1] as 'before' | 'after' | 'reverse'] = Math.max(b[m[1] as 'before' | 'after' | 'reverse'], Number(m[2]));
        if (m[1] === 'after') b.tries += 1;
      }
      const order = missions.flatMap((m) => m.units);
      const retos = order.filter((k) => units[k]?.type === 'memory_challenge').map((k) => {
        const u = units[k]!;
        const skill = u.skills[0];
        const st = skill ? learner.skills[skill.key] : undefined;
        return { key: k, skillKey: skill?.key ?? null, payload: u.payload, best: best[k] ?? null, status: st?.status ?? 'new', dueAt: st?.dueAt ?? null };
      });
      return { data: { retos } };
    }));

    router.get('/missions', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.query.course, userId);
      const { catalog, missions } = await publishedContent(course);
      const learner = await learnerFor(userId, course.id);
      const { list, current } = missionProgress(missions, catalog, learner);
      // Si hay una sesión empezada hoy, «Continuar aventura» la retoma: esa es la misión actual para el alumno.
      const saved = await db('session_positions').where({ user: userId, course: course.id }).first('state');
      const state: SessionState | null = saved ? parse(saved.state) : null;
      const today = dayOf(Date.now(), config.load.dayOriginMs, config.load.dayLengthMs);
      const resume = state && !state.finished && state.plan.day === today && state.mission && list.some((m) => m.key === state.mission!.key) ? state.mission.key : null;
      // Cuántas nuevas trae la sesión de hoy (rampa D-057): la ya empezada manda; si no, la rampa según los aciertos.
      const target = Math.max(1, Number(course.new_per_session) || 15);
      const startedNew = resume && state ? new Set(state.plan.steps.filter((x: { kind: string; unitKey: string }) => x.kind === 'card' && x.unitKey).map((x: { unitKey: string }) => x.unitKey)).size : 0;
      const newToday = startedNew || newUnitsFor(learner.activity, target);
      return { data: { missions: list, current: resume ?? current?.key ?? null, newToday, newTarget: target } };
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
      const append = Boolean(req.query.append);
      const problems = await checkCourseFile(db, req.body, append);
      if (problems.length) return { data: { ok: false, problems } };
      if (req.query.check) return { data: { ok: true, problems: [] } };
      try {
        const result = await importCourse(services, await getSchema(), req.accountability, req.body, db, append);
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

    router.get('/studio/missions', wrap(async (req) => {
      await requireStaff(req.accountability, 'Studio');
      const courseId = typeof req.query.course === 'string' ? req.query.course : '';
      const modules: Row[] = await db('modules').where({ course: courseId }).orderBy('sort').select('id', 'key', 'title', 'status');
      const units: Row[] = await db('units').where({ course: courseId }).select('module', 'status');
      return {
        data: modules.map((m) => {
          const own = units.filter((u) => u.module === m.id);
          const count = (st: string) => own.filter((u) => u.status === st).length;
          return { id: m.id, key: m.key, title: m.title, status: m.status, total: own.length, draft: count('draft'), review: count('needs_review'), approved: count('approved'), published: count('published'), rejected: count('rejected') };
        }),
      };
    }));

    // Probar una misión entera como alumno: todas sus unidades (también borradores) en una sesión que no guarda nada.
    router.get('/preview/mission/:moduleId', wrap(async (req) => {
      await requireStaff(req.accountability, 'La vista previa');
      const mod = await db('modules').where({ id: req.params.moduleId }).first();
      if (!mod) throw new HttpError(404, 'NOT_FOUND', 'Misión no encontrada.');
      const course = await db('courses').where({ id: mod.course }).first();
      const rows: Row[] = (await db('units').where({ module: mod.id }).whereNotIn('status', ['rejected', 'deprecated']).orderBy('sort')).filter((u: Row) => !validateUnitPayload(u.type, parse(u.payload)).length);
      const ids = rows.map((u) => u.id);
      const skills: SkillRow[] = ids.length ? await db('skills').whereIn('unit', ids).select('id', 'key', 'kind', 'unit', 'association', 'sort') : [];
      const associations: AssociationRow[] = ids.length ? (await db('associations').whereIn('unit', ids).whereNot({ status: 'rejected' }).select('id', 'unit', 'technique', 'cue', 'text', 'status', 'scene_target', 'emoji', 'evidence')).map((a: Row) => ({ ...a, status: 'published' })) : [];
      const units: Record<string, SessionUnit> = sessionUnits(rows.map((u) => ({ ...u, place: mod.title })) as UnitRow[], skills, associations, course?.content_language ?? 'en');
      const items: PlanItem[] = rows.flatMap((u) => (units[u.key]?.skills ?? []).map((s) => ({ skillId: s.key, unitId: u.key, reason: 'new' as const, priority: 0, recommendedHint: 0 as const, ...(s.associationId ? { associationId: s.associationId } : {}) })));
      const plan = buildAssociationSession({ sessionId: `preview-${mod.id}`, courseId: mod.course, day: 0, createdAt: Date.now(), items, units, knownUnits: [], maxNewUnits: rows.length });
      return { data: { state: { plan, index: 0, outcomes: {}, finished: false }, units, preview: true, status: mod.status, audio: course?.audio_enabled !== false } };
    }));

    // Aprobar una misión: lleva cada asociación y unidad por el flujo (borrador → revisión → aprobada → publicada) con la
    // cuenta que lo pide, así que valen los mismos permisos y comprobaciones que en el panel. Informa de lo que falle.
    router.post('/studio/approve/:moduleId', wrap(async (req) => {
      // Solo revisión y administración pueden aprobar: se comprueba antes de mover nada, para no dejar la misión a medias.
      const acc = req.accountability;
      const role = acc.role ? await db('directus_roles').where({ id: acc.role }).first('name') : null;
      if (!acc.admin && role?.name !== 'Revisor') throw new HttpError(403, 'FORBIDDEN', 'Aprobar es solo para revisión y administración.');
      const mod = await db('modules').where({ id: req.params.moduleId }).first();
      if (!mod) throw new HttpError(404, 'NOT_FOUND', 'Misión no encontrada.');
      const schema = await getSchema();
      const svc = (c: string) => new services.ItemsService(c, { schema, accountability: req.accountability });
      const PATH: Record<string, string[]> = { draft: ['needs_review', 'approved', 'published'], needs_review: ['approved', 'published'], approved: ['published'] };
      const advance = async (collection: string, id: string, status: string) => {
        for (const next of PATH[status] ?? []) await svc(collection).updateOne(id, { status: next });
      };
      const message = (e: any) => e?.extensions?.issues?.map((i: Row) => i.message).join(' ') || e?.message || 'Error.';
      const units: Row[] = await db('units').where({ module: mod.id }).orderBy('sort').select('id', 'key', 'status');
      const failed: Array<{ key: string; message: string }> = [];
      let published = 0;
      for (const u of units) {
        if (u.status === 'rejected' || u.status === 'deprecated') continue;
        try {
          for (const a of await db('associations').where({ unit: u.id }).whereIn('status', Object.keys(PATH)).select('id', 'status')) await advance('associations', a.id, a.status);
          await advance('units', u.id, u.status);
          published += 1;
        } catch (e) {
          failed.push({ key: u.key, message: message(e) });
        }
      }
      if (!failed.length) {
        await svc('modules').updateOne(mod.id, { status: 'published' });
        const course = await db('courses').where({ id: mod.course }).first('status');
        if (course?.status === 'draft') await svc('courses').updateOne(mod.course, { status: 'published' });
      }
      return { data: { published, failed } };
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
      return { data: { state: { plan, index: 0, outcomes: {}, finished: false }, units, preview: true, status: unit.status, audio: course?.audio_enabled !== false } };
    }));
  },
};

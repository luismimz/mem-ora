// Endpoint `/memora` para la app del alumno (H2.2a). El alumno no lee colecciones directamente (D-029): todo pasa por
// aquí, que aplica la visibilidad de los cursos, valida los eventos y recalcula su estado en el servidor.
//   GET  /memora/courses                 cursos visibles para el alumno
//   GET  /memora/session?course=…        sesión de hoy (la reanuda si ya estaba empezada)
//   POST /memora/events                  eventos idempotentes; devuelve el estado recalculado
//   PUT  /memora/session/position        punto exacto de la sesión
//   GET  /memora/progress?course=…       estado por habilidad, unidad y asociación, racha y protectores
//   POST /memora/clarify                 «Explícame más»: pide ampliar una ficha (D-077)
//   GET  /memora/exam?course=…           simulacro: preguntas de todo lo trabajado (60 min, se aprueba con 7)
//   POST /memora/exam/result             guarda la nota de un simulacro
//   POST /memora/report                  «Reportar un error» de una tarjeta (va a la cola de Studio)
//   GET  /memora/studio/requests?course=… avisos de los alumnos pendientes (errores y «Explícame más»)
//   POST /memora/studio/requests/:id     marcar un aviso como atendido o descartado
//   GET  /memora/push/key                clave pública para el aviso de repaso en el móvil (D-077)
//   POST /memora/push/subscribe|unsubscribe|test   suscripción de este dispositivo y aviso de prueba
//   GET  /memora/push/message            texto del aviso (lo pide el service worker al recibirlo)
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
import { assessAssociation, dayOf, dueUnits, dueWords, errorUnits, flowNewUnits, focusCatalog, newUnitsFor, pendingFailures, planDay, resolveConfig, streakOf, unitLevel, weakUnits, type PlanItem } from '@memora/core';
import { buildAssociationSession, buildExam, buildFlowSession, FLOW_PLAN_VERSION, FLOW_REVIEW_ARCADE_MAX, EXAM_GUIDED_SIZE, EXAM_MIN_QUESTIONS, EXAM_MINUTES, EXAM_PASS, examGrade, type AssocPlan, type SessionPlan, type SessionUnit } from '@memora/experiences';
import { buildCatalog } from '../catalog';
import { reminderForUser } from '../push/data';
import { ring, vapidFromEnv } from '../push/lib';
import { checkCourseFile, exportCourse, importCourse } from './courseIO';
import { resetProgress } from './reset';
import { audience, canSee, normEmail } from './access';
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
  // Idiomas (D-094): el núcleo no recorta nada. Los repasos son TODOS los que vencen según su curva (sin tope diario) y
  // cuántas nuevas entran lo decide la ronda (LANGUAGE_NEW_PER_ROUND, meta DAILY_GOAL_LANGUAGE). Antes, el tope total
  // del día se gastaba con el refuerzo y solo quedaban las 3 nuevas mínimas (usuario, 29-oct-2026).
  if (isLanguageCourse(course)) return resolveConfig({ load: { newCap: 300, minNewPerDay: 0, reviewCap: 9999, totalCap: 99999, backlogSuppressNew: 99999 } });
  const perSession = Math.max(1, Number(course.new_per_session) || 15);
  // El tope diario admite varias sesiones (meta de ≈1.000 al mes ⇒ 2–3 sesiones al día); cada sesión trae como mucho perSession.
  return resolveConfig({ load: { newCap: perSession * 3 * 3, minNewPerDay: Math.min(perSession * 3, 9), reviewCap: 120, totalCap: perSession * 3 * 3 + 120 } });
}

/** Meta diaria en idiomas (D-081): ≈ 1.000 palabras en 30 días ⇒ 35 nuevas al día. */
export const DAILY_GOAL_LANGUAGE = 33;
/** Idiomas (D-094): nuevas por ronda (3 rondas ≈ la meta del día; se puede seguir después) y, con muchos repasos acumulados, menos. */
export const LANGUAGE_NEW_PER_ROUND = 11;
export const LANGUAGE_BACKLOG_ROUNDS = 6;
export const LANGUAGE_NEW_BACKLOG = 8;
/** Trucos de gramática que se repasan por ronda (en repaso ligero). */
export const LANGUAGE_PATTERN_REVIEWS = 3;
const isLanguageCourse = (course: Row) => Boolean(course.content_language) && course.content_language !== (course.learner_language ?? course.ui_language);
/** Meta de unidades nuevas al día: en idiomas, la del reto de 30 días; en el resto, tres rondas de nuevas (D-077). */
export function dailyGoal(course: Row): number {
  return isLanguageCourse(course) ? DAILY_GOAL_LANGUAGE : Math.max(1, Number(course.new_per_session) || 15) * 3;
}
/** Unidades vistas por primera vez desde `dayStart`. */
function newUnitsSince(learner: Learner, dayStart: number): number {
  const firstSeen: Record<string, number> = {};
  for (const sk of Object.values(learner.skills)) if (sk.presentedAt) firstSeen[sk.unitId] = Math.min(firstSeen[sk.unitId] ?? Infinity, sk.presentedAt);
  return Object.values(firstSeen).filter((t) => t >= dayStart).length;
}

/** Días del calendario de constancia (12 semanas). */
const CALENDAR_DAYS = 84;

/** Motivos de «Reportar un error» (la app los muestra con su texto). */
const REPORT_REASONS = ['asociacion', 'significado', 'respuesta', 'audio', 'otro'];

/** Fallos por ronda de «Vacía tus fallos»: corta, para vaciarlos en tandas. */
const FAILURES_PER_ROUND = 8;

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
  /** Ronda especial: «fallos» = solo los fallos pendientes («Vacía tus fallos»). */
  focus?: 'fallos';
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

    const emailOf = async (userId: string): Promise<string | null> => (await db('directus_users').where({ id: userId }).first('email'))?.email ?? null;
    async function visibleCourse(courseId: unknown, userId: string): Promise<Row> {
      if (typeof courseId !== 'string' || !courseId) throw new HttpError(400, 'BAD_REQUEST', 'Falta el curso.');
      const course = await db('courses').where({ id: courseId, status: 'published' }).first();
      if (!course || !canSee(course, userId, course.visibility === 'private' ? await emailOf(userId) : null)) throw new HttpError(404, 'NOT_FOUND', 'Curso no disponible.');
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
    /**
     * Avance del alumno en cada misión: unidades trabajadas (alguna habilidad empezada) y aprendidas, y cuántas conviene
     * repasar ya (`due`, el cuarto estado del mapa: lo que se está olvidando).
     */
    function missionProgress(missions: Mission[], catalog: Catalog, learner: Learner) {
      const worked = new Set(Object.values(learner.skills).filter((x) => x.status !== 'new').map((x) => x.unitId));
      const dueNow = dueUnits(learner.skills, Date.now());
      const list = missions.map((m, i) => {
        const learned = m.units.filter((u) => ['learned', 'stable', 'mastered'].includes(unitLevel(u, catalog, learner.skills, config).level)).length;
        const done = m.units.filter((u) => worked.has(u)).length;
        return { key: m.key, title: m.title, index: i + 1, total: m.units.length, worked: done, learned, due: m.units.filter((u) => dueNow.has(u)).length, status: done === 0 ? 'pending' : done === m.units.length ? 'done' : 'active' };
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
      // Solo exposiciones e intentos: los resultados de simulacro (kind «exam») no son evidencia del núcleo.
      const rows = await db('learning_events').where({ user: userId, course: courseId }).whereIn('kind', ['exposure', 'attempt']).select('event_id', 'kind', 'payload', 'device_time', 'received_at');
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
      return { data: { staff: Boolean(acc.admin || (role && STAFF_ROLES.has(role.name))), admin: Boolean(acc.admin) } };
    }));

    // D-091: qué asignaturas ve cada alumno. Solo administración: lista de alumnos y cursos, y cambiar quién ve qué.
    const onlyAdmin = (req: any) => { if (!req.accountability?.admin) throw new HttpError(403, 'FORBIDDEN', 'Solo administración.'); };
    router.get('/access', wrap(async (req) => {
      onlyAdmin(req);
      const users = await db('directus_users').where({ status: 'active' }).orderBy('email').select('id', 'email', 'first_name');
      const courses = await db('courses').where({ status: 'published' }).orderBy('title').select('id', 'key', 'title', 'visibility', 'owner', 'visible_to');
      return { data: { users: users.map((u: Row) => ({ id: u.id, email: u.email, name: u.first_name ?? null })),
        courses: courses.map((c: Row) => ({ id: c.id, key: c.key, title: c.title, visibility: c.visibility === 'private' ? 'private' : 'public', owner: c.owner ?? null, visibleTo: audience(c) })) } };
    }));
    router.post('/access', wrap(async (req) => {
      onlyAdmin(req);
      const { course: courseId, visibility, email, on } = req.body ?? {};
      const course = typeof courseId === 'string' ? await db('courses').where({ id: courseId }).first() : null;
      if (!course) throw new HttpError(404, 'NOT_FOUND', 'Curso no encontrado.');
      const patch: Row = {};
      if (visibility !== undefined) {
        if (visibility !== 'public' && visibility !== 'private') throw new HttpError(400, 'BAD_REQUEST', 'Visibilidad no válida.');
        patch.visibility = visibility;
      }
      if (email !== undefined) {
        const e = normEmail(email);
        if (!e || !(await db('directus_users').whereRaw('lower(email) = ?', [e]).first('id'))) throw new HttpError(400, 'BAD_REQUEST', 'Ese alumno no existe.');
        const list = audience(course).filter((x) => x !== e);
        patch.visible_to = JSON.stringify(on ? [...list, e] : list);
      }
      if (Object.keys(patch).length) await db('courses').where({ id: course.id }).update(patch);
      const after = await db('courses').where({ id: course.id }).first('visibility', 'visible_to');
      return { data: { visibility: after.visibility === 'private' ? 'private' : 'public', visibleTo: audience(after) } };
    }));

    router.get('/courses', wrap(async (req) => {
      const userId = req.accountability.user;
      // D-091: públicos para todos; privados, para su propietario y los alumnos elegidos.
      const email = await emailOf(userId);
      const rows = (await db('courses').where({ status: 'published' })
        .select('id', 'key', 'title', 'subject', 'ui_language', 'learner_language', 'content_language', 'content_revision', 'audio_enabled', 'new_per_session', 'modes', 'visibility', 'owner', 'visible_to'))
        .filter((r: Row) => canSee(r, userId, email));
      // Sin configurar ⇒ todos los modos.
      return { data: rows.map(({ visibility: _v, owner: _o, visible_to: _t, ...r }: Row) => ({ ...r, modes: (typeof r.modes === 'string' ? JSON.parse(r.modes) : r.modes) ?? ['associations', 'grammar', 'arcade', 'chat'] })) };
    }));

    router.get('/session', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.query.course, userId);
      const wanted = typeof req.query.mission === 'string' && req.query.mission ? req.query.mission : null;
      const wantFailures = req.query.focus === 'fallos';
      const { units, catalog, missions, changedAt } = await publishedContent(course);
      if (wanted && !missions.some((m) => m.key === wanted)) throw new HttpError(404, 'NOT_FOUND', 'Misión no disponible.');
      const now = Date.now();
      const today = dayOf(now, config.load.dayOriginMs, config.load.dayLengthMs);
      const saved = await db('session_positions').where({ user: userId, course: course.id }).first();
      const savedState: SessionState | null = saved ? parse(saved.state) : null;
      // «Continuar aventura» (sin misión) retoma la sesión empezada; elegir una misión la retoma solo si es la misma.
      const sameMission = (!wanted || savedState?.mission?.key === wanted) && (savedState?.focus === 'fallos') === wantFailures;
      const modes: string[] = (typeof course.modes === 'string' ? JSON.parse(course.modes) : course.modes) ?? ['associations', 'grammar', 'arcade', 'chat'];
      // D-075: si el curso cambió de experiencia (escenas ↔ Flujo), la sesión guardada no se retoma: se crea una nueva.
      const sameMode = ((savedState?.plan as { mode?: string } | undefined)?.mode ?? 'associations') === (modes.includes('flow') ? 'flow' : 'associations')
        // D-099: una ronda armada con un planificador anterior no se retoma (si no, se seguía con la ronda vieja).
        && (!modes.includes('flow') || (savedState?.plan as { version?: number } | undefined)?.version === FLOW_PLAN_VERSION);
      if (savedState && sameMission && sameMode && savedState.plan.day === today && !savedState.finished && savedState.plan.steps.every((s: { unitKey: string }) => !s.unitKey || units[s.unitKey])) {
        return { data: { state: savedState, units, resumed: true } };
      }
      const learner = await learnerFor(userId, course.id);
      // «Vacía tus fallos»: una ronda solo con los fallos pendientes (sin nuevas ni repasos). Al acertarlos, salen.
      if (wantFailures && modes.includes('flow')) {
        const failed = pendingFailures(learner.skills, FAILURES_PER_ROUND).filter((k) => units[k]);
        const session = buildFlowSession({ sessionId: randomUUID(), courseId: course.id, day: today, createdAt: now, items: [], units, maxNewUnits: 0,
          errorUnits: failed, practiceUnits: [], levels: reviewHelp(learner), audio: course.audio_enabled !== false && isLanguageCourse(course) });
        const state: SessionState = { plan: session, focus: 'fallos', index: 0, outcomes: {}, finished: session.steps.length === 0 };
        await savePosition(userId, course.id, state, null);
        return { data: { state, units, resumed: false } };
      }
      const progress = missionProgress(missions, catalog, learner);
      const target = wanted ?? progress.current?.key ?? null;
      const focus = missions.find((m) => m.key === target);
      // Solo entra contenido nuevo de la misión; los repasos vencidos llegan de todo lo ya trabajado.
      // D-099: en idiomas, si a la misión le quedan pocas nuevas, entra también lo nuevo de las siguientes (en orden):
      // antes, al final de una misión, cada ronda traía 2–3 nuevas y parecía que no se avanzaba.
      const focusUnits = new Set(focus?.units ?? []);
      if (focus && !wanted && isLanguageCourse(course)) {
        for (const m of missions.slice(missions.indexOf(focus) + 1)) {
          if ([...focusUnits].filter((u) => !progress.worked.has(u)).length >= LANGUAGE_NEW_PER_ROUND) break;
          for (const u of m.units) focusUnits.add(u);
        }
      }
      const planCatalog = focus ? focusCatalog(catalog, focusUnits, progress.worked) : catalog;
      const cfg = courseConfig(course);
      const plan = planDay({ catalog: planCatalog, learner, now, config: cfg });
      // Sin Arcade en el curso, nunca salta el Arcade sorpresa.
      const knownUnits = !modes.includes('arcade') ? [] : [...new Set(Object.values(learner.skills).filter((x) => x.attempts > 0).map((x) => x.unitId))];
      // Rampa (D-057): empieza con 8 nuevas y sube según los aciertos hasta el objetivo del curso.
      // Modo Flujo (D-068) si el curso lo tiene; si no, el de asociaciones por escenas.
      const newMax = newUnitsFor(learner.activity, Math.max(1, Number(course.new_per_session) || 15));
      // Flujo infinito (D-077): cada ronda trae como mucho newMax nuevas y, al día, tres rondas de nuevas; después sigue
      // con repasos, «tus errores» y refuerzo de lo más débil, sin fin.
      const dayStart = config.load.dayOriginMs + today * config.load.dayLengthMs;
      const newToday = newUnitsSince(learner, dayStart);
      // Idiomas (inglés intensivo, decisión del usuario 22-oct-2026): sin tope diario; sigue con nuevas mientras la
      // ronda anterior pase del 80 % de aciertos. El resto de cursos mantiene el tope de tres rondas de nuevas al día.
      const isLanguage = isLanguageCourse(course);
      // Una ronda de «Vacía tus fallos» no cuenta para decidir si hay nuevas: ahí se falla más por diseño.
      const prevRound = savedState && savedState.plan.day === today && (savedState.plan as { mode?: string }).mode === 'flow' && savedState.focus !== 'fallos' ? savedState : null;
      const prevOutcomes = Object.values(prevRound?.outcomes ?? {});
      // Idiomas (D-094): las palabras que tocan según su curva van al «Repaso rápido» (Arcade, sin ficha); el resto de la
      // ronda es nuevo. Una palabra se repasa una sola vez aunque venzan varias de sus habilidades.
      const flowLanguage = modes.includes('flow') && isLanguage;
      const skillKind = new Map(catalog.skills.map((sk) => [sk.id, sk.kind as string]));
      const isWord = (k: string) => units[k]?.type === 'term';
      const words = flowLanguage ? dueWords(plan.items as PlanItem[], (id) => skillKind.get(id), isWord, learner.skills) : [];
      const roundWords = words.slice(0, FLOW_REVIEW_ARCADE_MAX);
      // D-099: de los trucos que tocan, como mucho LANGUAGE_PATTERN_REVIEWS por ronda (los más urgentes) y en repaso ligero
      // (una frase nueva, sin volver a enseñarlos enteros); antes, diez por ronda con todos sus pasos tapaban lo nuevo.
      const patternDue = flowLanguage ? [...new Set((plan.items as PlanItem[]).filter((i) => i.reason === 'review' && !isWord(i.unitId)).map((i) => i.unitId))].slice(0, LANGUAGE_PATTERN_REVIEWS) : [];
      const items = flowLanguage ? (plan.items as PlanItem[]).filter((i) => i.reason !== 'review' || (!isWord(i.unitId) && patternDue.includes(i.unitId))) : (plan.items as PlanItem[]);
      // D-099: lo nuevo no se frena por los repasos acumulados (el Repaso rápido los despacha deprisa); solo con muchísimos
      // (más de LANGUAGE_BACKLOG_ROUNDS rondas llenas), algo menos. Antes bajaba a 4 y no se avanzaba.
      const perRound = flowLanguage ? (words.length > FLOW_REVIEW_ARCADE_MAX * LANGUAGE_BACKLOG_ROUNDS ? LANGUAGE_NEW_BACKLOG : LANGUAGE_NEW_PER_ROUND) : newMax;
      const flowNew = flowNewUnits({ perRound, newToday, dailyRounds: isLanguage ? null : 3,
        ...(prevRound ? { lastRound: { answered: prevOutcomes.length, correct: prevOutcomes.filter((o) => o.correct).length } } : {}) });
      const reviewKeys = [...items.filter((i) => i.reason === 'review').map((i) => i.unitId), ...roundWords.map((w) => w.unitKey)];
      // «Tus errores»: en idiomas, solo lo fallado y aún no acertado (antes también todo lo que se olvidó alguna vez, y
      // salían siempre las mismas). Vuelve con su ficha: si se falla, se repite.
      const errors = (flowLanguage ? pendingFailures(learner.skills, 4).filter((k) => !reviewKeys.includes(k)) : errorUnits(learner.skills, 4, reviewKeys)).filter((k) => units[k]);
      // Refuerzo que rota: si se puede, no repite las unidades de la ronda anterior (antes salían siempre las mismas 8).
      const prevUnits = new Set((prevRound?.plan.steps ?? []).map((st: { unitKey: string }) => st.unitKey).filter(Boolean));
      const weakAll = weakUnits(learner.skills, 8, [...reviewKeys, ...errors]).filter((k) => units[k]);
      const weakFresh = weakUnits(learner.skills, 8, [...reviewKeys, ...errors, ...prevUnits]).filter((k) => units[k]);
      // El refuerzo de «lo más débil» repetía siempre las mismas palabras: en idiomas solo entra si no hay nada nuevo ni
      // nada que repasar (curso terminado y todo al día).
      const nothingElse = !roundWords.length && !items.some((i) => i.reason === 'new') && !errors.length;
      const practice = flowLanguage && !nothingElse ? [] : weakFresh.length >= 2 ? weakFresh : weakAll;
      // Arcade sorpresa (D-087): solo lo ya aprendido (practicado y más allá de «presentado»), si el curso tiene Arcade.
      const learnedUnits = !modes.includes('arcade') ? [] : [...new Set(Object.values(learner.skills).filter((x) => x.attempts > 0 && !['new', 'presented'].includes(x.status)).map((x) => x.unitId))].filter((k) => units[k]);
      const session = modes.includes('flow')
        ? buildFlowSession({ sessionId: randomUUID(), courseId: course.id, day: today, createdAt: now, items, units, maxNewUnits: flowNew,
            errorUnits: errors, practiceUnits: practice, levels: reviewHelp(learner), audio: course.audio_enabled !== false && isLanguage, arcadeUnits: learnedUnits,
            ...(roundWords.length ? { reviewArcade: roundWords } : {}), ...(flowLanguage ? { lightReviews: true } : {}) })
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
      // Racha con protector (D-072, D-077): días seguidos con alguna respuesta; cada 7 días se gana un protector que
      // salva un día perdido. Hoy, mientras no acabe, no rompe la racha.
      const today = dayOf(Date.now(), config.load.dayOriginMs, config.load.dayLengthMs);
      const streak = streakOf(learner.activity, today);
      return {
        data: {
          streak: streak.days,
          bestStreak: streak.best,
          exam: await examStats(userId, course.id),
          shields: streak.shields,
          // Calendario de constancia: respuestas de cada uno de los últimos 84 días (12 semanas); el último es hoy.
          calendar: Array.from({ length: CALENDAR_DAYS }, (_, i) => learner.activity[String(today - (CALENDAR_DAYS - 1) + i)]?.attempts ?? 0),
          todayAttempts: learner.activity[String(today)]?.attempts ?? 0,
          // «Vacía tus fallos»: unidades falladas desde su último acierto.
          failures: pendingFailures(learner.skills).filter((k) => catalog.units.some((u) => u.id === k)).length,
          // Meta del día (D-081): nuevas de hoy frente a la meta del curso.
          today: { newUnits: newUnitsSince(learner, config.load.dayOriginMs + today * config.load.dayLengthMs), goal: dailyGoal(course) },
          skills: catalog.skills.map((s) => ({ key: s.id, unit: s.unitId, kind: s.kind, status: learner.skills[s.id]?.status ?? 'new', dueAt: learner.skills[s.id]?.dueAt ?? null })),
          units: catalog.units.map((u) => {
            const r = unitLevel(u.id, catalog, learner.skills, config);
            return { key: u.id, level: r.level, missing: r.missing };
          }),
          associations: Object.values(learner.associations).map((a) => ({ id: a.associationId, hintLevel: a.hintLevel, dueAt: a.dueAt, status: a.status, ...assessAssociation(a, config) })),
        },
      };
    }));

    // «Empezar de cero» (D-082): el alumno borra su progreso de un curso. Tiene que confirmar con la clave del curso, y
    // antes se guarda una copia en Archivos de Studio (si falla, no se borra nada).
    router.post('/reset', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.body?.course, userId);
      if (req.body?.confirm !== course.key) throw new HttpError(400, 'BAD_REQUEST', 'Falta confirmar con la clave del curso.');
      const schema = await getSchema();
      const saveBackup = async (b: unknown) => {
        const { Readable } = await import('node:stream');
        const files = new services.FilesService({ schema });
        const name = `progreso-${course.key}-${userId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        return files.uploadOne(Readable.from([JSON.stringify(b)]), { title: `Copia antes de empezar de cero · ${course.key}`, filename_download: name, type: 'application/json', storage: 'local' });
      };
      const r = await resetProgress(db, userId, course.id, saveBackup);
      logger.info(`[memora-api] empezar de cero: ${course.key}, ${r.events} eventos (copia ${r.backup})`);
      return { data: { events: r.events } };
    }));

    // «Explícame más» (D-077): el alumno pide más explicación de una ficha; queda anotado para ampliarla en Studio.
    router.post('/clarify', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.body?.course, userId);
      const unitKey = String(req.body?.unit ?? '').slice(0, 120);
      if (!unitKey) throw new HttpError(400, 'BAD_REQUEST', 'Falta la unidad.');
      const unit = await db('units').where({ course: course.id, key: unitKey }).first('id');
      if (!unit) throw new HttpError(404, 'NOT_FOUND', 'Unidad no disponible.');
      const step = String(req.body?.step ?? '').slice(0, 32) || null;
      const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) || null : null;
      // Una petición abierta por alumno y unidad: si ya la pidió, solo se suma una vez más.
      const open = await db('content_requests').where({ user: userId, unit: unit.id, status: 'open' }).first('id', 'times');
      if (open) await db('content_requests').where({ id: open.id }).update({ times: (open.times ?? 1) + 1, step, ...(note ? { note } : {}), date_updated: new Date() });
      else await db('content_requests').insert({ id: randomUUID(), user: userId, course: course.id, unit: unit.id, step, note, times: 1, status: 'open', date_created: new Date(), date_updated: new Date() });
      return { data: { saved: true } };
    }));

    /** Resultados de simulacro del alumno en un curso: la mejor nota, cuántos ha hecho y el último. */
    async function examStats(userId: string, courseId: string) {
      const rows: Row[] = await db('learning_events').where({ user: userId, course: courseId, kind: 'exam' }).select('payload');
      const all = rows.map((r) => parse(r.payload) as { grade: number; correct: number; total: number; at: number });
      const best = all.reduce<(typeof all)[number] | null>((b, x) => (!b || x.grade > b.grade ? x : b), null);
      const last = all.reduce<(typeof all)[number] | null>((b, x) => (!b || x.at > b.at ? x : b), null);
      return { taken: all.length, best, last };
    }

    // Simulacro de examen (idea de benrios.dev): preguntas de todos los temas YA TRABAJADOS (regla de oro, D-067: nada se
    // pregunta sin haberse enseñado), 60 minutos y sin ayudas hasta el final. Cada vez, un examen nuevo.
    router.get('/exam', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.query.course, userId);
      const { units, catalog, missions } = await publishedContent(course);
      const learner = await learnerFor(userId, course.id);
      const { worked } = missionProgress(missions, catalog, learner);
      const examId = randomUUID();
      // Modelo guiado: cada pregunta llega después de su ficha, así que entra todo el temario (no solo lo trabajado).
      const guided = req.query.modo === 'guiado';
      const pool = guided ? missions : missions.map((m) => ({ key: m.key, units: m.units.filter((u) => worked.has(u)) }));
      const questions = buildExam({ examId, units, missions: pool, ...(guided ? { size: EXAM_GUIDED_SIZE, ordered: true } : {}) });
      const used = Object.fromEntries(questions.map((q) => [q.unitKey, units[q.unitKey]]));
      return { data: { examId, guided, available: guided ? questions.length > 0 : questions.length >= EXAM_MIN_QUESTIONS, need: EXAM_MIN_QUESTIONS, worked: worked.size, questions, units: used, minutes: EXAM_MINUTES, pass: EXAM_PASS, stats: await examStats(userId, course.id) } };
    }));
    router.post('/exam/result', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.body?.course, userId);
      const examId = String(req.body?.examId ?? '');
      const total = Number(req.body?.total), correct = Number(req.body?.correct), ms = Number(req.body?.ms);
      if (!/^[A-Za-z0-9-]{8,64}$/.test(examId) || !Number.isInteger(total) || total < 1 || total > 100 || !Number.isInteger(correct) || correct < 0 || correct > total || !Number.isFinite(ms) || ms < 0)
        throw new HttpError(400, 'BAD_REQUEST', 'Resultado de simulacro no válido.');
      const at = Date.now();
      const payload = { examId, correct, total, ms: Math.round(ms), grade: examGrade(correct, total), at };
      await db('learning_events').insert({ event_key: createHash('sha256').update(`${userId}:exam:${examId}`).digest('hex'), event_id: examId, user: userId, course: course.id, kind: 'exam',
        payload: JSON.stringify(payload), device_id: 'server', device_seq: 0, device_time: new Date(at), received_at: new Date(at), schema_version: 1 }).onConflict('event_key').ignore();
      return { data: { saved: true, grade: payload.grade, stats: await examStats(userId, course.id) } };
    }));

    // «Reportar un error» (idea de benrios.dev, 22-oct-2026): el alumno avisa de que algo de una tarjeta está mal. Va a
    // la misma cola que «Explícame más» (content_requests), con la tarjeta «error:<motivo>», y se atiende en Studio.
    router.post('/report', wrap(async (req) => {
      const userId = req.accountability.user;
      const course = await visibleCourse(req.body?.course, userId);
      const unitKey = String(req.body?.unit ?? '').slice(0, 120);
      const reason = REPORT_REASONS.includes(req.body?.reason) ? String(req.body.reason) : null;
      if (!unitKey || !reason) throw new HttpError(400, 'BAD_REQUEST', 'Falta la unidad o el motivo.');
      const unit = await db('units').where({ course: course.id, key: unitKey }).first('id');
      if (!unit) throw new HttpError(404, 'NOT_FOUND', 'Unidad no disponible.');
      const step = `error:${reason}`;
      const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) || null : null;
      // Un aviso abierto por alumno, unidad y motivo: si lo repite, solo se suma una vez más.
      const open = await db('content_requests').where({ user: userId, unit: unit.id, status: 'open', step }).first('id', 'times');
      if (open) await db('content_requests').where({ id: open.id }).update({ times: (open.times ?? 1) + 1, ...(note ? { note } : {}), date_updated: new Date() });
      else await db('content_requests').insert({ id: randomUUID(), user: userId, course: course.id, unit: unit.id, step, note, times: 1, status: 'open', date_created: new Date(), date_updated: new Date() });
      return { data: { saved: true } };
    }));

    // Aviso de repaso en el móvil (D-077). La clave pública no es secreta; la privada solo vive en el entorno.
    router.get('/push/key', wrap(async () => ({ data: { publicKey: vapidFromEnv(process.env)?.publicKey ?? null } })));
    router.post('/push/subscribe', wrap(async (req) => {
      const userId = req.accountability.user;
      const sub = req.body?.subscription;
      const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) throw new HttpError(400, 'BAD_REQUEST', 'Suscripción no válida.');
      const row = { user: userId, endpoint, keys: JSON.stringify(sub.keys ?? {}), device_id: String(req.body?.deviceId ?? '').slice(0, 64) || null, date_updated: new Date() };
      const existing = await db('push_subscriptions').where({ endpoint }).first('id');
      if (existing) await db('push_subscriptions').where({ id: existing.id }).update(row);
      else await db('push_subscriptions').insert({ id: randomUUID(), ...row, date_created: new Date() });
      return { data: { saved: true } };
    }));
    router.post('/push/unsubscribe', wrap(async (req) => {
      await db('push_subscriptions').where({ user: req.accountability.user, endpoint: String(req.body?.endpoint ?? '') }).delete();
      return { data: { saved: true } };
    }));
    router.post('/push/test', wrap(async (req) => {
      const keys = vapidFromEnv(process.env);
      if (!keys) throw new HttpError(503, 'PUSH_OFF', 'Los avisos aún no están activados en el servidor.');
      const subs = await db('push_subscriptions').where({ user: req.accountability.user }).select('id', 'endpoint');
      let ok = 0;
      for (const s of subs) { const r = await ring(s.endpoint, keys); if (r === 'gone') await db('push_subscriptions').where({ id: s.id }).delete(); if (r === 'ok') ok += 1; }
      return { data: { sent: ok } };
    }));
    router.get('/push/message', wrap(async (req) => {
      const r = await reminderForUser(db, req.accountability.user);
      return { data: r ?? { title: 'Memora', body: 'Unos minutos de repaso y no se te olvida.', url: '/' } };
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

    // Avisos de los alumnos: errores reportados y «Explícame más» pendientes de un curso, los errores primero.
    router.get('/studio/requests', wrap(async (req) => {
      await requireStaff(req.accountability, 'Studio');
      const courseId = typeof req.query.course === 'string' ? req.query.course : '';
      const rows: Row[] = await db('content_requests').where({ course: courseId, status: 'open' }).select('id', 'unit', 'step', 'note', 'times', 'date_updated');
      const units: Row[] = rows.length ? await db('units').whereIn('id', [...new Set(rows.map((r) => r.unit))]).select('id', 'key', 'payload') : [];
      const byId = new Map(units.map((u) => [u.id, u]));
      const label = (u: Row | undefined) => { const p = u ? parse(u.payload) ?? {} : {}; return String(p.text ?? p.title ?? p.name ?? u?.key ?? '?').slice(0, 80); };
      const data = rows.map((r) => ({ id: r.id, unitId: r.unit, unit: byId.get(r.unit)?.key ?? '?', label: label(byId.get(r.unit)), kind: String(r.step ?? '').startsWith('error:') ? 'error' : 'explain',
        reason: String(r.step ?? '').startsWith('error:') ? String(r.step).slice(6) : null, note: r.note ?? null, times: r.times ?? 1, at: new Date(r.date_updated).getTime() }));
      data.sort((a, b) => (a.kind === b.kind ? b.at - a.at : a.kind === 'error' ? -1 : 1));
      return { data };
    }));
    router.post('/studio/requests/:id', wrap(async (req) => {
      await requireStaff(req.accountability, 'Studio');
      const status = req.body?.status === 'dismissed' ? 'dismissed' : 'done';
      const n = await db('content_requests').where({ id: req.params.id }).update({ status, date_updated: new Date() });
      if (!n) throw new HttpError(404, 'NOT_FOUND', 'Aviso no encontrado.');
      return { data: { saved: true } };
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

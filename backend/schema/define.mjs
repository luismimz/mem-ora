// Definición del esquema de Memora (H2.1) como código. Solo se ejecuta en DESARROLLO para redactar cambios:
//   pnpm backend:schema:define   → crea lo que falte por la API (idempotente, nunca borra)
//   pnpm backend:schema:snapshot → exporta schema/snapshot.json, que se versiona en git
// Los demás entornos SOLO aplican la instantánea (`pnpm backend:schema:apply`, con copia de seguridad previa).
// Los roles y permisos no forman parte de la instantánea de Directus: van en access/ (D-028).

const URL_BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) throw new Error('Falta ADMIN_TOKEN (ejecuta con --env-file=backend/.env).');

async function api(method, path, body) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json.errors ?? json)}`), { status: res.status });
  return json.data;
}
const exists = async (path) => {
  try {
    await api('GET', path);
    return true;
  } catch (e) {
    if (e.status === 403 || e.status === 404) return false;
    throw e;
  }
};

// ─── Ayudantes de campos ─────────────────────────────────────────────────────────────────────────────────
const es = (translation) => [{ language: 'es-ES', translation }];
const choices = (pairs) => pairs.map(([value, text]) => ({ value, text }));

const f = {
  id: () => ({ field: 'id', type: 'uuid', meta: { special: ['uuid'], hidden: true, readonly: true, interface: 'input' }, schema: { is_primary_key: true } }),
  serial: () => ({ field: 'id', type: 'integer', meta: { hidden: true, readonly: true }, schema: { is_primary_key: true, has_auto_increment: true } }),
  string: (field, label, o = {}) => ({
    field,
    type: 'string',
    meta: {
      interface: o.choices ? 'select-dropdown' : 'input',
      options: o.choices ? { choices: choices(o.choices) } : o.placeholder ? { placeholder: o.placeholder } : null,
      display: o.choices ? 'labels' : null,
      required: Boolean(o.required),
      readonly: Boolean(o.readonly),
      hidden: Boolean(o.hidden),
      width: o.width ?? 'full',
      note: o.note ?? null,
      translations: es(label),
    },
    schema: { is_nullable: !o.required, default_value: o.default ?? null, max_length: o.max ?? 255, is_unique: Boolean(o.unique) },
  }),
  text: (field, label, o = {}) => ({
    field,
    type: 'text',
    meta: { interface: 'input-multiline', required: Boolean(o.required), note: o.note ?? null, width: 'full', translations: es(label) },
    schema: { is_nullable: !o.required },
  }),
  int: (field, label, o = {}) => ({
    field,
    type: 'integer',
    meta: { interface: 'input', readonly: Boolean(o.readonly), hidden: Boolean(o.hidden), width: o.width ?? 'half', note: o.note ?? null, translations: es(label) },
    schema: { is_nullable: o.default === undefined, default_value: o.default ?? null },
  }),
  float: (field, label, o = {}) => ({ field, type: 'float', meta: { interface: 'input', width: 'half', translations: es(label) }, schema: { is_nullable: true, default_value: o.default ?? null } }),
  json: (field, label, o = {}) => ({
    field,
    type: 'json',
    meta: {
      interface: 'input-code',
      options: { language: 'json', lineNumber: true, template: o.template ?? null },
      readonly: Boolean(o.readonly),
      hidden: Boolean(o.hidden),
      note: o.note ?? null,
      width: 'full',
      translations: es(label),
    },
    schema: { is_nullable: true },
  }),
  timestamp: (field, label, o = {}) => ({ field, type: 'timestamp', meta: { interface: 'datetime', readonly: Boolean(o.readonly), width: 'half', note: o.note ?? null, translations: es(label) }, schema: { is_nullable: true } }),
  date: (field, label, o = {}) => ({ field, type: 'date', meta: { interface: 'datetime', width: 'half', note: o.note ?? null, translations: es(label) }, schema: { is_nullable: true } }),
  m2o: (field, label, o = {}) => ({
    field,
    type: 'uuid',
    meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: Boolean(o.required), readonly: Boolean(o.readonly), width: o.width ?? 'half', note: o.note ?? null, options: o.template ? { template: o.template } : null, display: 'related-values', display_options: o.template ? { template: o.template } : null, translations: es(label) },
    schema: { is_nullable: !o.required },
  }),
  m2oInt: (field, label, o = {}) => ({ ...f.m2o(field, label, o), type: 'integer' }),
  file: (field, label) => ({ field, type: 'uuid', meta: { interface: 'file', special: ['file'], width: 'half', translations: es(label) }, schema: { is_nullable: true } }),
  o2m: (field, label, o = {}) => ({ field, type: 'alias', meta: { interface: 'list-o2m', special: ['o2m'], options: o.template ? { template: o.template } : null, width: 'full', translations: es(label) } }),
  userCreated: () => ({ field: 'user_created', type: 'uuid', meta: { special: ['user-created'], interface: 'select-dropdown-m2o', readonly: true, hidden: false, width: 'half', display: 'user', translations: es('Creado por') }, schema: { is_nullable: true } }),
  dateCreated: () => ({ field: 'date_created', type: 'timestamp', meta: { special: ['date-created'], interface: 'datetime', readonly: true, width: 'half', display: 'datetime', translations: es('Creado') }, schema: { is_nullable: true } }),
  dateUpdated: () => ({ field: 'date_updated', type: 'timestamp', meta: { special: ['date-updated'], interface: 'datetime', readonly: true, width: 'half', display: 'datetime', note: 'Para invalidar la caché sin conexión.', translations: es('Actualizado') }, schema: { is_nullable: true } }),
};

const STATUS = [['draft', 'Borrador'], ['needs_review', 'En revisión'], ['approved', 'Aprobado'], ['published', 'Publicado'], ['rejected', 'Rechazado'], ['deprecated', 'Retirado']];
const RISK = [['low', 'Bajo'], ['medium', 'Medio'], ['high', 'Alto']];
const KEY_NOTE = 'Identificador estable: minúsculas, números y guiones. Único en el curso.';
const SOURCES_NOTE = 'Lista de fuentes: [{"title": "Propio", "license": "proprietary-own"}]. Obligatoria para aprobar (regla 13).';
const LICENSE_CHOICES = [['proprietary-own', 'Propio · todos los derechos reservados'], ['private-personal-use', 'Uso personal privado'], ['cc-by-4.0', 'CC BY 4.0'], ['cc-by-sa-4.0', 'CC BY-SA 4.0'], ['cc0-1.0', 'CC0 / dominio público']];

// ─── Colecciones ─────────────────────────────────────────────────────────────────────────────────────────
const collections = [
  {
    collection: 'courses',
    meta: { icon: 'school', note: 'Curso o paquete de contenido.', display_template: '{{title}}', translations: [{ language: 'es-ES', translation: 'Cursos', singular: 'Curso', plural: 'Cursos' }] },
    fields: [
      f.id(),
      f.string('key', 'Identificador', { required: true, note: KEY_NOTE, width: 'half', max: 64 }),
      f.string('title', 'Título', { required: true, width: 'half' }),
      f.string('subject', 'Materia', { width: 'half', placeholder: 'idioma, programación…' }),
      f.string('status', 'Estado', { required: true, default: 'draft', width: 'half', choices: [['draft', 'Borrador'], ['published', 'Publicado'], ['archived', 'Archivado']] }),
      f.string('ui_language', 'Idioma de la interfaz', { required: true, default: 'es', width: 'half', max: 16 }),
      f.string('learner_language', 'Idioma del alumno', { required: true, default: 'es', width: 'half', max: 16 }),
      f.string('content_language', 'Idioma del contenido', { required: true, default: 'en', width: 'half', max: 16 }),
      f.string('visibility', 'Visibilidad', { required: true, default: 'public', width: 'half', choices: [['public', 'Todos los alumnos'], ['private', 'Solo el propietario']], note: 'Privado: solo lo ve su propietario (p. ej., material de uso personal, D-003).' }),
      f.m2o('owner', 'Propietario', { template: '{{first_name}} {{last_name}}' }),
      f.string('risk_level', 'Nivel de riesgo', { required: true, default: 'low', width: 'half', choices: RISK }),
      f.string('license', 'Licencia', { width: 'half', choices: LICENSE_CHOICES }),
      f.json('sources', 'Fuentes', { note: SOURCES_NOTE }),
      f.text('description', 'Descripción'),
      { field: 'audio_enabled', type: 'boolean', meta: { interface: 'boolean', width: 'half', note: 'Audio de pronunciación (idiomas). Desactívalo en materias donde no aporta (p. ej., Java).', translations: es('Audio activado') }, schema: { is_nullable: false, default_value: true } },
      f.int('new_per_session', 'Unidades nuevas por sesión', { default: 15, note: 'Ritmo del curso: inglés 15 palabras; un temario puede usar menos.' }),
      f.int('content_revision', 'Revisión del contenido', { default: 0, readonly: true, note: 'Sube cada vez que se publica algo del curso (caché sin conexión).' }),
      f.o2m('modules', 'Módulos', { template: '{{title}}' }),
      f.userCreated(),
      f.dateCreated(),
      f.dateUpdated(),
    ],
  },
  {
    collection: 'modules',
    meta: { icon: 'folder', note: 'Agrupación ordenada dentro de un curso (mundo, tema, habitación).', display_template: '{{title}}', sort_field: 'sort', translations: [{ language: 'es-ES', translation: 'Módulos', singular: 'Módulo', plural: 'Módulos' }] },
    fields: [
      f.id(),
      f.m2o('course', 'Curso', { required: true, template: '{{title}}' }),
      f.string('key', 'Identificador', { required: true, note: KEY_NOTE, width: 'half', max: 64 }),
      f.string('title', 'Título', { required: true, width: 'half' }),
      f.string('status', 'Estado', { required: true, default: 'draft', width: 'half', choices: [['draft', 'Borrador'], ['published', 'Publicado']] }),
      f.int('sort', 'Orden', { hidden: true }),
      f.text('description', 'Descripción'),
      f.o2m('units', 'Unidades', { template: '{{key}} · {{status}}' }),
      f.dateCreated(),
      f.dateUpdated(),
    ],
  },
  {
    collection: 'units',
    meta: { icon: 'lightbulb', note: 'Unidad de conocimiento. El contenido (payload) se valida según su tipo.', display_template: '{{key}} ({{type}})', sort_field: 'sort', translations: [{ language: 'es-ES', translation: 'Unidades', singular: 'Unidad', plural: 'Unidades' }] },
    fields: [
      f.id(),
      f.m2o('course', 'Curso', { required: true, template: '{{title}}' }),
      f.m2o('module', 'Módulo', { template: '{{title}}' }),
      f.string('key', 'Identificador', { required: true, note: KEY_NOTE, width: 'half', max: 64 }),
      f.string('type', 'Tipo', { required: true, width: 'half', choices: [['term', 'Término (palabra, expresión)'], ['pattern', 'Patrón (estructura)']] }),
      f.string('status', 'Estado', { required: true, default: 'draft', width: 'half', choices: STATUS }),
      f.string('risk_level', 'Nivel de riesgo', { required: true, default: 'low', width: 'half', choices: RISK }),
      f.string('language', 'Idioma del contenido', { width: 'half', max: 16, note: 'Si se deja vacío, se toma el del curso.' }),
      f.json('payload', 'Contenido', { note: 'Campos según el tipo. Al guardar se comprueba y se explica cualquier problema.' }),
      f.string('license', 'Licencia', { width: 'half', choices: LICENSE_CHOICES }),
      f.json('sources', 'Fuentes', { note: SOURCES_NOTE }),
      f.o2m('skills', 'Habilidades', { template: '{{key}} · {{kind}}' }),
      f.o2m('associations', 'Asociaciones', { template: '{{technique}} · {{status}}' }),
      f.o2m('media', 'Medios', { template: '{{kind}} · {{purpose}} · {{status}}' }),
      {
        field: 'preview',
        type: 'alias',
        meta: {
          interface: 'presentation-links',
          special: ['alias', 'no-data'],
          options: { links: [{ label: 'Vista previa como alumno', icon: 'visibility', type: 'normal', url: 'http://127.0.0.1:5173/preview/{{id}}' }] },
          width: 'half',
          note: 'Abre la unidad en la app tal como la verá el alumno (sin guardar progreso). La dirección la ajusta `APP_URL`.',
          translations: es('Vista previa'),
        },
      },
      f.m2o('reviewed_by', 'Revisado por', { readonly: true, template: '{{first_name}} {{last_name}}' }),
      f.timestamp('reviewed_at', 'Revisado', { readonly: true }),
      f.date('last_verified', 'Última verificación', { note: 'Contenido sensible: al caducar vuelve a revisión (H9).' }),
      f.int('version', 'Versión publicada', { default: 0, readonly: true, note: 'Sube al publicar (caché sin conexión).' }),
      f.timestamp('published_at', 'Publicado', { readonly: true }),
      f.int('sort', 'Orden', { hidden: true }),
      f.text('notes', 'Notas internas'),
      f.userCreated(),
      f.dateCreated(),
      f.dateUpdated(),
    ],
  },
  {
    collection: 'skills',
    meta: { icon: 'psychology', note: 'Capacidad ligada a una unidad. Se crean por defecto según el tipo.', display_template: '{{key}} · {{kind}}', sort_field: 'sort', translations: [{ language: 'es-ES', translation: 'Habilidades', singular: 'Habilidad', plural: 'Habilidades' }] },
    fields: [
      f.id(),
      f.m2o('unit', 'Unidad', { required: true, template: '{{key}}' }),
      f.string('key', 'Identificador', { required: true, note: KEY_NOTE, width: 'half', max: 96 }),
      f.string('kind', 'Tipo', { required: true, width: 'half', choices: [['recognize', 'Reconocer'], ['listen', 'Escuchar'], ['recall', 'Recordar'], ['produce', 'Producir'], ['apply', 'Aplicar'], ['speak', 'Hablar']] }),
      f.m2o('association', 'Asociación que recupera', { template: '{{technique}} · {{cue}}' }),
      f.int('sort', 'Orden', { hidden: true }),
    ],
  },
  {
    collection: 'associations',
    meta: { icon: 'auto_awesome', note: 'Ayuda de memoria con evidencia, validada por su técnica.', display_template: '{{technique}} · {{cue}}', translations: [{ language: 'es-ES', translation: 'Asociaciones', singular: 'Asociación', plural: 'Asociaciones' }] },
    fields: [
      f.id(),
      f.m2o('unit', 'Unidad', { required: true, template: '{{key}}' }),
      f.string('technique', 'Técnica', { required: true, width: 'half', choices: [['phonetic_bridge', 'Puente fonético'], ['absurd_scene', 'Escena absurda']] }),
      f.string('status', 'Estado', { required: true, default: 'draft', width: 'half', choices: STATUS }),
      f.string('cue', 'Palabra de apoyo', { width: 'half', note: 'Puente fonético: palabra real y familiar en la lengua del alumno.' }),
      f.string('language', 'Idioma', { width: 'half', max: 16, note: 'Si se deja vacío, se toma el del alumno del curso.' }),
      f.text('text', 'Escena', { note: 'Máximo 14 palabras, acción visual y la pieza clave en MAYÚSCULAS.' }),
      f.text('scene_target', 'Escena en el idioma del contenido', { note: 'La misma escena en el idioma que se aprende (p. ej., inglés), con la pieza clave en MAYÚSCULAS.' }),
      f.string('emoji', 'Ilustración provisional', { width: 'half', max: 32, note: 'Uno o dos emojis mientras no haya imagen aprobada.' }),
      f.json('evidence', 'Evidencia', { note: 'Puente fonético: {"familiarMeaning": "…", "soundRelation": "…", "differences": "…"}' }),
      f.string('origin', 'Origen', { required: true, default: 'human', width: 'half', choices: [['human', 'Persona'], ['ai', 'IA (borrador)']] }),
      f.string('license', 'Licencia', { width: 'half', choices: LICENSE_CHOICES }),
      f.json('sources', 'Fuentes', { note: SOURCES_NOTE }),
      f.m2o('reviewed_by', 'Revisado por', { readonly: true, template: '{{first_name}} {{last_name}}' }),
      f.timestamp('reviewed_at', 'Revisado', { readonly: true }),
      f.int('version', 'Versión publicada', { default: 0, readonly: true }),
      f.userCreated(),
      f.dateCreated(),
      f.dateUpdated(),
    ],
  },
  {
    collection: 'prerequisites',
    meta: { icon: 'account_tree', note: 'Algo no se puede practicar hasta que lo requerido esté preparado. Indica una unidad o una habilidad en cada lado.', translations: [{ language: 'es-ES', translation: 'Prerrequisitos', singular: 'Prerrequisito', plural: 'Prerrequisitos' }] },
    fields: [
      f.id(),
      f.m2o('course', 'Curso', { required: true, template: '{{title}}' }),
      f.m2o('subject_unit', 'Unidad que lo exige', { template: '{{key}}' }),
      f.m2o('subject_skill', 'Habilidad que lo exige', { template: '{{key}}' }),
      f.m2o('requires_unit', 'Unidad requerida', { template: '{{key}}' }),
      f.m2o('requires_skill', 'Habilidad requerida', { template: '{{key}}' }),
      f.text('note', 'Nota'),
    ],
  },
  {
    collection: 'media',
    meta: { icon: 'perm_media', note: 'Audio e imágenes con idioma, huella y licencia. Se generan por cola (H2.3).', display_template: '{{kind}} · {{purpose}}', translations: [{ language: 'es-ES', translation: 'Medios', singular: 'Medio', plural: 'Medios' }] },
    fields: [
      f.id(),
      f.m2o('unit', 'Unidad', { template: '{{key}}' }),
      f.m2o('association', 'Asociación', { template: '{{technique}} · {{cue}}' }),
      f.string('kind', 'Tipo', { required: true, width: 'half', choices: [['audio', 'Audio'], ['image', 'Imagen']] }),
      f.string('purpose', 'Uso', { width: 'half', placeholder: 'word_normal, word_slow, scene, example…' }),
      f.string('status', 'Estado', { required: true, default: 'pending', width: 'half', choices: [['pending', 'Pendiente'], ['ready', 'Generado'], ['approved', 'Aprobado'], ['rejected', 'Rechazado']] }),
      f.string('language', 'Idioma', { width: 'half', max: 16 }),
      f.text('text', 'Texto'),
      f.string('voice', 'Voz', { width: 'half' }),
      f.float('speed', 'Velocidad'),
      f.string('fingerprint', 'Huella', { width: 'full', readonly: true, note: 'texto + voz + velocidad + versión del léxico + idioma + modelo' }),
      f.file('file', 'Archivo'),
      f.int('size_bytes', 'Tamaño (bytes)', { readonly: true }),
      f.string('license', 'Licencia', { width: 'half', choices: LICENSE_CHOICES }),
      f.string('source', 'Origen', { width: 'half' }),
      f.int('version', 'Versión', { default: 0, readonly: true }),
      f.dateCreated(),
      f.dateUpdated(),
    ],
  },
  {
    collection: 'review_events',
    meta: { icon: 'history', note: 'Registro automático de cada cambio de estado: quién, de qué a qué y cuándo.', display_template: '{{collection}} · {{from_status}} → {{to_status}}', translations: [{ language: 'es-ES', translation: 'Historial de revisión', singular: 'Cambio de estado', plural: 'Historial de revisión' }] },
    fields: [
      f.id(),
      f.string('collection', 'Colección', { required: true, readonly: true, width: 'half', max: 64 }),
      f.string('item', 'Elemento', { required: true, readonly: true, width: 'half', max: 64 }),
      f.string('item_key', 'Identificador', { readonly: true, width: 'half', max: 96 }),
      f.string('from_status', 'De', { readonly: true, width: 'half', max: 32 }),
      f.string('to_status', 'A', { readonly: true, width: 'half', max: 32 }),
      f.m2o('user', 'Persona', { readonly: true, template: '{{first_name}} {{last_name}}' }),
      f.string('role', 'Rol', { readonly: true, width: 'half', max: 32 }),
      f.text('note', 'Nota'),
      f.dateCreated(),
    ],
  },
  {
    collection: 'content_versions',
    meta: { icon: 'inventory_2', note: 'Copia de cada versión publicada, para consultar o volver atrás (H8).', display_template: '{{collection}} · v{{version}}', translations: [{ language: 'es-ES', translation: 'Versiones publicadas', singular: 'Versión publicada', plural: 'Versiones publicadas' }] },
    fields: [
      f.id(),
      f.string('collection', 'Colección', { required: true, readonly: true, width: 'half', max: 64 }),
      f.string('item', 'Elemento', { required: true, readonly: true, width: 'half', max: 64 }),
      f.int('version', 'Versión', { readonly: true }),
      f.json('snapshot', 'Contenido publicado', { readonly: true }),
      f.m2o('user', 'Publicado por', { readonly: true, template: '{{first_name}} {{last_name}}' }),
      f.dateCreated(),
    ],
  },
  {
    collection: 'learning_events',
    meta: { icon: 'bolt', hidden: false, note: 'Exposiciones e intentos del alumno. Solo escribe el servidor (endpoint del H2.2a).', translations: [{ language: 'es-ES', translation: 'Eventos de aprendizaje', singular: 'Evento', plural: 'Eventos de aprendizaje' }] },
    fields: [
      f.serial(),
      f.string('event_key', 'Clave idempotente', { required: true, unique: true, readonly: true, max: 64, note: 'sha256(usuario:evento): el mismo evento enviado dos veces no se duplica.' }),
      f.string('event_id', 'Id del cliente', { required: true, readonly: true, max: 64 }),
      f.m2o('user', 'Alumno', { required: true, readonly: true, template: '{{email}}' }),
      f.m2o('course', 'Curso', { required: true, readonly: true, template: '{{title}}' }),
      f.string('kind', 'Tipo', { required: true, readonly: true, width: 'half', max: 32 }),
      f.json('payload', 'Evento', { readonly: true }),
      f.string('device_id', 'Dispositivo', { readonly: true, width: 'half', max: 64 }),
      f.int('device_seq', 'Orden en el dispositivo', { readonly: true }),
      f.timestamp('device_time', 'Hora del dispositivo', { readonly: true }),
      f.timestamp('received_at', 'Recibido en el servidor', { readonly: true }),
      f.int('schema_version', 'Versión del evento', { readonly: true }),
    ],
  },
  {
    collection: 'learner_states',
    meta: { icon: 'person_search', note: 'Instantánea del estado del alumno que recalcula el servidor (H2.2a).', translations: [{ language: 'es-ES', translation: 'Estados de alumno', singular: 'Estado de alumno', plural: 'Estados de alumno' }] },
    fields: [
      f.id(),
      f.m2o('user', 'Alumno', { required: true, readonly: true, template: '{{email}}' }),
      f.m2o('course', 'Curso', { required: true, readonly: true, template: '{{title}}' }),
      f.json('snapshot', 'Estado', { readonly: true }),
      f.int('cursor', 'Último evento aplicado', { readonly: true }),
      f.dateUpdated(),
    ],
  },
  {
    collection: 'session_positions',
    meta: { icon: 'bookmark', note: 'Punto exacto en el que va cada sesión, para reanudarla (H2.2a).', translations: [{ language: 'es-ES', translation: 'Posiciones de sesión', singular: 'Posición de sesión', plural: 'Posiciones de sesión' }] },
    fields: [
      f.id(),
      f.m2o('user', 'Alumno', { required: true, readonly: true, template: '{{email}}' }),
      f.m2o('course', 'Curso', { required: true, readonly: true, template: '{{title}}' }),
      f.string('session_id', 'Sesión', { required: true, readonly: true, max: 64 }),
      f.string('step', 'Paso', { readonly: true, width: 'half', max: 64 }),
      f.json('state', 'Estado de la sesión', { readonly: true }),
      f.string('device_id', 'Dispositivo', { readonly: true, width: 'half', max: 64 }),
      f.timestamp('device_time', 'Hora del dispositivo', { readonly: true }),
      f.dateUpdated(),
    ],
  },
  {
    collection: 'daily_plans',
    meta: { icon: 'event_note', note: 'Plan del día calculado por el servidor (H2.2a).', translations: [{ language: 'es-ES', translation: 'Planes del día', singular: 'Plan del día', plural: 'Planes del día' }] },
    fields: [
      f.id(),
      f.m2o('user', 'Alumno', { required: true, readonly: true, template: '{{email}}' }),
      f.m2o('course', 'Curso', { required: true, readonly: true, template: '{{title}}' }),
      f.int('day', 'Día', { readonly: true }),
      f.json('plan', 'Plan', { readonly: true }),
      f.dateCreated(),
    ],
  },
];

// Relaciones: [colección, campo, colección relacionada, al borrar, campo o2m en la otra colección, orden]
const relations = [
  ['courses', 'owner', 'directus_users', 'SET NULL'],
  ['courses', 'user_created', 'directus_users', 'SET NULL'],
  ['modules', 'course', 'courses', 'CASCADE', 'modules', 'sort'],
  ['units', 'course', 'courses', 'CASCADE'],
  ['units', 'module', 'modules', 'SET NULL', 'units', 'sort'],
  ['units', 'reviewed_by', 'directus_users', 'SET NULL'],
  ['units', 'user_created', 'directus_users', 'SET NULL'],
  ['skills', 'unit', 'units', 'CASCADE', 'skills', 'sort'],
  ['skills', 'association', 'associations', 'SET NULL'],
  ['associations', 'unit', 'units', 'CASCADE', 'associations'],
  ['associations', 'reviewed_by', 'directus_users', 'SET NULL'],
  ['associations', 'user_created', 'directus_users', 'SET NULL'],
  ['prerequisites', 'course', 'courses', 'CASCADE'],
  ['prerequisites', 'subject_unit', 'units', 'CASCADE'],
  ['prerequisites', 'subject_skill', 'skills', 'CASCADE'],
  ['prerequisites', 'requires_unit', 'units', 'CASCADE'],
  ['prerequisites', 'requires_skill', 'skills', 'CASCADE'],
  ['media', 'unit', 'units', 'CASCADE', 'media'],
  ['media', 'association', 'associations', 'SET NULL'],
  ['media', 'file', 'directus_files', 'SET NULL'],
  ['review_events', 'user', 'directus_users', 'SET NULL'],
  ['content_versions', 'user', 'directus_users', 'SET NULL'],
  ['learning_events', 'user', 'directus_users', 'CASCADE'],
  ['learning_events', 'course', 'courses', 'CASCADE'],
  ['learner_states', 'user', 'directus_users', 'CASCADE'],
  ['learner_states', 'course', 'courses', 'CASCADE'],
  ['session_positions', 'user', 'directus_users', 'CASCADE'],
  ['session_positions', 'course', 'courses', 'CASCADE'],
  ['daily_plans', 'user', 'directus_users', 'CASCADE'],
  ['daily_plans', 'course', 'courses', 'CASCADE'],
];

let created = 0;
for (const { collection, meta, fields } of collections) {
  const aliases = fields.filter((x) => x.type === 'alias');
  const real = fields.filter((x) => x.type !== 'alias');
  if (!(await exists(`/collections/${collection}`))) {
    await api('POST', '/collections', { collection, meta, schema: {}, fields: real });
    console.log(`+ colección ${collection}`);
    created += 1;
  } else {
    for (const field of real) {
      if (!(await exists(`/fields/${collection}/${field.field}`))) {
        await api('POST', `/fields/${collection}`, field);
        console.log(`+ campo ${collection}.${field.field}`);
        created += 1;
      }
    }
  }
  for (const alias of aliases) {
    if (!(await exists(`/fields/${collection}/${alias.field}`))) {
      await api('POST', `/fields/${collection}`, alias);
      created += 1;
    }
  }
}
for (const [collection, field, related, onDelete, oneField, sortField] of relations) {
  if (await exists(`/relations/${collection}/${field}`)) continue;
  await api('POST', '/relations', {
    collection,
    field,
    related_collection: related,
    meta: { one_field: oneField ?? null, sort_field: sortField ?? null, one_deselect_action: 'nullify' },
    schema: { on_delete: onDelete },
  });
  console.log(`+ relación ${collection}.${field} → ${related}`);
  created += 1;
}
console.log(created ? `Esquema actualizado (${created} cambios).` : 'Esquema al día: no había nada que crear.');

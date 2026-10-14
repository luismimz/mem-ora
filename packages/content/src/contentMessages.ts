// Mensajes en español para el autor y el revisor sobre problemas de contenido y del flujo de estados.
import type { ContentIssue } from './issues';
import type { Locale } from './catalogMessages';

const FIELD_ES: Record<string, string> = {
  type: 'tipo',
  payload: 'contenido',
  form: 'forma',
  text: 'texto',
  meaning: 'significado',
  name: 'nombre',
  gist: 'idea clave',
  exercises: 'ejercicios',
  prompt: 'pregunta',
  code: 'código',
  answer: 'respuesta',
  accepted: 'otras respuestas',
  distractors: 'opciones falsas',
  steps: 'pasos',
  mapping: 'qué corresponde a qué',
  lines: 'líneas de código',
  note: 'comentario',
  breaksWhere: 'dónde deja de valer',
  definition: 'definición',
  answers: 'respuestas aceptadas',
  contrast: 'no confundir con',
  explanation: 'explicación',
  partOfSpeech: 'categoría',
  pronunciation: 'pronunciación',
  ipa: 'AFI',
  respelling: 'pronunciación figurada',
  examples: 'ejemplos',
  translation: 'traducción',
  source: 'fuente',
  sources: 'fuentes',
  license: 'licencia',
  notes: 'notas',
  goal: 'meta',
  rule: 'regla',
  pieces: 'piezas',
  role: 'papel',
  hint: 'pista',
  pitfalls: 'avisos',
  status: 'estado',
  key: 'identificador',
  cue: 'palabra de apoyo',
  evidence: 'evidencia',
  familiarMeaning: 'significado conocido',
  soundRelation: 'parecido sonoro',
  differences: 'diferencias',
  technique: 'técnica',
  course: 'curso',
  title: 'título',
  association: 'asociación',
  scene: 'escena',
  sceneTarget: 'escena en el idioma del contenido',
  emoji: 'ilustración',
  contentLanguage: 'idioma del contenido',
  newPerSession: 'nuevas por sesión',
  modes: 'modos',
  schemaVersion: 'versión del archivo',
  visibility: 'visibilidad',
};

const LIST_ITEM_ES: Record<string, string> = { examples: 'Ejemplo', pieces: 'Pieza', pitfalls: 'Aviso', answers: 'Respuesta', exercises: 'Ejercicio', distractors: 'Opción falsa', steps: 'Paso', lines: 'Línea', accepted: 'Respuesta', modules: 'Módulo', units: 'Unidad' };

/** «examples.2.text» → «Ejemplo 3 › texto». */
export function fieldLabel(path: string): string {
  if (!path) return 'Contenido';
  const parts = path.split('.');
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    const next = parts[i + 1];
    if (next !== undefined && /^\d+$/.test(next) && LIST_ITEM_ES[part]) {
      out.push(`${LIST_ITEM_ES[part]} ${Number(next) + 1}`);
      i += 1;
    } else out.push(FIELD_ES[part] ?? part);
  }
  const label = out.join(' › ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const STATUS_ES: Record<string, string> = {
  draft: 'borrador',
  needs_review: 'en revisión',
  approved: 'aprobado',
  published: 'publicado',
  rejected: 'rechazado',
  deprecated: 'retirado',
};
const ROLE_ES: Record<string, string> = { admin: 'administración', author: 'autoría', reviewer: 'revisión' };
const RISK_ES: Record<string, string> = { low: 'bajo', medium: 'medio', high: 'alto' };
const list = (value: unknown, map: Record<string, string>) =>
  String(value ?? '')
    .split(', ')
    .filter(Boolean)
    .map((x) => `«${map[x] ?? x}»`)
    .join(', ');

type Template = (p: ContentIssue['params'], field: string) => string;

const es: Record<string, Template> = {
  required: (_, f) => `${f}: es obligatorio.`,
  not_text: (_, f) => `${f}: debe ser un texto.`,
  not_list: (_, f) => `${f}: debe ser una lista.`,
  not_object: (_, f) => `${f}: tiene un formato incorrecto (se esperaba un grupo de campos).`,
  surrounding_spaces: (_, f) => `${f}: sobran espacios al principio o al final.`,
  too_short: (p, f) => `${f}: es demasiado corto (mínimo ${p.min} caracteres).`,
  too_long: (p, f) => `${f}: es demasiado largo (${p.length} caracteres; máximo ${p.max}).`,
  invalid_choice: (p, f) => `${f}: valor no válido. Opciones: ${p.choices}.`,
  unknown_field: (p, f) => `${f}: este campo no existe (¿una errata?). Campos válidos: ${p.allowed}.`,
  min_items: (p, f) => `${f}: hay ${p.count} y hacen falta al menos ${p.min}.`,
  duplicate_example: (_, f) => `${f}: este ejemplo está repetido.`,
  rule_multiline: (_, f) => `${f}: la regla debe caber en una sola línea.`,
  code_multiline: (_, f) => `${f}: una línea de código por elemento (sin saltos de línea).`,
  pattern_without_slot: (_, f) => `${f}: al menos una pieza debe ser un hueco («slot») que el alumno rellene.`,
  unknown_unit_type: (p, f) => `${f}: tipo de unidad desconocido. Tipos disponibles: ${p.types}.`,
  analogy_too_long: (p, f) => `${f}: la analogía tiene ${p.words} palabras; el máximo es ${p.max}.`,
  gap_missing: (_p, f) => `${f}: marca el hueco con ___ (tres guiones bajos).`,
  distractor_is_answer: (_p, f) => `${f}: una opción falsa coincide con la respuesta.`,
  story_too_long: (p, f) => `${f}: la historia tiene ${p.words} palabras; el máximo es ${p.max}.`,
  note_not_in_story: (_p, f) => `${f}: nombra en MAYÚSCULAS un elemento que aparezca en la historia (así la línea queda atada a ella).`,
  scene_too_long: (p, f) => `${f}: la escena tiene ${p.words} palabras; el máximo es ${p.max}.`,
  scene_without_highlight: (_, f) => `${f}: resalta la pieza clave en MAYÚSCULAS (por ejemplo, «Un BURRO te PIDE PRESTADO el móvil»).`,
  scene_without_cue: (p, f) => `${f}: la escena debe incluir la palabra de apoyo «${p.cue}».`,
  unknown_technique: (p, f) => `${f}: técnica desconocida. Disponibles: ${p.techniques}.`,
  technique_not_for_unit_type: (p, f) => `${f}: la técnica «${p.technique}» no sirve para unidades de tipo «${p.unitType}» (sí para: ${p.unitTypes}).`,
  file_version: (p, f) => `${f}: debe ser ${p.expected}.`,
  course_exists: (p) => `Ya existe un curso con el identificador «${p.key}». Cambia «course.key» o borra el anterior.`,
  key_taken: (p, f) => `${f}: ya hay otro elemento con el identificador «${p.key}» en este curso.`,
  key_format: (_, f) => `${f}: usa solo minúsculas, números y guiones (por ejemplo, «run-out-of»).`,
  transition_not_allowed: (p) =>
    `No se puede pasar de «${STATUS_ES[String(p.from)] ?? p.from}» a «${STATUS_ES[String(p.to)] ?? p.to}».` +
    (p.allowed ? ` Desde «${STATUS_ES[String(p.from)] ?? p.from}» puedes pasar a: ${list(p.allowed, STATUS_ES)}.` : ''),
  transition_forbidden_for_role: (p) =>
    `Tu rol no puede pasar de «${STATUS_ES[String(p.from)] ?? p.from}» a «${STATUS_ES[String(p.to)] ?? p.to}». Puede hacerlo: ${list(p.roles, ROLE_ES)}.`,
  content_has_issues: (p) => `Hay ${p.count} ${Number(p.count) === 1 ? 'problema' : 'problemas'} en el contenido; corrígelos antes de cambiar el estado.`,
  missing_source: () => 'Falta la fuente: indica de dónde sale el contenido (propio, obra, enlace).',
  missing_license: () => 'Falta la licencia del contenido.',
  reviewer_must_differ: (p) => `El contenido de riesgo ${RISK_ES[String(p.risk)] ?? p.risk} debe aprobarlo una persona distinta de quien lo creó.`,
  not_reviewed: () => 'No consta ninguna revisión: apruébalo antes de publicarlo.',
  content_locked: (p) =>
    `El contenido está «${STATUS_ES[String(p.status)] ?? p.status}» y no se puede editar. Devuélvelo a borrador para cambiarlo.`,
  requires_unpublished: (p) => `Esta unidad exige «${p.key}», que aún no está publicada. Publica antes «${p.key}» o quita el prerrequisito.`,
  parent_locked: (p) => `La unidad «${p.key}» está «${STATUS_ES[String(p.status)] ?? p.status}»: sus habilidades no se pueden cambiar. Devuélvela a borrador primero.`,
  prerequisite_needs_both_sides: () => 'Un prerrequisito necesita exactamente una unidad o habilidad que lo exige y una unidad o habilidad requerida.',
  catalog_invalid: (p) => `El curso tendría ${p.count} ${Number(p.count) === 1 ? 'error' : 'errores'} de estructura:`,
};

export function describeContentIssue(issue: ContentIssue, locale: Locale = 'es'): string {
  const templates: Record<Locale, Record<string, Template>> = { es };
  const template = templates[locale][issue.code];
  const field = fieldLabel(issue.path);
  return template ? template(issue.params, field) : `${field}: ${issue.code}`;
}

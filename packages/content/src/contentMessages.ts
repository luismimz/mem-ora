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
  words: 'palabras',
  decoys: 'palabras falsas',
  scenes: 'escenas',
  emojis: 'emojis',
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
  stage: 'escena dibujada',
  e: 'emoji',
  chant: 'la cadena',
  tense: 'tiempo verbal',
  cases: 'casos para reconocer',
  widget: 'componente dibujado',
  bugLine: 'línea del error',
  line: 'línea que se señala',
  timeline: 'línea del tiempo',
  signals: 'pistas',
  drills: '¿qué tiempo pide?',
  practice: 'frases de práctica',
  wrong: 'formas que no encajan',
  signal: 'pista',
  at: 'posición',
  to: 'hasta',
  label: 'etiqueta',
  q: 'pregunta',
  a: 'respuesta',
  es: 'traducción',
  x: 'posición horizontal',
  y: 'posición vertical',
  s: 'tamaño',
  z: 'capa',
  sceneTarget: 'escena en el idioma del contenido',
  emoji: 'ilustración',
  contentLanguage: 'idioma del contenido',
  newPerSession: 'nuevas por sesión',
  modes: 'modos',
  schemaVersion: 'versión del archivo',
  visibility: 'visibilidad',
};

const LIST_ITEM_ES: Record<string, string> = { examples: 'Ejemplo', pieces: 'Pieza', pitfalls: 'Aviso', answers: 'Respuesta', exercises: 'Ejercicio', distractors: 'Opción falsa', steps: 'Paso', words: 'Palabra', decoys: 'Palabra falsa', scenes: 'Escena', stage: 'Actor', chant: 'Verso', timeline: 'Marca', signals: 'Pista', drills: 'Frase', practice: 'Frase de práctica', cases: 'Caso', wrong: 'Forma', lines: 'Línea', accepted: 'Respuesta', modules: 'Módulo', units: 'Unidad' };

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
  mirror_bad_order: (_p, f) => `${f}: el orden en inglés debe usar cada pieza una sola vez (0, 1, 2…).`,
  mirror_mismatch: (p, f) => `${f}: las piezas en inglés dicen «${p.got}» y la frase es «${p.want}».`,
  mirror_signal_es: (_p, f) => `${f}: un semáforo (do, did, will) no lleva español; si la pieza tiene español, es «word».`,
  stage_out_of_bounds: (_p, f) => `${f}: la posición va de 0 a 100 dentro del escenario.`,
  stage_bad_scale: (p, f) => `${f}: el tamaño va de ${p.min} a ${p.max} (1 es el normal).`,
  stage_bad_layer: (_p, f) => `${f}: la capa es un número entero (mayor, más delante).`,
  stage_too_few: (p) => `La escena que cambia necesita al menos ${p.min} ejemplos con escena (hay ${p.count}).`,
  chant_one_answer: (p) => `La cadena necesita al menos ${p.min} respuestas distintas; si todas son iguales no hay nada que elegir.`,
  stage_duplicate: (p, f) => `${f}: es la misma escena que la del ejemplo ${Number(p.other) + 1}; en el juego no se podrían distinguir.`,
  mirror_why_without_from: (_p, f) => `${f}: el «por qué» solo se ve si la pieza cambia («from»); añade «from» o quítalo.`,
  story_too_long: (p, f) => `${f}: la historia tiene ${p.words} palabras; el máximo es ${p.max}.`,
  note_not_in_story: (_p, f) => `${f}: nombra en MAYÚSCULAS un elemento que aparezca en la historia (así la línea queda atada a ella).`,
  duplicate_word: (p, f) => `${f}: «${p.word}» está repetida en la lista.`,
  decoy_in_list: (p, f) => `${f}: «${p.word}» es una palabra falsa pero también está en la lista.`,
  word_not_in_story: (p, f) => `${f}: «${p.word}» no aparece en la historia.`,
  word_out_of_order: (p, f) => `${f}: «${p.word}» aparece en la historia, pero no en el orden de la lista.`,
  timeline_position: (_p, f) => `${f}: la posición va de -3 (antes) a 3 (después); 0 es ahora, y «hasta» va después de «posición».`,
  signal_not_in_text: (_p, f) => `${f}: la pista tiene que aparecer en la frase.`,
  answers_not_multi: (_p, f) => `${f}: solo los ejercicios «varias correctas» (multi_choice) llevan varias respuestas correctas.`,
  line_not_spot: (_p, f) => `${f}: solo los ejercicios «señala la parte» (spot_part) llevan línea que señalar.`,
  bugline_not_bug: (_p, f) => `${f}: solo los ejercicios «encontrar el error» (find_bug) llevan línea del error.`,
  bugline_out_of_code: (p, f) => `${f}: la línea va de 0 a ${Number(p.lines) - 1} (el código tiene ${p.lines}).`,
  duplicate_option: (_p, f) => `${f}: hay formas repetidas.`,
  max_items: (p, f) => `${f}: como máximo ${p.max} (hay ${p.count}).`,
  scene_too_long: (p, f) => `${f}: la escena tiene ${p.words} palabras; el máximo es ${p.max}.`,
  scene_without_highlight: (_, f) => `${f}: resalta la pieza clave en MAYÚSCULAS (por ejemplo, «Un BURRO te PIDE PRESTADO el móvil»).`,
  scene_without_cue: (p, f) => `${f}: la escena debe incluir la palabra de apoyo «${p.cue}».`,
  unknown_technique: (p, f) => `${f}: técnica desconocida. Disponibles: ${p.techniques}.`,
  technique_not_for_unit_type: (p, f) => `${f}: la técnica «${p.technique}» no sirve para unidades de tipo «${p.unitType}» (sí para: ${p.unitTypes}).`,
  file_version: (p, f) => `${f}: debe ser ${p.expected}.`,
  course_missing: (p) => `No existe el curso «${p.key}» al que añadir. Impórtalo primero sin «añadir».`,
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

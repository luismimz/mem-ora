// Tipos de conocimiento con su esquema de `payload`, su validador y sus habilidades por defecto.
// `term` y `pattern` (idiomas) y `concept` (cualquier materia: Java, redes, temarios). Añadir un tipo es el único cambio
// que puede requerir código (regla 3).
// Los campos de texto van en el idioma que declara el curso: `text` en el del contenido; `meaning` y
// `translation`, en el del alumno.
import type { SkillKind } from '@memora/core';
import { checkChoice, checkText, checkUnknownFields, isRecord, issue, type ContentIssue } from './issues';

export const UNIT_TYPES = ['term', 'pattern', 'concept'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const TERM_FORMS = ['word', 'chunk', 'phrasal_verb', 'expression'] as const;

export interface Example {
  text: string;
  translation: string;
  /** De dónde sale el ejemplo si no es propio (obra, enlace, licencia). */
  source?: string;
}

export interface TermPayload {
  form: (typeof TERM_FORMS)[number];
  text: string;
  meaning: string;
  partOfSpeech?: string;
  pronunciation?: { ipa?: string; respelling?: string };
  examples: Example[];
  notes?: string;
}

export interface PatternPiece {
  text: string;
  /** `fixed`: siempre igual; `slot`: el alumno lo rellena. */
  role: 'fixed' | 'slot';
  hint?: string;
}

export interface PatternPayload {
  /** Lo que el alumno podrá hacer: «Pedir algo prestado». */
  goal: string;
  /** La regla en una línea, después de descubrirla. */
  rule: string;
  pieces: PatternPiece[];
  examples: Example[];
  /** Dónde la equivalencia deja de funcionar. */
  pitfalls?: string[];
}

export interface ConceptExample {
  /** Ejemplo: código, caso, cifra… */
  text: string;
  /** Qué muestra el ejemplo (opcional: un concepto no tiene «traducción»). */
  explanation?: string;
  source?: string;
}

/** Concepto de cualquier materia: «class», «subred», «TCP». */
export interface ConceptPayload {
  /** Nombre que el alumno debe recordar. */
  name: string;
  /** La idea en pocas palabras («molde para crear objetos»): la usan la historia y los juegos. */
  gist: string;
  /** Definición completa, en la tarjeta. */
  definition: string;
  /** Otras respuestas que se dan por buenas al recordar el nombre («clase», «Class»). */
  answers?: string[];
  examples: ConceptExample[];
  /** Con qué no confundirlo («≠ objeto: el objeto es lo que sale del molde»). */
  contrast?: string;
  notes?: string;
}

export const PAYLOAD_LIMITS = {
  termText: 80,
  meaning: 120,
  exampleText: 160,
  ruleLength: 140,
  conceptName: 80,
  gist: 60,
  definition: 400,
  patternMinExamples: 3,
  patternMinPieces: 2,
} as const;

function checkExamples(issues: ContentIssue[], value: unknown, min: number): void {
  if (!Array.isArray(value)) {
    issues.push(issue(value === undefined ? 'required' : 'not_list', 'examples'));
    return;
  }
  if (value.length < min) issues.push(issue('min_items', 'examples', { min, count: value.length }));
  const seen = new Set<string>();
  value.forEach((ex, i) => {
    const path = `examples.${i}`;
    if (!isRecord(ex)) return void issues.push(issue('not_object', path));
    checkUnknownFields(issues, ex, path, ['text', 'translation', 'source']);
    checkText(issues, ex.text, `${path}.text`, { max: PAYLOAD_LIMITS.exampleText });
    checkText(issues, ex.translation, `${path}.translation`, { max: PAYLOAD_LIMITS.exampleText });
    checkText(issues, ex.source, `${path}.source`, { required: false, max: 300 });
    const key = typeof ex.text === 'string' ? ex.text.trim().toLowerCase() : '';
    if (key && seen.has(key)) issues.push(issue('duplicate_example', `${path}.text`));
    seen.add(key);
  });
}

function validateTerm(p: Record<string, unknown>): ContentIssue[] {
  const issues: ContentIssue[] = [];
  checkUnknownFields(issues, p, '', ['form', 'text', 'meaning', 'partOfSpeech', 'pronunciation', 'examples', 'notes']);
  checkChoice(issues, p.form, 'form', TERM_FORMS);
  checkText(issues, p.text, 'text', { max: PAYLOAD_LIMITS.termText });
  checkText(issues, p.meaning, 'meaning', { max: PAYLOAD_LIMITS.meaning });
  checkText(issues, p.partOfSpeech, 'partOfSpeech', { required: false, max: 40 });
  checkText(issues, p.notes, 'notes', { required: false, max: 500 });
  if (p.pronunciation !== undefined) {
    if (!isRecord(p.pronunciation)) issues.push(issue('not_object', 'pronunciation'));
    else {
      checkUnknownFields(issues, p.pronunciation, 'pronunciation', ['ipa', 'respelling']);
      checkText(issues, p.pronunciation.ipa, 'pronunciation.ipa', { required: false, max: 80 });
      checkText(issues, p.pronunciation.respelling, 'pronunciation.respelling', { required: false, max: 80 });
    }
  }
  checkExamples(issues, p.examples, 1);
  return issues;
}

function validatePattern(p: Record<string, unknown>): ContentIssue[] {
  const issues: ContentIssue[] = [];
  checkUnknownFields(issues, p, '', ['goal', 'rule', 'pieces', 'examples', 'pitfalls']);
  checkText(issues, p.goal, 'goal', { max: 120 });
  checkText(issues, p.rule, 'rule', { max: PAYLOAD_LIMITS.ruleLength });
  if (typeof p.rule === 'string' && /\n/.test(p.rule)) issues.push(issue('rule_multiline', 'rule'));
  if (!Array.isArray(p.pieces)) issues.push(issue(p.pieces === undefined ? 'required' : 'not_list', 'pieces'));
  else {
    if (p.pieces.length < PAYLOAD_LIMITS.patternMinPieces) issues.push(issue('min_items', 'pieces', { min: PAYLOAD_LIMITS.patternMinPieces, count: p.pieces.length }));
    p.pieces.forEach((piece, i) => {
      const path = `pieces.${i}`;
      if (!isRecord(piece)) return void issues.push(issue('not_object', path));
      checkUnknownFields(issues, piece, path, ['text', 'role', 'hint']);
      checkText(issues, piece.text, `${path}.text`, { max: 60 });
      checkChoice(issues, piece.role, `${path}.role`, ['fixed', 'slot']);
      checkText(issues, piece.hint, `${path}.hint`, { required: false, max: 80 });
    });
    if (!p.pieces.some((x) => isRecord(x) && x.role === 'slot')) issues.push(issue('pattern_without_slot', 'pieces'));
  }
  checkExamples(issues, p.examples, PAYLOAD_LIMITS.patternMinExamples);
  if (p.pitfalls !== undefined) {
    if (!Array.isArray(p.pitfalls)) issues.push(issue('not_list', 'pitfalls'));
    else p.pitfalls.forEach((t, i) => checkText(issues, t, `pitfalls.${i}`, { max: 200 }));
  }
  return issues;
}

function validateConcept(p: Record<string, unknown>): ContentIssue[] {
  const issues: ContentIssue[] = [];
  checkUnknownFields(issues, p, '', ['name', 'gist', 'definition', 'answers', 'examples', 'contrast', 'notes']);
  checkText(issues, p.name, 'name', { max: PAYLOAD_LIMITS.conceptName });
  checkText(issues, p.gist, 'gist', { max: PAYLOAD_LIMITS.gist });
  checkText(issues, p.definition, 'definition', { max: PAYLOAD_LIMITS.definition });
  checkText(issues, p.contrast, 'contrast', { required: false, max: 200 });
  checkText(issues, p.notes, 'notes', { required: false, max: 500 });
  if (p.answers !== undefined) {
    if (!Array.isArray(p.answers)) issues.push(issue('not_list', 'answers'));
    else p.answers.forEach((a, i) => checkText(issues, a, `answers.${i}`, { max: PAYLOAD_LIMITS.conceptName }));
  }
  if (!Array.isArray(p.examples)) issues.push(issue(p.examples === undefined ? 'required' : 'not_list', 'examples'));
  else {
    if (p.examples.length < 1) issues.push(issue('min_items', 'examples', { min: 1, count: 0 }));
    p.examples.forEach((ex, i) => {
      const path = `examples.${i}`;
      if (!isRecord(ex)) return void issues.push(issue('not_object', path));
      checkUnknownFields(issues, ex, path, ['text', 'explanation', 'source']);
      checkText(issues, ex.text, `${path}.text`, { max: 600 });
      checkText(issues, ex.explanation, `${path}.explanation`, { required: false, max: 200 });
      checkText(issues, ex.source, `${path}.source`, { required: false, max: 300 });
    });
  }
  return issues;
}

const VALIDATORS: Record<UnitType, (p: Record<string, unknown>) => ContentIssue[]> = { term: validateTerm, pattern: validatePattern, concept: validateConcept };

/** Problemas del `payload` de una unidad según su tipo. Vacío si es válido. */
export function validateUnitPayload(type: unknown, payload: unknown): ContentIssue[] {
  if (typeof type !== 'string' || !(UNIT_TYPES as readonly string[]).includes(type)) return [issue('unknown_unit_type', 'type', { types: UNIT_TYPES.join(', ') })];
  if (!isRecord(payload)) return [issue(payload === undefined || payload === null ? 'required' : 'not_object', 'payload')];
  return VALIDATORS[type as UnitType](payload);
}

/** Habilidades que se crean por defecto al crear una unidad (el autor puede cambiarlas). */
export const DEFAULT_SKILLS: Record<UnitType, Array<{ suffix: string; kind: SkillKind; carriesAssociation?: boolean }>> = {
  term: [
    { suffix: 'listen', kind: 'listen' },
    { suffix: 'recall', kind: 'recall', carriesAssociation: true },
    { suffix: 'produce', kind: 'produce' },
  ],
  // «Aplicar» (caso o minidiálogo) se añadirá cuando exista esa experiencia: una habilidad que la sesión no puede
  // practicar dejaría la unidad sin poder llegar nunca a «aprendida».
  pattern: [
    { suffix: 'recall', kind: 'recall', carriesAssociation: true },
    { suffix: 'produce', kind: 'produce' },
  ],
  // Concepto: recordar el nombre a partir de la idea. Producir o aplicar llegarán con sus ejercicios (código, casos).
  concept: [{ suffix: 'recall', kind: 'recall', carriesAssociation: true }],
};

/** Plantilla vacía para empezar a escribir una unidad desde el administrador. */
export function emptyPayload(type: UnitType): TermPayload | PatternPayload | ConceptPayload {
  if (type === 'concept') return { name: '', gist: '', definition: '', examples: [{ text: '' }] };
  return type === 'term'
    ? { form: 'word', text: '', meaning: '', examples: [{ text: '', translation: '' }] }
    : { goal: '', rule: '', pieces: [{ text: '', role: 'fixed' }, { text: '', role: 'slot' }], examples: [{ text: '', translation: '' }, { text: '', translation: '' }, { text: '', translation: '' }] };
}

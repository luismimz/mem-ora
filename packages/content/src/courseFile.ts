// Archivo de curso en JSON (importar y exportar). Un curso completo: datos del curso, módulos y unidades con su
// asociación. Lo que se importa entra SIEMPRE como borrador (regla 12: nadie publica sin revisión).
import { checkChoice, checkText, checkUnknownFields, isRecord, issue, type ContentIssue } from './issues';
import { validateUnitPayload, type PatternPayload, type TermPayload } from './unitTypes';

export const COURSE_FILE_VERSION = 1;
export const COURSE_MODES = ['associations', 'grammar', 'arcade', 'chat'] as const;
const KEY = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export interface AssociationEntry {
  technique: string;
  cue?: string;
  scene: string;
  sceneTarget?: string;
  emoji?: string;
  evidence?: Record<string, string>;
}

export interface UnitEntry {
  key: string;
  type: 'term' | 'pattern';
  // term
  form?: TermPayload['form'];
  text?: string;
  meaning?: string;
  partOfSpeech?: string;
  pronunciation?: string | { ipa?: string; respelling?: string };
  notes?: string;
  // pattern
  goal?: string;
  rule?: string;
  pieces?: PatternPayload['pieces'];
  pitfalls?: string[];
  // común
  examples: Array<{ text: string; translation: string; source?: string }>;
  association?: AssociationEntry;
  license?: string;
  sources?: Array<{ title: string; url?: string; license?: string }>;
}

export interface CourseFile {
  schemaVersion: number;
  course: {
    key: string;
    title: string;
    subject?: string;
    uiLanguage?: string;
    learnerLanguage?: string;
    contentLanguage: string;
    newPerSession?: number;
    audio?: boolean;
    modes?: Array<(typeof COURSE_MODES)[number]>;
    visibility?: 'public' | 'private';
    riskLevel?: 'low' | 'medium' | 'high';
    license?: string;
    sources?: Array<{ title: string; url?: string; license?: string }>;
    description?: string;
  };
  modules: Array<{ key: string; title: string; units: UnitEntry[] }>;
}

/** Convierte una unidad del archivo en el `payload` validado por su tipo. */
export function unitPayload(u: UnitEntry): TermPayload | PatternPayload {
  if (u.type === 'pattern') {
    return { goal: u.goal ?? '', rule: u.rule ?? '', pieces: u.pieces ?? [], examples: u.examples ?? [], ...(u.pitfalls ? { pitfalls: u.pitfalls } : {}) };
  }
  const text = u.text ?? '';
  const pronunciation = typeof u.pronunciation === 'string' ? { respelling: u.pronunciation } : u.pronunciation;
  return {
    form: u.form ?? (text.includes(' ') ? 'expression' : 'word'),
    text,
    meaning: u.meaning ?? '',
    examples: u.examples ?? [],
    ...(u.partOfSpeech ? { partOfSpeech: u.partOfSpeech } : {}),
    ...(pronunciation ? { pronunciation } : {}),
    ...(u.notes ? { notes: u.notes } : {}),
  };
}

const prefix = (issues: ContentIssue[], path: string) => issues.map((i) => ({ ...i, path: i.path ? `${path}.${i.path}` : path }));

/**
 * Comprueba la forma del archivo y el contenido de cada unidad. La técnica de cada asociación la valida el servidor
 * con su módulo de técnicas. Devuelve los problemas con la ruta exacta (p. ej., `modules.0.units.3.meaning`).
 */
export function validateCourseFile(data: unknown): ContentIssue[] {
  if (!isRecord(data)) return [issue('not_object', '')];
  const issues: ContentIssue[] = [];
  checkUnknownFields(issues, data, '', ['schemaVersion', 'course', 'modules']);
  if (data.schemaVersion !== COURSE_FILE_VERSION) issues.push(issue('file_version', 'schemaVersion', { expected: COURSE_FILE_VERSION }));

  const c = data.course;
  if (!isRecord(c)) issues.push(issue(c === undefined ? 'required' : 'not_object', 'course'));
  else {
    checkUnknownFields(issues, c, 'course', ['key', 'title', 'subject', 'uiLanguage', 'learnerLanguage', 'contentLanguage', 'newPerSession', 'audio', 'modes', 'visibility', 'riskLevel', 'license', 'sources', 'description']);
    if (typeof c.key !== 'string' || !KEY.test(c.key)) issues.push(issue('key_format', 'course.key'));
    checkText(issues, c.title, 'course.title', { max: 120 });
    checkText(issues, c.contentLanguage, 'course.contentLanguage', { max: 16 });
    checkChoice(issues, c.visibility, 'course.visibility', ['public', 'private'], false);
    checkChoice(issues, c.riskLevel, 'course.riskLevel', ['low', 'medium', 'high'], false);
    if (c.newPerSession !== undefined && (!Number.isInteger(c.newPerSession) || (c.newPerSession as number) < 1 || (c.newPerSession as number) > 50)) issues.push(issue('invalid_choice', 'course.newPerSession', { choices: '1–50' }));
    if (c.modes !== undefined && (!Array.isArray(c.modes) || c.modes.some((m) => !(COURSE_MODES as readonly unknown[]).includes(m)))) issues.push(issue('invalid_choice', 'course.modes', { choices: COURSE_MODES.join(', ') }));
  }

  if (!Array.isArray(data.modules) || !data.modules.length) {
    issues.push(issue(data.modules === undefined ? 'required' : 'min_items', 'modules', { min: 1, count: 0 }));
    return issues;
  }
  const moduleKeys = new Set<string>();
  const unitKeys = new Set<string>();
  data.modules.forEach((m, mi) => {
    const mp = `modules.${mi}`;
    if (!isRecord(m)) return void issues.push(issue('not_object', mp));
    checkUnknownFields(issues, m, mp, ['key', 'title', 'units']);
    if (typeof m.key !== 'string' || !KEY.test(m.key)) issues.push(issue('key_format', `${mp}.key`));
    else if (moduleKeys.has(m.key)) issues.push(issue('key_taken', `${mp}.key`, { key: m.key }));
    else moduleKeys.add(m.key);
    checkText(issues, m.title, `${mp}.title`, { max: 120 });
    if (!Array.isArray(m.units) || !m.units.length) return void issues.push(issue('min_items', `${mp}.units`, { min: 1, count: 0 }));
    m.units.forEach((u, ui) => {
      const up = `${mp}.units.${ui}`;
      if (!isRecord(u)) return void issues.push(issue('not_object', up));
      checkUnknownFields(issues, u, up, ['key', 'type', 'form', 'text', 'meaning', 'partOfSpeech', 'pronunciation', 'notes', 'goal', 'rule', 'pieces', 'pitfalls', 'examples', 'association', 'license', 'sources']);
      if (typeof u.key !== 'string' || !KEY.test(u.key)) issues.push(issue('key_format', `${up}.key`));
      else if (unitKeys.has(u.key)) issues.push(issue('key_taken', `${up}.key`, { key: u.key }));
      else unitKeys.add(u.key);
      if (u.type !== 'term' && u.type !== 'pattern') return void issues.push(issue('invalid_choice', `${up}.type`, { choices: 'term, pattern' }));
      issues.push(...prefix(validateUnitPayload(u.type, unitPayload(u as unknown as UnitEntry)), up));
      if (u.association !== undefined) {
        const a = u.association;
        if (!isRecord(a)) issues.push(issue('not_object', `${up}.association`));
        else {
          checkUnknownFields(issues, a, `${up}.association`, ['technique', 'cue', 'scene', 'sceneTarget', 'emoji', 'evidence']);
          checkText(issues, a.sceneTarget, `${up}.association.sceneTarget`, { required: false, max: 200 });
          checkText(issues, a.emoji, `${up}.association.emoji`, { required: false, max: 32 });
        }
      }
    });
  });
  return issues;
}

// Técnicas pedagógicas como módulos. Cada una declara qué tipos de unidad admite, qué campos añade a la
// asociación y su validador. Lo que no se puede comprobar con código (que el puente sea una palabra real y
// familiar, que la escena se imagine bien) queda para la revisión humana, y el validador lo recuerda.
import { checkText, checkUnknownFields, isRecord, issue, wordCount, type ContentIssue, type UnitType } from '@memora/content';

export interface AssociationInput {
  technique: unknown;
  /** Palabra o expresión de apoyo en la lengua del alumno (el puente, la analogía…). */
  cue?: unknown;
  /** Escena o explicación breve. */
  text: unknown;
  /** Datos propios de la técnica. */
  evidence?: unknown;
}

export interface Technique {
  id: string;
  unitTypes: readonly UnitType[];
  /** Campos de `evidence` que añade. */
  evidenceFields: readonly string[];
  /** Comprobaciones que solo puede hacer una persona (se muestran al revisor). */
  reviewChecklist: readonly string[];
  validate(input: AssociationInput): ContentIssue[];
}

/** Máximo de palabras de una escena (CLAUDE.md). */
export const SCENE_MAX_WORDS = 14;

/** La pieza clave va resaltada en MAYÚSCULAS («Un BURRO te PIDE PRESTADO el móvil»). */
export const hasHighlight = (text: string): boolean => /\p{Lu}{2,}/u.test(text);

function checkScene(issues: ContentIssue[], text: unknown): void {
  checkText(issues, text, 'text', { max: 200 });
  if (typeof text !== 'string' || !text.trim()) return;
  const words = wordCount(text);
  if (words > SCENE_MAX_WORDS) issues.push(issue('scene_too_long', 'text', { words, max: SCENE_MAX_WORDS }));
  if (!hasHighlight(text)) issues.push(issue('scene_without_highlight', 'text'));
}

const absurdScene: Technique = {
  id: 'absurd_scene',
  unitTypes: ['term', 'pattern', 'concept'],
  evidenceFields: [],
  reviewChecklist: ['review_scene_visual_action', 'review_scene_shows_meaning'],
  validate(input) {
    const issues: ContentIssue[] = [];
    checkScene(issues, input.text);
    return issues;
  },
};

const BRIDGE_EVIDENCE = ['familiarMeaning', 'soundRelation', 'differences'] as const;

const phoneticBridge: Technique = {
  id: 'phonetic_bridge',
  unitTypes: ['term'],
  evidenceFields: BRIDGE_EVIDENCE,
  reviewChecklist: ['review_bridge_real_word', 'review_bridge_sounds_alike', 'review_scene_visual_action'],
  validate(input) {
    const issues: ContentIssue[] = [];
    checkText(issues, input.cue, 'cue', { max: 60 });
    checkScene(issues, input.text);
    if (typeof input.cue === 'string' && typeof input.text === 'string' && input.cue.trim()) {
      const cue = input.cue.trim().toLocaleLowerCase();
      if (!input.text.toLocaleLowerCase().includes(cue)) issues.push(issue('scene_without_cue', 'text', { cue: input.cue.trim() }));
    }
    if (!isRecord(input.evidence)) {
      issues.push(issue(input.evidence === undefined || input.evidence === null ? 'required' : 'not_object', 'evidence'));
      return issues;
    }
    checkUnknownFields(issues, input.evidence, 'evidence', BRIDGE_EVIDENCE);
    checkText(issues, input.evidence.familiarMeaning, 'evidence.familiarMeaning', { max: 160 });
    checkText(issues, input.evidence.soundRelation, 'evidence.soundRelation', { max: 300 });
    checkText(issues, input.evidence.differences, 'evidence.differences', { max: 300 });
    return issues;
  },
};

/** Máximo de palabras de una analogía: es una explicación breve, no una escena. */
export const ANALOGY_MAX_WORDS = 25;
const ANALOGY_EVIDENCE = ['mapping', 'breaksWhere'] as const;

/**
 * Analogía: el concepto se parece a algo cotidiano («una clase es un MOLDE de galletas»). Exige decir qué corresponde a
 * qué y dónde deja de valer la comparación, para que no enseñe algo falso.
 */
const analogy: Technique = {
  id: 'analogy',
  unitTypes: ['concept', 'pattern'],
  evidenceFields: ANALOGY_EVIDENCE,
  reviewChecklist: ['review_analogy_familiar', 'review_analogy_mapping_true', 'review_analogy_limit_stated'],
  validate(input) {
    const issues: ContentIssue[] = [];
    checkText(issues, input.cue, 'cue', { max: 60 });
    checkText(issues, input.text, 'text', { max: 240 });
    if (typeof input.text === 'string' && input.text.trim()) {
      const words = wordCount(input.text);
      if (words > ANALOGY_MAX_WORDS) issues.push(issue('analogy_too_long', 'text', { words, max: ANALOGY_MAX_WORDS }));
      if (!hasHighlight(input.text)) issues.push(issue('scene_without_highlight', 'text'));
    }
    if (!isRecord(input.evidence)) {
      issues.push(issue(input.evidence === undefined || input.evidence === null ? 'required' : 'not_object', 'evidence'));
      return issues;
    }
    checkUnknownFields(issues, input.evidence, 'evidence', ANALOGY_EVIDENCE);
    checkText(issues, input.evidence.mapping, 'evidence.mapping', { max: 300 });
    checkText(issues, input.evidence.breaksWhere, 'evidence.breaksWhere', { max: 300 });
    return issues;
  },
};

export const TECHNIQUES: Record<string, Technique> = { [absurdScene.id]: absurdScene, [phoneticBridge.id]: phoneticBridge, [analogy.id]: analogy };

/** Problemas de una asociación para una unidad de cierto tipo. */
export function validateAssociation(input: AssociationInput, unitType: string): ContentIssue[] {
  const technique = typeof input.technique === 'string' ? TECHNIQUES[input.technique] : undefined;
  if (!technique) return [issue('unknown_technique', 'technique', { techniques: Object.keys(TECHNIQUES).join(', ') })];
  if (!(technique.unitTypes as readonly string[]).includes(unitType)) {
    return [issue('technique_not_for_unit_type', 'technique', { technique: technique.id, unitType, unitTypes: technique.unitTypes.join(', ') })];
  }
  return technique.validate(input);
}

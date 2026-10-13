// Mensajes para el autor sobre los problemas del catálogo. El núcleo da códigos y datos; aquí se redactan
// por idioma (regla 15). Cada mensaje dice qué está mal y cómo arreglarlo, sin jerga interna.
import type { CatalogIssue, CatalogIssueCode } from '@memora/core';

export type Locale = 'es';

export interface IssueText {
  message: string;
  fix: string;
}

type Params = CatalogIssue['params'];
type Template = (p: Params) => IssueText;

/** «unit:k3» → «la unidad «k3»»; «skill:k3.recall» → «la habilidad «k3.recall»». */
function ref(value: string | number | undefined): string {
  const text = String(value ?? '');
  if (text.startsWith('unit:')) return `la unidad «${text.slice(5)}»`;
  if (text.startsWith('skill:')) return `la habilidad «${text.slice(6)}»`;
  return `«${text}»`;
}

const KIND_ES: Record<string, string> = {
  recognize: 'reconocer',
  listen: 'escuchar',
  recall: 'recordar',
  produce: 'producir',
  apply: 'aplicar',
  speak: 'hablar',
};
const kinds = (value: string | number | undefined) =>
  String(value ?? '')
    .split(', ')
    .map((k) => KIND_ES[k] ?? k)
    .join(', ');

const STATUS_ES: Record<string, string> = {
  learning: 'en aprendizaje',
  consolidating: 'en consolidación',
  learned: 'aprendida',
  stable: 'estable',
  mastered: 'dominada',
};

const es: Record<CatalogIssueCode, Template> = {
  duplicate_unit: (p) => ({
    message: `Hay dos unidades con el mismo identificador «${p.unit}».`,
    fix: 'Cambia el identificador de una de ellas.',
  }),
  duplicate_skill: (p) => ({
    message: `Hay dos habilidades con el mismo identificador «${p.skill}».`,
    fix: 'Cambia el identificador de una de ellas.',
  }),
  skill_unknown_unit: (p) => ({
    message: `La habilidad «${p.skill}» pertenece a una unidad que no existe («${p.unit}»).`,
    fix: 'Asígnala a una unidad del curso o crea esa unidad.',
  }),
  prerequisite_unknown_subject: (p) => ({
    message: `El prerrequisito n.º ${Number(p.index) + 1} se aplica a ${ref(p.subject)}, que no existe.`,
    fix: 'Elige una unidad o habilidad del curso, o borra el prerrequisito.',
  }),
  prerequisite_unknown_requirement: (p) => ({
    message: `${capital(ref(p.subject))} exige ${ref(p.requirement)}, que no existe.`,
    fix: 'Elige como requisito una unidad o habilidad del curso, o borra el prerrequisito.',
  }),
  prerequisite_self: (p) => ({
    message: `${capital(ref(p.subject))} se exige a sí misma (${ref(p.requirement)}).`,
    fix: 'Un prerrequisito debe apuntar a otra unidad. Bórralo o cambia el requisito.',
  }),
  prerequisite_cycle: (p) => ({
    message: `Hay un círculo de prerrequisitos: ${p.path}. Ninguna de esas habilidades podría empezarse nunca.`,
    fix: 'Quita uno de los prerrequisitos del círculo.',
  }),
  prerequisite_unreachable: (p) =>
    p.reason === 'recognition_only'
      ? {
          message:
            `${capital(ref(p.subject))} exige ${ref(p.requirement)}, que es solo de ${kinds(p.kind)}. ` +
            `Reconocer nunca llega a «${STATUS_ES[String(p.minStatus)] ?? p.minStatus}», así que el alumno se quedaría bloqueado para siempre.`,
          fix: 'Exige en su lugar una habilidad de recordar, producir, aplicar o escuchar con dictado, o la unidad completa.',
        }
      : {
          message:
            `${capital(ref(p.subject))} exige ${ref(p.requirement)}, pero esa unidad solo tiene habilidades de reconocer. ` +
            'Nunca estaría preparada, así que el alumno se quedaría bloqueado para siempre.',
          fix: 'Añade a esa unidad una habilidad de recordar, producir, aplicar o escuchar, o borra el prerrequisito.',
        },
  unit_without_skills: (p) => ({
    message: `La unidad «${p.unit}» no tiene ninguna habilidad: no se puede practicar.`,
    fix: 'Añádele al menos una habilidad, por ejemplo recordar.',
  }),
  unit_cannot_be_learned: (p) => ({
    message: `La unidad «${p.unit}» solo tiene habilidades de ${kinds(p.kinds)}. Se puede practicar, pero nunca llegará a «aprendida».`,
    fix: 'Si quieres que cuente como aprendida, añade una habilidad de recordar, producir, aplicar o escuchar.',
  }),
  unit_limited_formats: (p) => ({
    message:
      `${p.count} ${Number(p.count) === 1 ? 'unidad admite' : 'unidades admiten'} menos de ${p.expected} formatos de recuperación sin ayuda ` +
      `(${p.units}${Number(p.more) > 0 ? ` y ${p.more} más` : ''}). ${Number(p.count) === 1 ? 'Podrá llegar a «dominada», pero se comprobará' : 'Podrán llegar a «dominada», pero se comprobarán'} de menos maneras.`,
    fix: 'No hace falta cambiar nada. Si quieres más variedad, añade a esas unidades otra habilidad (por ejemplo, escuchar o producir).',
  }),
  association_never_retrieved: (p) => ({
    message: `La ayuda de memoria «${p.association}» solo aparece en habilidades de reconocer (${p.skills}). Nunca se pediría recordarla, así que no se podrá saber si funciona.`,
    fix: 'Vincúlala a una habilidad de recordar o producir.',
  }),
};

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const TEMPLATES: Record<Locale, Record<CatalogIssueCode, Template>> = { es };

export function describeCatalogIssue(issue: CatalogIssue, locale: Locale = 'es'): IssueText {
  return TEMPLATES[locale][issue.code](issue.params);
}

// pnpm catalog-demo → muestra cómo explica el validador los problemas de varios catálogos (prueba humana del H2.0).
import { resolveConfig, validateCatalog, type Catalog } from '@memora/core';
import { describeCatalogIssue } from '@memora/content';
import { languageCourse, programmingCourse } from './courses';

const config = resolveConfig();

const examples: Array<{ title: string; catalog: Catalog }> = [
  { title: 'Curso de idioma de la simulación', catalog: languageCourse() },
  { title: 'Curso de programación de la simulación', catalog: programmingCourse() },
  {
    title: 'Prerrequisito sobre una habilidad de solo reconocer',
    catalog: {
      units: [{ id: 'join', courseId: 'sql', type: 'concept' }, { id: 'join-query', courseId: 'sql', type: 'command' }],
      skills: [
        { id: 'join.recognize', unitId: 'join', kind: 'recognize' },
        { id: 'join.recall', unitId: 'join', kind: 'recall', associationId: 'join.analogy' },
        { id: 'join-query.produce', unitId: 'join-query', kind: 'produce' },
      ],
      prerequisites: [{ subject: { unit: 'join-query' }, requires: { skill: 'join.recognize' } }],
    },
  },
  {
    title: 'Unidad de imagen que solo se reconoce, exigida por otra',
    catalog: {
      units: [{ id: 'heart-diagram', courseId: 'anat', type: 'image_label' }, { id: 'heart-cycle', courseId: 'anat', type: 'procedure' }],
      skills: [
        { id: 'heart-diagram.label', unitId: 'heart-diagram', kind: 'recognize', associationId: 'heart.palace' },
        { id: 'heart-cycle.recall', unitId: 'heart-cycle', kind: 'recall' },
      ],
      prerequisites: [{ subject: { unit: 'heart-cycle' }, requires: { unit: 'heart-diagram' } }],
    },
  },
  {
    title: 'Círculo de prerrequisitos y errores de escritura',
    catalog: {
      units: [{ id: 'borrow', courseId: 'en', type: 'term' }, { id: 'can-i', courseId: 'en', type: 'pattern' }, { id: 'charger', courseId: 'en', type: 'term' }],
      skills: [
        { id: 'borrow.recall', unitId: 'borrow', kind: 'recall' },
        { id: 'can-i.produce', unitId: 'can-i', kind: 'produce' },
        { id: 'charger.recall', unitId: 'chargr', kind: 'recall' },
      ],
      prerequisites: [
        { subject: { unit: 'can-i' }, requires: { unit: 'borrow' } },
        { subject: { unit: 'borrow' }, requires: { skill: 'can-i.produce' } },
        { subject: { unit: 'charger' }, requires: { skill: 'charger.listen' } },
      ],
    },
  },
];

for (const { title, catalog } of examples) {
  const issues = validateCatalog(catalog, config);
  const errors = issues.filter((i) => i.severity === 'error').length;
  console.log(`\n## ${title}\n${errors ? `${errors} error(es): no se podría publicar.` : 'Sin errores: se puede publicar.'}`);
  for (const issue of issues) {
    const { message, fix } = describeCatalogIssue(issue);
    const label = { error: 'ERROR', warning: 'aviso', info: 'info' }[issue.severity];
    console.log(`\n- [${label}] ${message}\n  ${issue.severity === 'info' ? 'Nota' : 'Cómo arreglarlo'}: ${fix}`);
  }
}

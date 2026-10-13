import { describe, expect, it } from 'vitest';
import { CATALOG_ISSUE_CODES, resolveConfig, validateCatalog, type Catalog, type CatalogIssue } from '@memora/core';
import { describeCatalogIssue } from '../src';

const config = resolveConfig();

describe('mensajes del catálogo', () => {
  it('todos los códigos tienen mensaje y arreglo, sin datos sin rellenar', () => {
    for (const code of CATALOG_ISSUE_CODES) {
      const params: CatalogIssue['params'] = { index: 0, subject: 'unit:b', requirement: 'skill:a.see', skill: 'a.see', kind: 'recognize', reason: 'recognition_only', minStatus: 'consolidating', unit: 'u', kinds: 'recognize', count: 7, units: 'a, b', more: 2, expected: 3, association: 'as', skills: 's1', path: 'a → b → a' };
      const text = describeCatalogIssue({ code, severity: 'error', params });
      expect(text.message.length, code).toBeGreaterThan(10);
      expect(text.fix.length, code).toBeGreaterThan(10);
      expect(`${text.message} ${text.fix}`, code).not.toMatch(/undefined|\[object|NaN/);
    }
  });

  it('explica en lenguaje del autor el prerrequisito sobre reconocimiento puro', () => {
    const catalog: Catalog = {
      units: [{ id: 'a', courseId: 'c', type: 'concept' }, { id: 'b', courseId: 'c', type: 'command' }],
      skills: [
        { id: 'a.see', unitId: 'a', kind: 'recognize' },
        { id: 'a.recall', unitId: 'a', kind: 'recall' },
        { id: 'b.produce', unitId: 'b', kind: 'produce' },
      ],
      prerequisites: [{ subject: { unit: 'b' }, requires: { skill: 'a.see' } }],
    };
    const issue = validateCatalog(catalog, config).find((i) => i.code === 'prerequisite_unreachable')!;
    expect(describeCatalogIssue(issue).message).toBe(
      'La unidad «b» exige la habilidad «a.see», que es solo de reconocer. Reconocer nunca llega a «en consolidación», así que el alumno se quedaría bloqueado para siempre.',
    );
  });
});

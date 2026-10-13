import { describe, expect, it } from 'vitest';
import { SKILL_STATUSES, UNIT_LEVELS } from '@memora/core';
import { t, type MessageKey } from '../src/i18n';

describe('textos de la interfaz', () => {
  it('sustituye los datos y deja visibles los que faltan', () => {
    expect(t('session.progress', { current: 2, total: 9 })).toBe('Paso 2 de 9');
    expect(t('step.recall.meaning', {})).toBe('¿Cómo se dice «{prompt}»?');
  });

  it('existen todas las claves que la app construye a partir de datos', () => {
    const dynamic = [
      ...SKILL_STATUSES.map((s) => `status.${s}`),
      ...UNIT_LEVELS.map((l) => `level.${l}`),
      ...['too_short', 'missing_piece', 'copied_example'].map((p) => `step.produce.${p}`),
    ];
    for (const key of dynamic) expect(t(key as MessageKey), key).not.toMatch(/undefined/);
  });
});

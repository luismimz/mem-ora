import { describe, expect, it } from 'vitest';
import { rejectReason } from '../src/api/learning';

// 6-nov-2026: las respuestas del Repaso rápido «del español al inglés» (recall_cued) llegaban con pista 0 y se
// rechazaban en silencio; las palabras maduras nunca sumaban intentos y abrían siempre el repaso.
describe('las respuestas del Arcade y del Taller se aceptan', () => {
  const skills = new Map([['nose.recall', { unitKey: 'nose', associationId: undefined }]]) as never;
  const base = { id: 'abcdefgh-1234', at: Date.now(), deviceId: 'd', seq: 1, courseId: 'c', unitKey: 'nose', skillKey: 'nose.recall', kind: 'attempt', correct: true, timeMs: 900, contextId: 'nose#repaso' };
  it('reconocer (inglés → español)', () => expect(rejectReason({ ...base, format: 'recognition_choice', hint: 0 }, skills, 'c')).toBeNull());
  it('del español al inglés eligiendo: recall_cued con pista 1', () => expect(rejectReason({ ...base, format: 'recall_cued', hint: 1 }, skills, 'c')).toBeNull());
  it('recall_cued sin pista sigue siendo inválido (por eso el cliente manda 1)', () => expect(rejectReason({ ...base, format: 'recall_cued', hint: 0 }, skills, 'c')).toBe('invalid_attempt'));
});

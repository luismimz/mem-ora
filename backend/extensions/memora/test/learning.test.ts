import { describe, expect, it } from 'vitest';
import { resolveConfig } from '@memora/core';
import type { ClientEvent } from '@memora/experiences';
import { effectiveTime, FUTURE_TOLERANCE_MS, recompute, rejectReason, sessionUnits, skillIndex, type StoredEvent } from '../src/api/learning';

const config = resolveConfig();
const units = sessionUnits(
  [{ id: 'u1', key: 'borrow', type: 'term', language: null, version: 1, payload: { form: 'word', text: 'borrow', meaning: 'pedir prestado', examples: [{ text: 'Can I borrow it?', translation: '¿Me lo prestas?' }] } }],
  [
    { id: 's1', key: 'borrow.recall', kind: 'recall', unit: 'u1', association: 'a1', sort: 1 },
    { id: 's2', key: 'borrow.listen', kind: 'listen', unit: 'u1', association: null, sort: 0 },
    { id: 's3', key: 'borrow.produce', kind: 'produce', unit: 'u1', association: 'a2', sort: 2 },
  ],
  [
    { id: 'a1', unit: 'u1', technique: 'phonetic_bridge', cue: 'burro', text: 'Un BURRO te PIDE PRESTADO el móvil.', status: 'published' },
    { id: 'a2', unit: 'u1', technique: 'absurd_scene', cue: null, text: 'BORRADOR sin publicar.', status: 'draft' },
  ],
  'en',
);
const skills = skillIndex(units);
const event = (patch: Partial<ClientEvent> = {}): ClientEvent => ({ id: 'evt-00000001', kind: 'attempt', at: 1_000_000, deviceId: 'mac', seq: 1, courseId: 'c1', unitKey: 'borrow', skillKey: 'borrow.recall', associationId: 'a1', format: 'recall_unaided', correct: true, hint: 0, timeMs: 2000, ...patch });

describe('unidades de la sesión', () => {
  it('ordena las habilidades, toma el idioma del curso y solo usa asociaciones publicadas', () => {
    const u = units.borrow!;
    expect(u.skills.map((s) => s.key)).toEqual(['borrow.listen', 'borrow.recall', 'borrow.produce']);
    expect(u.language).toBe('en');
    expect(u.association?.id).toBe('a1');
    expect(u.skills.find((s) => s.key === 'borrow.produce')?.associationId).toBeNull();
  });
});

describe('validación de eventos', () => {
  it('acepta un intento correcto', () => {
    expect(rejectReason(event(), skills, 'c1')).toBeNull();
    expect(rejectReason(event({ kind: 'exposure', format: undefined, correct: undefined, hint: undefined, timeMs: undefined }), skills, 'c1')).toBeNull();
  });

  it('rechaza lo que no cuadra con el curso publicado o con el núcleo', () => {
    const cases: Array<[Partial<ClientEvent>, string]> = [
      [{ id: 'x' }, 'bad_id'],
      [{ courseId: 'otro' }, 'wrong_course'],
      [{ skillKey: 'nada.recall' }, 'unknown_skill'],
      [{ unitKey: 'otra' }, 'wrong_unit'],
      [{ associationId: 'a2' }, 'wrong_association'],
      [{ format: 'adivinar' as never }, 'bad_format'],
      [{ hint: 7 as never }, 'bad_hint'],
      [{ format: 'recall_unaided', hint: 2 }, 'invalid_attempt'],
      [{ seq: -1 }, 'bad_seq'],
      [{ doubt: 'sí' as never }, 'bad_doubt'],
    ];
    for (const [patch, reason] of cases) expect(rejectReason(event(patch), skills, 'c1'), reason).toBe(reason);
    expect(rejectReason(null, skills, 'c1')).toBe('not_object');
  });
});

describe('hora y recálculo', () => {
  it('una hora del dispositivo en el futuro se sustituye por la de recepción', () => {
    expect(effectiveTime(1000, 1000 + FUTURE_TOLERANCE_MS)).toBe(1000);
    expect(effectiveTime(1000 + FUTURE_TOLERANCE_MS + 10, 1000)).toBe(1000);
  });

  it('recalcula el estado a partir de todos los eventos, en orden, y aparta los inválidos', () => {
    const stored: StoredEvent[] = [
      { event_id: 'evt-00000002', kind: 'attempt', device_time: 2000, payload: event({ id: 'evt-00000002', at: 2000 }) },
      { event_id: 'evt-00000001', kind: 'exposure', device_time: 1000, payload: event({ id: 'evt-00000001', kind: 'exposure', at: 1000 }) },
      { event_id: 'evt-00000003', kind: 'attempt', device_time: 3000, payload: event({ id: 'evt-00000003', at: 3000, format: 'recall_cued', hint: 0 }) },
    ];
    const { learner, skipped } = recompute('u', stored, config);
    expect(learner.skills['borrow.recall']?.status).toBe('learning');
    expect(learner.skills['borrow.recall']?.attempts).toBe(1);
    expect(skipped).toEqual(['evt-00000003']);
  });

  it('«No estoy seguro» llega al núcleo: el acierto dudoso no saca la palabra de tus fallos', () => {
    const stored: StoredEvent[] = [
      { event_id: 'evt-00000011', kind: 'attempt', device_time: 1000, payload: event({ id: 'evt-00000011', at: 1000, correct: false }) },
      { event_id: 'evt-00000012', kind: 'attempt', device_time: 2000, payload: event({ id: 'evt-00000012', at: 2000, doubt: true }) },
    ];
    expect(rejectReason(stored[1]!.payload, skills, 'c1')).toBeNull();
    expect(recompute('u', stored, config).learner.skills['borrow.recall']?.consecutiveFailures).toBe(1);
    const sure = [stored[0]!, { ...stored[1]!, payload: event({ id: 'evt-00000012', at: 2000 }) }];
    expect(recompute('u', sure, config).learner.skills['borrow.recall']?.consecutiveFailures).toBe(0);
  });
});

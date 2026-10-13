import { resolveConfig, type Attempt, type ExerciseFormat, type Exposure, type HintLevel } from '../src';

export const config = resolveConfig();
export const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);

let counter = 0;
export function attempt(partial: Partial<Attempt> & { at: number }): Attempt {
  counter += 1;
  const format: ExerciseFormat = partial.format ?? 'recall_unaided';
  const hint: HintLevel = partial.hint ?? (format === 'recall_cued' ? 1 : 0);
  return {
    id: partial.id ?? `a${counter}`,
    userId: partial.userId ?? 'u1',
    skillId: partial.skillId ?? 's1',
    unitId: partial.unitId ?? 'k1',
    associationId: partial.associationId,
    format,
    correct: partial.correct ?? true,
    hint,
    timeMs: partial.timeMs ?? 2_000,
    at: partial.at,
  };
}

export function exposure(partial: Partial<Exposure> & { at: number }): Exposure {
  counter += 1;
  return {
    id: partial.id ?? `e${counter}`,
    userId: partial.userId ?? 'u1',
    skillId: partial.skillId ?? 's1',
    unitId: partial.unitId ?? 'k1',
    associationId: partial.associationId,
    at: partial.at,
  };
}

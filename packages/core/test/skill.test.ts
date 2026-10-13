import { describe, expect, it } from 'vitest';
import { DAY, HOUR, adaptiveScheduler, applySkillAttempt, exposeSkill, newSkillState, type Attempt, type SkillState } from '../src';
import { T0, attempt, config } from './helpers';

const start = (): SkillState => exposeSkill(newSkillState('s1', 'k1', config), T0, adaptiveScheduler, config);
const run = (state: SkillState, attempts: Attempt[]): SkillState => attempts.reduce((s, a) => applySkillAttempt(s, a, adaptiveScheduler, config).state, state);
/** Aprendida el día T0 + 3 d: dos aciertos el día 0 y dos éxitos diferidos. */
const learned = (): SkillState =>
  run(start(), [
    attempt({ at: T0 + 60_000, format: 'production' }),
    attempt({ at: T0 + 120_000, format: 'production' }),
    attempt({ at: T0 + DAY }),
    attempt({ at: T0 + 3 * DAY }),
  ]);

describe('estados de la habilidad', () => {
  it('presentar no es aprender: new → presented, y el primer intento la deja en aprendizaje', () => {
    const presented = start();
    expect(presented.status).toBe('presented');
    expect(presented.dueAt).toBe(T0 + HOUR);
    expect(run(presented, [attempt({ at: T0 + 60_000 })]).status).toBe('learning');
  });

  it('un acierto por reconocimiento no consolida, ni repetido durante semanas', () => {
    const attempts = Array.from({ length: 40 }, (_, i) => attempt({ at: T0 + (i + 1) * DAY, format: 'recognition_choice' }));
    const s = run(start(), attempts);
    expect(s.status).toBe('learning');
    expect(s.deferredSuccesses).toBe(0);
  });

  it('nada pasa a «aprendida» sin éxito diferido, aunque se acierte mucho el mismo día', () => {
    const attempts = Array.from({ length: 20 }, (_, i) => attempt({ at: T0 + (i + 1) * 60_000, format: 'production' }));
    const s = run(start(), attempts);
    expect(s.status).toBe('consolidating');
    expect(s.deferredSuccesses).toBe(0);
  });

  it('con pista tampoco hay éxito diferido', () => {
    const attempts = Array.from({ length: 10 }, (_, i) => attempt({ at: T0 + (i + 1) * DAY, format: 'recall_cued', hint: 1 }));
    expect(run(start(), attempts).status).toBe('consolidating');
  });

  it('pasa a «aprendida» con dos éxitos diferidos en recuperación sin pista', () => {
    const s = learned();
    expect(s.status).toBe('learned');
    expect(s.deferredSuccesses).toBeGreaterThanOrEqual(2);
  });

  it('un fallo de recuperación debilita lo aprendido; un éxito diferido lo devuelve a consolidación', () => {
    const weakened = run(learned(), [attempt({ at: T0 + 10 * DAY, correct: false })]);
    expect(weakened.status).toBe('weakened');
    expect(weakened.lapses).toBe(1);
    expect(run(weakened, [attempt({ at: T0 + 11 * DAY })]).status).toBe('consolidating');
  });

  it('fallar el reconocimiento no debilita lo aprendido', () => {
    expect(run(learned(), [attempt({ at: T0 + 10 * DAY, format: 'recognition_choice', correct: false })]).status).toBe('learned');
  });
});

describe('niveles «estable» y «dominada»', () => {
  const learnedAt = T0 + 3 * DAY;

  it('lo aprendido no se vuelve a pedir antes de 7 días', () => {
    expect(learned().dueAt).toBeGreaterThanOrEqual(learnedAt + config.levels.stable.minElapsedMs);
  });

  it('«estable» exige un acierto sin pista tras ≥ 7 días sin exposición', () => {
    expect(run(learned(), [attempt({ at: learnedAt + 6 * DAY })]).status).toBe('learned');
    expect(run(learned(), [attempt({ at: learnedAt + 7 * DAY, format: 'recall_cued', hint: 1 })]).status).toBe('learned');
    expect(run(learned(), [attempt({ at: learnedAt + 7 * DAY, format: 'recognition_choice' })]).status).toBe('learned');
    expect(run(learned(), [attempt({ at: learnedAt + 7 * DAY })]).status).toBe('stable');
  });

  it('practicar antes del plazo lo reinicia: la exposición cuenta', () => {
    const s = run(learned(), [attempt({ at: learnedAt + 4 * DAY }), attempt({ at: learnedAt + 8 * DAY })]);
    expect(s.status).toBe('learned');
  });

  it('«dominada» exige un acierto sin pista tras ≥ 30 días sin exposición', () => {
    const stable = run(learned(), [attempt({ at: learnedAt + 7 * DAY })]);
    expect(stable.dueAt).toBeGreaterThanOrEqual(learnedAt + 7 * DAY + config.levels.mastered.minElapsedMs);
    expect(run(stable, [attempt({ at: learnedAt + 7 * DAY + 29 * DAY })]).status).toBe('stable');
    expect(run(stable, [attempt({ at: learnedAt + 7 * DAY + 30 * DAY })]).status).toBe('mastered');
  });

  it('un acierto tras ≥ 30 días desde «aprendida» demuestra directamente el dominio', () => {
    expect(run(learned(), [attempt({ at: learnedAt + 30 * DAY })]).status).toBe('mastered');
  });

  it('un fallo de recuperación debilita también lo estable y lo dominado', () => {
    const mastered = run(learned(), [attempt({ at: learnedAt + 30 * DAY })]);
    expect(run(mastered, [attempt({ at: learnedAt + 70 * DAY, correct: false })]).status).toBe('weakened');
  });
});

describe('escuchar', () => {
  const listen = (format: Attempt['format']) =>
    run(start(), [
      attempt({ at: T0 + 60_000, format }),
      attempt({ at: T0 + 120_000, format }),
      attempt({ at: T0 + DAY, format }),
      attempt({ at: T0 + 3 * DAY, format }),
    ]).status;

  it('el dictado y la explicación libre de lo oído pueden llevar a «aprendida»', () => {
    expect(listen('listening_transcribe')).toBe('learned');
    expect(listen('listening_explain')).toBe('learned');
  });

  it('reconocer al escuchar sigue sin consolidar', () => {
    expect(listen('recognition_listening')).toBe('learning');
  });
});

describe('programador adaptativo', () => {
  it('sube de escalón con recuperación y baja con un fallo', () => {
    const learning = run(start(), [attempt({ at: T0 + 60_000 })]);
    expect(learning.step).toBe(1);
    const failed = run(learning, [attempt({ at: T0 + DAY, correct: false })]);
    expect(failed.step).toBe(0);
    expect(failed.dueAt).toBe(T0 + DAY + config.scheduler.retryDelayMs);
  });

  it('un acierto débil espacia el repaso, pero nunca más allá del tope de aciertos débiles', () => {
    const recognitions = Array.from({ length: 8 }, (_, i) => attempt({ at: T0 + (i + 1) * 4 * DAY, format: 'recognition_choice' }));
    const s = run(start(), recognitions);
    expect(s.step).toBe(config.scheduler.weakSuccessMaxStep);
    const strong = run(s, [attempt({ at: T0 + 40 * DAY })]);
    expect(strong.step).toBe(config.scheduler.weakSuccessMaxStep + 1);
  });

  it('a más precisión, intervalos más largos', () => {
    const good = run(start(), Array.from({ length: 4 }, (_, i) => attempt({ at: T0 + (i + 1) * DAY })));
    const shaky = run(start(), [
      attempt({ at: T0 + DAY, correct: false }),
      attempt({ at: T0 + 2 * DAY, correct: false }),
      attempt({ at: T0 + 3 * DAY }),
      attempt({ at: T0 + 4 * DAY }),
    ]);
    const gap = (s: SkillState) => (s.dueAt ?? 0) - (s.lastAttemptAt ?? 0);
    expect(gap(good)).toBeGreaterThan(gap(shaky));
  });
});

describe('variedad de formatos y contextos', () => {
  it('guarda los formatos y contextos de los éxitos diferidos, no de los aciertos inmediatos', () => {
    const s = run(start(), [
      attempt({ at: T0 + 60_000, format: 'production', contextId: 'inmediato' }),
      attempt({ at: T0 + DAY, contextId: 'escena-1' }),
      attempt({ at: T0 + 3 * DAY, format: 'production', contextId: 'escena-2' }),
      attempt({ at: T0 + 5 * DAY, format: 'recall_cued', hint: 1, contextId: 'escena-3' }),
    ]);
    expect(s.unaidedFormats).toEqual(['recall_unaided', 'production']);
    expect(s.contexts).toEqual(['escena-1', 'escena-2']);
  });
});

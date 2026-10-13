import { describe, expect, it } from 'vitest';
import { DAY, HOUR, adaptiveScheduler, applySkillAttempt, exposeSkill, newSkillState, type Attempt, type SkillState } from '../src';
import { T0, attempt, config } from './helpers';

const start = (): SkillState => exposeSkill(newSkillState('s1', 'k1', config), T0, adaptiveScheduler, config);
const run = (state: SkillState, attempts: Attempt[]): SkillState => attempts.reduce((s, a) => applySkillAttempt(s, a, adaptiveScheduler, config).state, state);

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

  it('nada pasa a «consolidado» sin éxito diferido, aunque se acierte mucho el mismo día', () => {
    const attempts = Array.from({ length: 20 }, (_, i) => attempt({ at: T0 + (i + 1) * 60_000, format: 'production' }));
    const s = run(start(), attempts);
    expect(s.status).toBe('consolidating');
    expect(s.deferredSuccesses).toBe(0);
  });

  it('con pista tampoco hay éxito diferido', () => {
    const attempts = Array.from({ length: 10 }, (_, i) => attempt({ at: T0 + (i + 1) * DAY, format: 'recall_cued', hint: 1 }));
    expect(run(start(), attempts).status).not.toBe('consolidated');
  });

  it('se consolida con dos éxitos diferidos en recuperación sin pista', () => {
    const s = run(start(), [
      attempt({ at: T0 + 60_000, format: 'production' }),
      attempt({ at: T0 + 120_000, format: 'production' }),
      attempt({ at: T0 + DAY }),
      attempt({ at: T0 + 3 * DAY }),
    ]);
    expect(s.status).toBe('consolidated');
    expect(s.deferredSuccesses).toBeGreaterThanOrEqual(2);
  });

  it('un fallo de recuperación debilita lo consolidado; un éxito diferido lo devuelve a consolidación', () => {
    const consolidated = run(start(), [
      attempt({ at: T0 + 60_000, format: 'production' }),
      attempt({ at: T0 + 120_000, format: 'production' }),
      attempt({ at: T0 + DAY }),
      attempt({ at: T0 + 3 * DAY }),
    ]);
    const weakened = run(consolidated, [attempt({ at: T0 + 10 * DAY, correct: false })]);
    expect(weakened.status).toBe('weakened');
    expect(weakened.lapses).toBe(1);
    const recovered = run(weakened, [attempt({ at: T0 + 11 * DAY })]);
    expect(recovered.status).toBe('consolidating');
  });

  it('fallar el reconocimiento no debilita lo consolidado', () => {
    const consolidated = run(start(), [
      attempt({ at: T0 + 60_000, format: 'production' }),
      attempt({ at: T0 + 120_000, format: 'production' }),
      attempt({ at: T0 + DAY }),
      attempt({ at: T0 + 3 * DAY }),
    ]);
    expect(run(consolidated, [attempt({ at: T0 + 10 * DAY, format: 'recognition_choice', correct: false })]).status).toBe('consolidated');
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

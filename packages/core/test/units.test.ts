import { describe, expect, it } from 'vitest';
import { newSkillState, unitLevel, type Catalog, type ExerciseFormat, type SkillState, type SkillStatus } from '../src';
import { config } from './helpers';

const catalog: Catalog = {
  units: [{ id: 'w', courseId: 'c', type: 'term' }, { id: 'k', courseId: 'c', type: 'concept' }],
  skills: [
    { id: 'w.listen', unitId: 'w', kind: 'listen' },
    { id: 'w.recall', unitId: 'w', kind: 'recall' },
    { id: 'w.produce', unitId: 'w', kind: 'produce' },
    { id: 'k.see', unitId: 'k', kind: 'recognize' },
    { id: 'k.recall', unitId: 'k', kind: 'recall' },
  ],
  prerequisites: [],
};

function state(id: string, status: SkillStatus, formats: ExerciseFormat[] = [], contexts: string[] = []): SkillState {
  return { ...newSkillState(id, id.split('.')[0]!, config), status, unaidedFormats: formats, contexts };
}
const skills = (list: SkillState[]) => Object.fromEntries(list.map((s) => [s.skillId, s]));

describe('nivel por unidad', () => {
  it('sin habilidades aprendidas no tiene nivel', () => {
    expect(unitLevel('w', catalog, skills([state('w.listen', 'learned'), state('w.recall', 'consolidating'), state('w.produce', 'learned')]), config).level).toBe('none');
  });

  it('aprendida y estable exigen todas sus habilidades en ese nivel o más', () => {
    const learned = skills([state('w.listen', 'learned'), state('w.recall', 'stable'), state('w.produce', 'mastered')]);
    expect(unitLevel('w', catalog, learned, config).level).toBe('learned');
    const stable = skills([state('w.listen', 'stable'), state('w.recall', 'stable'), state('w.produce', 'mastered')]);
    expect(unitLevel('w', catalog, stable, config).level).toBe('stable');
  });

  it('una habilidad debilitada baja el nivel de la unidad', () => {
    const s = skills([state('w.listen', 'weakened'), state('w.recall', 'stable'), state('w.produce', 'stable')]);
    expect(unitLevel('w', catalog, s, config).level).toBe('none');
  });

  it('dominada exige además variedad de formatos y de contextos', () => {
    const narrow = skills([
      state('w.listen', 'mastered', ['listening_transcribe'], ['c1']),
      state('w.recall', 'mastered', ['recall_unaided'], ['c1']),
      state('w.produce', 'mastered', [], ['c1']),
    ]);
    const report = unitLevel('w', catalog, narrow, config);
    expect(report.level).toBe('stable');
    expect(report.missing).toEqual(['formats:2/3', 'contexts:1/2']);
    const varied = skills([
      state('w.listen', 'mastered', ['listening_transcribe', 'listening_explain'], ['c1']),
      state('w.recall', 'mastered', ['recall_unaided'], ['c2']),
      state('w.produce', 'mastered', ['production'], ['c1']),
    ]);
    expect(unitLevel('w', catalog, varied, config).level).toBe('mastered');
  });

  it('el reconocimiento puro no cuenta, y una unidad con pocos formatos exige los que admite', () => {
    const s = skills([state('k.see', 'learning'), state('k.recall', 'mastered', ['recall_unaided'], ['c1', 'c2'])]);
    const report = unitLevel('k', catalog, s, config);
    expect(report.ignored).toEqual(['k.see']);
    expect(report.requiredFormats).toBe(1);
    expect(report.level).toBe('mastered');
  });

  it('indica qué falta para el siguiente nivel', () => {
    const s = skills([state('w.listen', 'learned'), state('w.recall', 'learned'), state('w.produce', 'stable')]);
    expect(unitLevel('w', catalog, s, config).missing).toEqual(['skills_below_stable:w.listen,w.recall']);
  });
});

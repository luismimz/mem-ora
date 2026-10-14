import { describe, expect, it } from 'vitest';
import { describeContentIssue, unitPayload, validateCourseFile } from '../src';

const file = {
  schemaVersion: 1,
  course: { key: 'frances-basico', title: 'Francés · La cocina', contentLanguage: 'fr', newPerSession: 15, audio: true, modes: ['associations', 'arcade'] },
  modules: [{ key: 'cocina', title: 'La cocina', units: [
    { key: 'pain', type: 'term', text: 'pain', meaning: 'pan', pronunciation: 'PAN', examples: [{ text: 'Je mange du pain.', translation: 'Como pan.' }],
      association: { technique: 'absurd_scene', cue: 'PAN', scene: 'Un PAN gigante pide más PAN.', sceneTarget: 'Un PAIN géant.', emoji: '🥖' } },
  ] }],
};

describe('archivo de curso', () => {
  it('acepta un curso correcto y construye el contenido de la unidad', () => {
    expect(validateCourseFile(file)).toEqual([]);
    expect(unitPayload(file.modules[0]!.units[0] as never)).toEqual({ form: 'word', text: 'pain', meaning: 'pan', pronunciation: { respelling: 'PAN' }, examples: [{ text: 'Je mange du pain.', translation: 'Como pan.' }] });
  });

  it('señala los problemas con su ruta y un mensaje para el autor', () => {
    const bad = JSON.parse(JSON.stringify(file));
    bad.schemaVersion = 2;
    bad.course.modes = ['karaoke'];
    bad.modules[0].units[0].meaning = '';
    bad.modules[0].units.push({ ...bad.modules[0].units[0], meaning: 'pan' });
    const issues = validateCourseFile(bad);
    const paths = issues.map((i) => `${i.code}@${i.path}`);
    expect(paths).toEqual(expect.arrayContaining(['file_version@schemaVersion', 'invalid_choice@course.modes', 'required@modules.0.units.0.meaning', 'key_taken@modules.0.units.1.key']));
    expect(issues.map((i) => describeContentIssue(i))).toContain('Módulo 1 › Unidad 1 › significado: es obligatorio.');
  });

  it('un archivo vacío o sin módulos se explica', () => {
    expect(validateCourseFile('x').map((i) => i.code)).toEqual(['not_object']);
    expect(validateCourseFile({ schemaVersion: 1, course: file.course }).map((i) => i.code)).toContain('required');
  });
});

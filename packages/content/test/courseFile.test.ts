import { describe, expect, it } from 'vitest';
import { describeContentIssue, skillsFor, unitPayload, validateCourseFile, validateUnitPayload } from '../src';

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

describe('conceptos (materias que no son idiomas)', () => {
  const concept = { key: 'class', type: 'concept', name: 'class', gist: 'molde de objetos', definition: 'Plantilla que define datos y comportamiento; de ella se crean objetos.', answers: ['clase'],
    examples: [{ text: 'public class Perro { }', explanation: 'Declara el molde Perro.' }], contrast: '≠ objeto: el objeto sale del molde.' };
  const javaFile = { schemaVersion: 1, course: { key: 'java', title: 'Java', contentLanguage: 'en', audio: false, modes: ['associations', 'arcade'] }, modules: [{ key: 'm1', title: 'Clases', units: [concept] }] };

  it('un concepto no necesita traducción en los ejemplos', () => {
    expect(validateCourseFile(javaFile)).toEqual([]);
    expect(unitPayload(concept as never)).toMatchObject({ name: 'class', gist: 'molde de objetos', answers: ['clase'] });
  });

  it('sin idea clave ni definición se explica', () => {
    const bad = JSON.parse(JSON.stringify(javaFile));
    delete bad.modules[0].units[0].gist;
    bad.modules[0].units[0].definition = '';
    const msgs = validateCourseFile(bad).map((i) => describeContentIssue(i));
    expect(msgs).toEqual(expect.arrayContaining(['Módulo 1 › Unidad 1 › idea clave: es obligatorio.', 'Módulo 1 › Unidad 1 › definición: es obligatorio.']));
  });
});

describe('ejercicios de concepto', () => {
  const base = { name: 'static', gist: 'compartido', definition: 'Pertenece a la clase.', examples: [{ text: 'static int count;' }] };
  const predict = { kind: 'predict_output', prompt: '¿Qué imprime?', code: 'Dog.count = 2;\nSystem.out.println(new Dog().count);', answer: '2', distractors: ['0', 'error'] };
  const order = { kind: 'order_steps', prompt: 'Ordena', steps: ['Declarar la clase', 'Escribir el constructor', 'Crear el objeto con new'] };

  it('acepta ejercicios bien formados y añade la habilidad «aplicar» solo si los hay', () => {
    expect(validateUnitPayload('concept', { ...base, exercises: [predict, order] })).toEqual([]);
    expect(skillsFor('concept', base).map((s) => s.kind)).toEqual(['recall']);
    expect(skillsFor('concept', { ...base, exercises: [predict] }).map((s) => s.kind)).toEqual(['recall', 'apply']);
    expect(skillsFor('term', { exercises: [predict] }).map((s) => s.kind)).toEqual(['listen', 'recall', 'produce']);
  });

  it('explica cada problema del ejercicio', () => {
    const issues = validateUnitPayload('concept', { ...base, exercises: [
      { kind: 'fill_gap', prompt: 'Completa', code: 'int count;', answer: 'static', distractors: ['final', 'static'] },
      { ...order, steps: ['solo uno'] },
      { kind: 'karaoke', prompt: 'x', answer: 'y', distractors: ['a', 'b'] },
    ] });
    const msgs = issues.map((i) => describeContentIssue(i));
    expect(issues.map((i) => `${i.code}@${i.path}`)).toEqual(expect.arrayContaining(['gap_missing@exercises.0.code', 'distractor_is_answer@exercises.0.distractors', 'min_items@exercises.1.steps', 'invalid_choice@exercises.2.kind']));
    expect(msgs.join(' ')).toContain('marca el hueco con ___');
  });
});

describe('retos de memoria', () => {
  const reto = { title: 'Prueba', words: ['Pingüino', 'Sartén', 'Cactus', 'Semáforo', 'Dinosaurio', 'Espaguetis', 'Submarino', 'Paraguas'], decoys: ['Pato', 'Olla', 'Rosa'],
    scenes: [{ text: 'Un pingüino patina sobre una sartén y cae en un cactus.' }, { text: 'Salta contra un semáforo, que cae sobre un dinosaurio que vomita espaguetis; por ellos navega un submarino que abre un paraguas.' }] };
  it('acepta un reto con las palabras en la historia y en orden (sin importar tildes ni mayúsculas)', () => {
    expect(validateUnitPayload('memory_challenge', reto)).toEqual([]);
    expect(skillsFor('memory_challenge', reto).map((s) => s.kind)).toEqual(['recall']);
  });
  it('detecta palabras ausentes, desordenadas, repetidas y falsas que están en la lista', () => {
    const bad = { ...reto, words: [...reto.words.slice(0, 7), 'Cactus', 'Helado'], decoys: ['Pato', 'Sartén', 'Rosa'], scenes: [{ text: reto.scenes[1]!.text + ' ' + reto.scenes[0]!.text }] };
    const codes = validateUnitPayload('memory_challenge', bad).map((i) => `${i.code}@${i.path}`);
    expect(codes).toEqual(expect.arrayContaining(['word_out_of_order@words.3', 'duplicate_word@words.7', 'word_not_in_story@words.8', 'decoy_in_list@decoys.1']));
  });
});

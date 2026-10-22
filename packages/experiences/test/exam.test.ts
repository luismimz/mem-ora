import { describe, expect, it } from 'vitest';
import { buildExam, examCorrect, examExercises, examGrade, EXAM_SIZE, type SessionUnit } from '../src';

const concept = (key: string, exercises: unknown[] = [{ kind: 'apply_case', prompt: `¿${key}?`, answer: `si-${key}`, distractors: ['no', 'quizá', 'nunca', 'otra'] }]): SessionUnit => ({
  key, type: 'concept', language: 'es',
  payload: { name: key, gist: 'g', definition: 'd', examples: [], exercises },
  skills: [{ key: `${key}.recall`, kind: 'recall' }, { key: `${key}.apply`, kind: 'apply' }],
} as unknown as SessionUnit);
const missions = [0, 1, 2].map((m) => ({ key: `m${m}`, units: Array.from({ length: 15 }, (_, i) => `m${m}u${i}`) }));
const units = Object.fromEntries(missions.flatMap((m) => m.units).map((k) => [k, concept(k)]));

describe('simulacro de examen', () => {
  const exam = buildExam({ examId: 'e1', units, missions });
  it('30 preguntas, una por unidad, repartidas entre todas las misiones', () => {
    expect(exam).toHaveLength(EXAM_SIZE);
    expect(new Set(exam.map((q) => q.unitKey)).size).toBe(EXAM_SIZE);
    for (const m of missions) expect(exam.filter((q) => m.units.includes(q.unitKey))).toHaveLength(10);
  });
  it('cada pregunta trae su respuesta y como mucho 3 opciones falsas, y cuenta para la habilidad «aplicar»', () => {
    for (const q of exam) {
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(`si-${q.unitKey}`);
      expect(q.skillKey).toBe(`${q.unitKey}.apply`);
    }
  });
  it('el mismo examen se repite con el mismo id (se puede retomar) y cambia con otro', () => {
    expect(buildExam({ examId: 'e1', units, missions })).toEqual(exam);
    expect(buildExam({ examId: 'e2', units, missions }).map((q) => q.unitKey)).not.toEqual(exam.map((q) => q.unitKey));
  });
  it('solo usa ejercicios con opciones (no «ordenar pasos» ni sin opciones falsas)', () => {
    const odd = { a: concept('a', [{ kind: 'order_steps', prompt: 'p', steps: ['1', '2'] }]), b: concept('b', [{ kind: 'apply_case', prompt: 'p', answer: 'x' }]), c: concept('c') };
    expect(examExercises(odd.a)).toEqual([]);
    expect(examExercises(odd.b)).toEqual([]);
    expect(buildExam({ examId: 'x', units: odd, missions: [{ key: 'm', units: ['a', 'b', 'c'] }] }).map((q) => q.unitKey)).toEqual(['c']);
  });
  it('corrige y pone nota sobre 10 con un decimal', () => {
    const q = exam[0]!;
    expect(examCorrect(q, units, `si-${q.unitKey}`)).toBe(true);
    expect(examCorrect(q, units, 'no')).toBe(false);
    expect(examCorrect(q, units, null)).toBe(false);
    expect(examGrade(21, 30)).toBe(7);
    expect(examGrade(20, 30)).toBe(6.7);
    expect(examGrade(0, 0)).toBe(0);
  });
});

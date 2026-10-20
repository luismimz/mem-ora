import { describe, expect, it } from 'vitest';
import type { PlanItem } from '@memora/core';
import { buildFlowSession, FLOW_RETRY_GAP, type SessionUnit } from '../src';

const concept = (key: string): SessionUnit => ({
  key, type: 'concept', language: 'es',
  payload: { name: key, gist: `idea ${key}`, definition: 'd', examples: [], exercises: [{ kind: 'apply_case', prompt: 'p', answer: 'a', distractors: ['b'] }] },
  skills: [{ key: `${key}.recall`, kind: 'recall', associationId: `a-${key}` }, { key: `${key}.apply`, kind: 'apply' }],
  association: { id: `a-${key}`, technique: 'analogy', cue: 'CLAVE', text: `Una IDEA ${key}.` },
} as unknown as SessionUnit);
const keys = Array.from({ length: 12 }, (_, i) => `c${i}`);
const units = Object.fromEntries(keys.map((k) => [k, concept(k)]));
const item = (u: string, reason: 'new' | 'review'): PlanItem => ({ skillId: `${u}.recall`, unitId: u, reason, priority: 0, recommendedHint: 0 });
const base = { sessionId: 's', courseId: 'c', day: 1, createdAt: 0, units };

describe('modo Flujo (D-068)', () => {
  const plan = buildFlowSession({ ...base, items: [...keys.slice(0, 4).map((k) => item(k, 'review')), ...keys.slice(4, 12).map((k) => item(k, 'new'))], maxNewUnits: 8 });
  const main = plan.steps.filter((s) => !s.retry);

  it('todo entra en parejas: dos asociaciones y sus dos preguntas relámpago', () => {
    for (let i = 0; i < 8; i += 4) {
      const four = main.filter((s) => s.kind !== 'challenge').slice(i, i + 4);
      expect(four.map((s) => s.kind)).toEqual(['reel', 'reel', 'quick', 'judge']);
      expect([four[2]!.unitKey, four[3]!.unitKey]).toEqual([four[0]!.unitKey, four[1]!.unitKey]);
    }
  });

  it('REGLA DE ORO: ninguna pregunta (relámpago o examen) sin su asociación antes, también en los repasos (D-067)', () => {
    expect(plan.steps[0]!.kind).toBe('reel');
    plan.steps.forEach((s, i) => {
      if (!s.unitKey || s.kind === 'reel') return;
      expect(plan.steps.slice(0, i).some((x) => x.kind === 'reel' && x.unitKey === s.unitKey)).toBe(true);
    });
    expect(plan.steps.filter((s) => s.kind === 'reel').map((s) => s.unitKey).sort()).toEqual(keys.slice(0, 12).sort());
  });

  it('cada pregunta tiene su repesca (relámpago) al menos 3 tarjetas después', () => {
    for (const [i, s] of plan.steps.entries()) {
      if ((s.kind !== 'quick' && s.kind !== 'judge') || s.retry) continue;
      const j = plan.steps.findIndex((x, k) => k > i && x.retry && x.unitKey === s.unitKey);
      expect(j - i).toBeGreaterThanOrEqual(FLOW_RETRY_GAP);
      expect(plan.steps[j]!.kind).toBe('quick');
    }
  });

  it('¿verdad o mentira?: el significado mostrado es el suyo (verdad) o el de otra unidad de la sesión (mentira)', () => {
    const judges = plan.steps.filter((s) => s.kind === 'judge');
    expect(judges.length).toBeGreaterThan(3);
    for (const j of judges) expect(keys).toContain(j.statementOf);
    expect(judges.some((j) => j.statementOf === j.unitKey)).toBe(true);
    expect(judges.some((j) => j.statementOf !== j.unitKey)).toBe(true);
  });

  it('cada 8 tarjetas, una pregunta tipo examen de algo ya visto; termina en resumen y nunca se escribe en conceptos', () => {
    const bosses = plan.steps.filter((s) => s.kind === 'challenge');
    expect(bosses.length).toBeGreaterThanOrEqual(2);
    for (const b of bosses) expect(plan.steps.slice(0, plan.steps.indexOf(b)).some((x) => x.unitKey === b.unitKey)).toBe(true);
    expect(plan.steps.at(-1)!.kind).toBe('summary');
    expect(plan.steps.some((s) => s.kind === 'review')).toBe(false);
    expect(plan.mode).toBe('flow');
  });
});

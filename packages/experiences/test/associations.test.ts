import { describe, expect, it } from 'vitest';
import type { PlanItem } from '@memora/core';
import { buildAssociationSession, choicesFor, gradeReview, reviewHints, storyGap, type SessionUnit } from '../src';

const unit = (key: string, text: string, meaning: string, scene: string, cue = ''): SessionUnit => ({
  key, type: 'term', language: 'en', version: 1,
  payload: { form: 'word', text, meaning, pronunciation: { respelling: text.toUpperCase() }, examples: [{ text: `I ${text} it.`, translation: `Lo ${meaning}.` }] },
  skills: [{ key: `${key}.listen`, kind: 'listen' }, { key: `${key}.recall`, kind: 'recall', associationId: `a-${key}` }, { key: `${key}.produce`, kind: 'produce' }],
  association: { id: `a-${key}`, technique: 'phonetic_bridge', cue, text: scene },
});
const words = Array.from({ length: 15 }, (_, i) => unit(`w${i}`, `word${i}`, `significado${i}`, `Una ESCENA lleva a SIGNIFICADO${i}.`));
const units = Object.fromEntries(words.map((w) => [w.key, w]));
const newItems: PlanItem[] = words.flatMap((w) => w.skills.map((s) => ({ skillId: s.key, unitId: w.key, reason: 'new' as const, priority: 0, recommendedHint: 0 as const })));
const base = { sessionId: 's1', courseId: 'c', day: 1, createdAt: 0, units };

describe('sesión de asociaciones', () => {
  it('15 unidades nuevas forman 3 escenas de 5: tarjetas, recordar, historia y resultado; cierre con rescate', () => {
    const plan = buildAssociationSession({ ...base, items: newItems, knownUnits: [] });
    expect(plan.scenes.map((s) => s.length)).toEqual([5, 5, 5]);
    const kinds = plan.steps.map((s) => s.kind);
    expect(kinds.slice(0, 16)).toEqual([...Array(5).fill('card'), ...Array(5).fill('recall'), ...Array(5).fill('story'), 'sceneResult']);
    expect(kinds.filter((k) => k === 'rescue')).toHaveLength(15);
    expect(kinds.at(-1)).toBe('summary');
    expect(kinds).not.toContain('arcade');
  });

  it('nunca recuerda una unidad antes de su tarjeta (principio 1)', () => {
    const plan = buildAssociationSession({ ...base, items: newItems, knownUnits: [] });
    for (const [i, step] of plan.steps.entries()) {
      if (step.kind === 'recall' || step.kind === 'story' || step.kind === 'rescue') {
        expect(plan.steps.slice(0, i).some((s) => s.kind === 'card' && s.unitKey === step.unitKey)).toBe(true);
      }
    }
  });

  it('con 20 o más unidades trabajadas puede saltar un Arcade sorpresa, solo con lo ya enseñado', () => {
    const known = Array.from({ length: 20 }, (_, i) => `old${i}`);
    let seen = false;
    for (let s = 0; s < 20 && !seen; s += 1) {
      const plan = buildAssociationSession({ ...base, sessionId: `s${s}`, items: newItems, knownUnits: known });
      const arcade = plan.steps.find((x) => x.kind === 'arcade');
      if (arcade) {
        seen = true;
        const idx = plan.steps.indexOf(arcade);
        for (const k of arcade.arcadeUnits!) expect(plan.steps.slice(0, idx).some((x) => x.kind === 'card' && x.unitKey === k)).toBe(true);
      }
    }
    expect(seen).toBe(true);
  });

  it('los repasos vencidos van primero y empiezan con la pista de la escalera', () => {
    const items: PlanItem[] = [{ skillId: 'w3.recall', unitId: 'w3', reason: 'review', priority: 1, recommendedHint: 2 }, { skillId: 'w3.listen', unitId: 'w3', reason: 'review', priority: 1, recommendedHint: 0 }];
    const plan = buildAssociationSession({ ...base, items, knownUnits: [] });
    expect(plan.steps.map((s) => s.kind)).toEqual(['review', 'summary']);
    expect(plan.steps[0]).toMatchObject({ skillKey: 'w3.recall', startHint: 2 });
  });
});

describe('ejercicios', () => {
  it('las opciones incluyen la correcta y solo distractores enseñados', () => {
    const c = choicesFor('PLAY', ['PLAY', 'DESK', 'COMPUTER', 'KEY'], 'x');
    expect(c).toHaveLength(3);
    expect(c.filter((o) => o.correct).map((o) => o.label)).toEqual(['PLAY']);
    expect(c.every((o) => ['PLAY', 'DESK', 'COMPUTER', 'KEY'].includes(o.label))).toBe(true);
  });

  it('completar la historia oculta el SIGNIFICADO, no el puente', () => {
    const play = unit('play', 'play', 'jugar', 'Una PLAYA invade el salón cuando empiezas a JUGAR.', 'PLAYA');
    expect(storyGap(play)).toEqual({ text: 'Una PLAYA invade el salón cuando empiezas a ______.', answer: 'JUGAR' });
  });

  it('el repaso tecleado sigue la escalera y revelar no cuenta', () => {
    const play = unit('play', 'play', 'jugar', 'Una PLAYA invade el salón cuando empiezas a JUGAR.', 'PLAYA');
    expect(reviewHints(play)).toEqual(['p _ _ _', 'Suena ≈ PLAY', 'Suena a PLAYA', 'Una PLAYA invade el salón cuando empiezas a JUGAR.']);
    expect(gradeReview(play, 'Play', 0, 0, false)).toEqual({ correct: true, format: 'recall_unaided', hint: 0 });
    expect(gradeReview(play, 'play', 0, 3, false)).toEqual({ correct: true, format: 'recall_cued', hint: 3 });
    expect(gradeReview(play, 'play', 0, 0, true)).toMatchObject({ correct: false, hint: 5 });
  });
});

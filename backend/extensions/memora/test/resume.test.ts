import { describe, expect, it } from 'vitest';
import { atReviewStep } from '../src/api/endpoint';

describe('no retomar un Repaso rápido (usuario, 6-nov-2026: «siempre las mismas palabras»)', () => {
  const plan = { steps: [{ kind: 'arcade', arcadeReview: true }, { kind: 'reel' }] };
  it('parada en el repaso: se rehace', () => expect(atReviewStep({ index: 0, plan })).toBe(true));
  it('pasado el repaso: se retoma', () => expect(atReviewStep({ index: 1, plan })).toBe(false));
  it('sin ronda guardada', () => expect(atReviewStep(null)).toBe(false));
});

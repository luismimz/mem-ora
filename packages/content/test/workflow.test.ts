import { describe, expect, it } from 'vitest';
import { CONTENT_ROLES, CONTENT_STATUSES, TRANSITIONS, allowedTargets, checkTransition, describeContentIssue, issue, type TransitionContext } from '../src';

const base: TransitionContext = {
  from: 'draft', to: 'needs_review', role: 'author', actorId: 'ana', authorId: 'ana', risk: 'low',
  contentIssues: [], hasSource: true, hasLicense: true, reviewed: false,
};
const codes = (patch: Partial<TransitionContext>) => checkTransition({ ...base, ...patch }).map((i) => i.code);

describe('flujo de estados', () => {
  it('el recorrido normal funciona con los roles adecuados', () => {
    expect(codes({ from: 'draft', to: 'needs_review', role: 'author' })).toEqual([]);
    expect(codes({ from: 'needs_review', to: 'approved', role: 'reviewer', actorId: 'rosa' })).toEqual([]);
    expect(codes({ from: 'approved', to: 'published', role: 'reviewer', actorId: 'rosa', reviewed: true })).toEqual([]);
  });

  it('nadie salta pasos, ni siquiera administración', () => {
    expect(codes({ from: 'draft', to: 'published', role: 'admin' })).toEqual(['transition_not_allowed']);
    expect(codes({ from: 'draft', to: 'approved', role: 'admin' })).toEqual(['transition_not_allowed']);
  });

  it('autoría no aprueba ni publica', () => {
    expect(codes({ from: 'needs_review', to: 'approved', role: 'author' })).toEqual(['transition_forbidden_for_role']);
    expect(codes({ from: 'approved', to: 'published', role: 'author', reviewed: true })).toEqual(['transition_forbidden_for_role']);
  });

  it('no se envía a revisión ni se aprueba con problemas, sin fuente o sin licencia', () => {
    expect(codes({ contentIssues: [issue('required', 'meaning')] })).toEqual(['content_has_issues']);
    expect(codes({ from: 'needs_review', to: 'approved', role: 'reviewer', actorId: 'rosa', hasSource: false, hasLicense: false })).toEqual(['missing_source', 'missing_license']);
    expect(codes({ from: 'approved', to: 'published', role: 'admin', reviewed: false })).toEqual(['not_reviewed']);
  });

  it('el autor puede aprobar lo suyo de riesgo bajo, pero no de riesgo medio o alto (D-006)', () => {
    expect(codes({ from: 'needs_review', to: 'approved', role: 'admin', risk: 'low' })).toEqual([]);
    expect(codes({ from: 'needs_review', to: 'approved', role: 'admin', risk: 'medium' })).toEqual(['reviewer_must_differ']);
    expect(codes({ from: 'needs_review', to: 'approved', role: 'reviewer', actorId: 'rosa', risk: 'high' })).toEqual([]);
  });

  it('volver atrás no exige que el contenido sea válido', () => {
    expect(codes({ from: 'needs_review', to: 'draft', contentIssues: [issue('required', 'meaning')] })).toEqual([]);
  });

  it('todas las transiciones usan estados y roles conocidos, y cada estado tiene salida', () => {
    for (const t of TRANSITIONS) {
      expect(CONTENT_STATUSES).toContain(t.from);
      expect(CONTENT_STATUSES).toContain(t.to);
      for (const r of t.roles) expect(CONTENT_ROLES).toContain(r);
    }
    for (const s of CONTENT_STATUSES) expect(allowedTargets(s, 'admin').length, s).toBeGreaterThan(0);
  });

  it('los mensajes dicen qué se puede hacer en su lugar', () => {
    const [problem] = checkTransition({ ...base, to: 'published', role: 'admin' });
    expect(describeContentIssue(problem!)).toBe('No se puede pasar de «borrador» a «publicado». Desde «borrador» puedes pasar a: «en revisión».');
  });
});

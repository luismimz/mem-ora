// Flujo de estados del contenido (unidades y asociaciones): draft → needs_review → approved → published,
// con rejected y deprecated. Regla 12: nadie salta pasos; la IA, cuando exista, solo crea borradores.
import { issue, type ContentIssue } from './issues';

export const CONTENT_STATUSES = ['draft', 'needs_review', 'approved', 'published', 'rejected', 'deprecated'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_ROLES = ['admin', 'author', 'reviewer'] as const;
export type ContentRole = (typeof CONTENT_ROLES)[number];

export type RiskLevel = 'low' | 'medium' | 'high';

/** Transiciones permitidas y quién puede hacerlas. */
export const TRANSITIONS: ReadonlyArray<{ from: ContentStatus; to: ContentStatus; roles: ContentRole[] }> = [
  { from: 'draft', to: 'needs_review', roles: ['author', 'admin'] },
  { from: 'needs_review', to: 'draft', roles: ['author', 'reviewer', 'admin'] },
  { from: 'needs_review', to: 'approved', roles: ['reviewer', 'admin'] },
  { from: 'needs_review', to: 'rejected', roles: ['reviewer', 'admin'] },
  { from: 'rejected', to: 'draft', roles: ['author', 'admin'] },
  { from: 'approved', to: 'published', roles: ['reviewer', 'admin'] },
  { from: 'approved', to: 'draft', roles: ['reviewer', 'admin'] },
  { from: 'published', to: 'draft', roles: ['reviewer', 'admin'] },
  { from: 'published', to: 'deprecated', roles: ['reviewer', 'admin'] },
  { from: 'deprecated', to: 'draft', roles: ['admin'] },
];

/** Estados en los que el contenido está bloqueado: solo se cambia el estado, no el texto. */
export const LOCKED_STATUSES: readonly ContentStatus[] = ['needs_review', 'approved', 'published', 'deprecated'];

export interface TransitionContext {
  from: ContentStatus;
  to: ContentStatus;
  role: ContentRole;
  actorId: string;
  /** Quien creó el contenido. */
  authorId: string | null;
  risk: RiskLevel;
  /** Problemas del contenido (payload, técnica, catálogo); si hay, no se puede enviar a revisión ni aprobar. */
  contentIssues: ContentIssue[];
  /** Fuentes y licencia registradas (regla 13). */
  hasSource: boolean;
  hasLicense: boolean;
  /** Ya consta quién lo revisó (para publicar). */
  reviewed: boolean;
}

/** Problemas que impiden la transición; vacío si está permitida. */
export function checkTransition(ctx: TransitionContext): ContentIssue[] {
  if (ctx.from === ctx.to) return [];
  const rule = TRANSITIONS.find((t) => t.from === ctx.from && t.to === ctx.to);
  if (!rule) return [issue('transition_not_allowed', 'status', { from: ctx.from, to: ctx.to, allowed: allowedTargets(ctx.from, ctx.role).join(', ') })];
  if (!rule.roles.includes(ctx.role)) return [issue('transition_forbidden_for_role', 'status', { from: ctx.from, to: ctx.to, role: ctx.role, roles: rule.roles.join(', ') })];

  const problems: ContentIssue[] = [];
  const forward = ctx.to === 'needs_review' || ctx.to === 'approved' || ctx.to === 'published';
  if (forward && ctx.contentIssues.length) problems.push(issue('content_has_issues', 'status', { count: ctx.contentIssues.length }));
  if ((ctx.to === 'approved' || ctx.to === 'published') && !ctx.hasSource) problems.push(issue('missing_source', 'sources'));
  if ((ctx.to === 'approved' || ctx.to === 'published') && !ctx.hasLicense) problems.push(issue('missing_license', 'license'));
  // D-006: el autor puede revisar su propio contenido de riesgo bajo; el de riesgo medio o alto exige otra persona.
  if (ctx.to === 'approved' && ctx.risk !== 'low' && ctx.authorId && ctx.authorId === ctx.actorId) {
    problems.push(issue('reviewer_must_differ', 'status', { risk: ctx.risk }));
  }
  if (ctx.to === 'published' && !ctx.reviewed) problems.push(issue('not_reviewed', 'status'));
  return problems;
}

export function allowedTargets(from: ContentStatus, role: ContentRole): ContentStatus[] {
  return TRANSITIONS.filter((t) => t.from === from && t.roles.includes(role)).map((t) => t.to);
}

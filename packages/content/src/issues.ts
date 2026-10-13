// Problema de contenido: código estable + ruta del campo + datos. Los mensajes se redactan por idioma aparte.

export interface ContentIssue {
  code: string;
  /** Ruta del campo, por ejemplo `examples.2.text`. Vacía si afecta al conjunto. */
  path: string;
  params: Record<string, string | number>;
}

export const issue = (code: string, path: string, params: ContentIssue['params'] = {}): ContentIssue => ({ code, path, params });

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Texto obligatorio, recortado, con longitud mínima y máxima. */
export function checkText(issues: ContentIssue[], value: unknown, path: string, opts: { required?: boolean; min?: number; max?: number } = {}): void {
  const { required = true, min = 1, max = 500 } = opts;
  if (value === undefined || value === null || value === '') {
    if (required) issues.push(issue('required', path));
    return;
  }
  if (typeof value !== 'string') {
    issues.push(issue('not_text', path));
    return;
  }
  const text = value.trim();
  if (text !== value) issues.push(issue('surrounding_spaces', path));
  if (text.length < min) issues.push(issue('too_short', path, { min }));
  if (text.length > max) issues.push(issue('too_long', path, { max, length: text.length }));
}

export function checkChoice(issues: ContentIssue[], value: unknown, path: string, choices: readonly string[], required = true): void {
  if (value === undefined || value === null || value === '') {
    if (required) issues.push(issue('required', path));
    return;
  }
  if (typeof value !== 'string' || !choices.includes(value)) issues.push(issue('invalid_choice', path, { choices: choices.join(', ') }));
}

/** Campos que no están en el esquema (suelen ser erratas al escribir el JSON a mano). */
export function checkUnknownFields(issues: ContentIssue[], value: Record<string, unknown>, path: string, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(issue('unknown_field', path ? `${path}.${key}` : key, { allowed: allowed.join(', ') }));
}

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

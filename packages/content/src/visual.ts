// Dibujos y laboratorios de las fichas de conceptos (D-112). Bases de datos se entiende VIENDO: tablas con sus claves
// (🔑 primaria, 🔗 ajena) y diagramas E/R, no solo texto. Y se aprende HACIENDO: consultas SQL que se ejecutan de verdad
// en el móvil y tablas en las que se toca la columna pedida. Van en campos aparte (`visual` en un ejemplo y `labs` en la
// ficha) para no cambiar los ejercicios de siempre (test, simulacro, modelo guiado).
import { checkChoice, checkText, checkUnknownFields, isRecord, issue, type ContentIssue } from './issues';

export interface VisualColumn {
  name: string;
  /** Tipo de dato SQL (VARCHAR2(40), NUMBER(8,2), DATE…): se ve debajo del nombre. */
  type?: string;
  pk?: boolean;
  /** Clave ajena: «TABLA.columna» a la que apunta. */
  fk?: string;
}
export interface VisualTable {
  name: string;
  columns: VisualColumn[];
  /** Filas de ejemplo (texto); `null` en una celda se ve como NULL. */
  rows?: Array<Array<string | null>>;
  /** Columnas resaltadas (lo que se explica). */
  mark?: string[];
  /** Columnas tachadas en rojo (lo que está mal o se va de la tabla). */
  bad?: string[];
}
export interface VisualEntity { name: string; attrs: Array<{ name: string; pk?: boolean; multi?: boolean; derived?: boolean }>; weak?: boolean }
export interface VisualRelation { name: string; from: string; to: string; /** «1:1», «1:N», «N:M». */ card: string; /** Participación de cada lado: «(0,N)», «(1,1)». */ part?: [string, string]; attrs?: string[] }
export type Visual =
  | { kind: 'tables'; tables: VisualTable[]; caption?: string }
  | { kind: 'er'; entities: VisualEntity[]; relations: VisualRelation[]; caption?: string };

/** Laboratorio: SQL de verdad (se ejecuta en el dispositivo con SQLite) o tocar la columna pedida en unas tablas. */
export type Lab =
  | {
      kind: 'sql';
      prompt: string;
      /** SQL que crea y rellena las tablas antes de cada intento (no se enseña: se ven las tablas que crea). */
      setup: string;
      /** Una solución correcta: se compara el RESULTADO, no el texto (hay muchas formas buenas). */
      answer: string;
      /** Para CREATE/INSERT/UPDATE/DELETE: consulta que se ejecuta después para comparar el estado final. */
      check?: string;
      hint?: string;
      explanation?: string;
    }
  | { kind: 'tap'; prompt: string; visual: Extract<Visual, { kind: 'tables' }>; /** «TABLA.columna» correctas. */ target: string[]; explanation?: string };

export const VISUAL_LIMITS = { tables: 4, columns: 8, rows: 8, entities: 6, relations: 6, attrs: 8, labs: 6, setup: 4000, sql: 800 };


function checkList(issues: ContentIssue[], v: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(v)) { issues.push(issue(v === undefined ? 'required' : 'not_list', path)); return []; }
  if (v.length < min) issues.push(issue('min_items', path, { min, count: v.length }));
  if (v.length > max) issues.push(issue('max_items', path, { max, count: v.length }));
  return v;
}

/** Tablas: nombres únicos, columnas con nombre, filas del ancho justo y referencias («mark», «fk») que existen. */
function checkTables(issues: ContentIssue[], v: unknown, path: string): VisualTable[] {
  const tables = checkList(issues, v, path, 1, VISUAL_LIMITS.tables);
  const names = new Set<string>();
  tables.forEach((t, i) => {
    const p = `${path}.${i}`;
    if (!isRecord(t)) return void issues.push(issue('not_object', p));
    checkUnknownFields(issues, t, p, ['name', 'columns', 'rows', 'mark', 'bad']);
    checkText(issues, t.name, `${p}.name`, { max: 40 });
    names.add(String(t.name));
    const cols = checkList(issues, t.columns, `${p}.columns`, 1, VISUAL_LIMITS.columns);
    const colNames = new Set<string>();
    cols.forEach((c, j) => {
      const cp = `${p}.columns.${j}`;
      if (!isRecord(c)) return void issues.push(issue('not_object', cp));
      checkUnknownFields(issues, c, cp, ['name', 'type', 'pk', 'fk']);
      checkText(issues, c.name, `${cp}.name`, { max: 40 });
      checkText(issues, c.type, `${cp}.type`, { required: false, max: 30 });
      if (c.pk !== undefined && typeof c.pk !== 'boolean') issues.push(issue('not_boolean', `${cp}.pk`));
      if (c.fk !== undefined && (typeof c.fk !== 'string' || !/^[\w ]+\.[\w ]+$/.test(c.fk))) issues.push(issue('visual_bad_ref', `${cp}.fk`));
      colNames.add(String(c.name));
    });
    if (t.rows !== undefined) checkList(issues, t.rows, `${p}.rows`, 0, VISUAL_LIMITS.rows).forEach((r, k) => {
      if (!Array.isArray(r) || r.length !== cols.length || r.some((x) => x !== null && typeof x !== 'string')) issues.push(issue('visual_bad_row', `${p}.rows.${k}`, { cols: cols.length }));
    });
    for (const key of ['mark', 'bad'] as const) if (t[key] !== undefined) checkList(issues, t[key], `${p}.${key}`, 1, VISUAL_LIMITS.columns).forEach((m, k) => {
      if (typeof m !== 'string' || !colNames.has(m)) issues.push(issue('visual_bad_ref', `${p}.${key}.${k}`));
    });
  });
  return tables.filter(isRecord) as unknown as VisualTable[];
}

export function checkVisual(issues: ContentIssue[], v: unknown, path: string): void {
  if (!isRecord(v)) return void issues.push(issue('not_object', path));
  checkChoice(issues, v.kind, `${path}.kind`, ['tables', 'er']);
  checkText(issues, v.caption, `${path}.caption`, { required: false, max: 160 });
  if (v.kind === 'tables') {
    checkUnknownFields(issues, v, path, ['kind', 'tables', 'caption']);
    checkTables(issues, v.tables, `${path}.tables`);
    return;
  }
  if (v.kind !== 'er') return;
  checkUnknownFields(issues, v, path, ['kind', 'entities', 'relations', 'caption']);
  const names = new Set<string>();
  checkList(issues, v.entities, `${path}.entities`, 1, VISUAL_LIMITS.entities).forEach((e, i) => {
    const p = `${path}.entities.${i}`;
    if (!isRecord(e)) return void issues.push(issue('not_object', p));
    checkUnknownFields(issues, e, p, ['name', 'attrs', 'weak']);
    checkText(issues, e.name, `${p}.name`, { max: 30 });
    names.add(String(e.name));
    checkList(issues, e.attrs, `${p}.attrs`, 0, VISUAL_LIMITS.attrs).forEach((a, j) => {
      if (!isRecord(a)) return void issues.push(issue('not_object', `${p}.attrs.${j}`));
      checkUnknownFields(issues, a, `${p}.attrs.${j}`, ['name', 'pk', 'multi', 'derived']);
      checkText(issues, a.name, `${p}.attrs.${j}.name`, { max: 30 });
    });
  });
  if (v.relations !== undefined) checkList(issues, v.relations, `${path}.relations`, 0, VISUAL_LIMITS.relations).forEach((r, i) => {
    const p = `${path}.relations.${i}`;
    if (!isRecord(r)) return void issues.push(issue('not_object', p));
    checkUnknownFields(issues, r, p, ['name', 'from', 'to', 'card', 'part', 'attrs']);
    checkText(issues, r.name, `${p}.name`, { max: 30 });
    for (const end of ['from', 'to'] as const) if (!names.has(String(r[end]))) issues.push(issue('visual_bad_ref', `${p}.${end}`));
    checkChoice(issues, r.card, `${p}.card`, ['1:1', '1:N', 'N:1', 'N:M']);
    if (r.part !== undefined && (!Array.isArray(r.part) || r.part.length !== 2 || r.part.some((x) => typeof x !== 'string' || !/^\([01],[1N]\)$/.test(x)))) issues.push(issue('visual_bad_part', `${p}.part`));
  });
}

export function checkLabs(issues: ContentIssue[], v: unknown): void {
  checkList(issues, v, 'labs', 1, VISUAL_LIMITS.labs).forEach((l, i) => {
    const p = `labs.${i}`;
    if (!isRecord(l)) return void issues.push(issue('not_object', p));
    checkChoice(issues, l.kind, `${p}.kind`, ['sql', 'tap']);
    checkText(issues, l.prompt, `${p}.prompt`, { max: 200 });
    checkText(issues, l.explanation, `${p}.explanation`, { required: false, max: 300 });
    if (l.kind === 'sql') {
      checkUnknownFields(issues, l, p, ['kind', 'prompt', 'setup', 'answer', 'check', 'hint', 'explanation']);
      checkText(issues, l.setup, `${p}.setup`, { max: VISUAL_LIMITS.setup });
      checkText(issues, l.answer, `${p}.answer`, { max: VISUAL_LIMITS.sql });
      checkText(issues, l.check, `${p}.check`, { required: false, max: VISUAL_LIMITS.sql });
      checkText(issues, l.hint, `${p}.hint`, { required: false, max: 160 });
    } else if (l.kind === 'tap') {
      checkUnknownFields(issues, l, p, ['kind', 'prompt', 'visual', 'target', 'explanation']);
      checkVisual(issues, l.visual, `${p}.visual`);
      const tables = isRecord(l.visual) && Array.isArray(l.visual.tables) ? (l.visual.tables as Array<Record<string, unknown>>) : [];
      const all = new Set(tables.flatMap((t) => (Array.isArray(t.columns) ? (t.columns as Array<Record<string, unknown>>).map((c) => `${t.name}.${c.name}`) : [])));
      checkList(issues, l.target, `${p}.target`, 1, 4).forEach((t, k) => { if (typeof t !== 'string' || !all.has(t)) issues.push(issue('visual_bad_ref', `${p}.target.${k}`)); });
    }
  });
}

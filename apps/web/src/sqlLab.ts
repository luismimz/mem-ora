// Laboratorio de SQL (D-112): las consultas se ejecutan DE VERDAD en el dispositivo con SQLite (sql.js, WebAssembly):
// sin servidor, sin coste y también sin conexión. Se corrige por el RESULTADO, no por el texto: hay muchas consultas
// correctas para lo mismo. SQLite habla SQL estándar; donde Oracle (el de ILERNA) cambia, lo dice la ficha.
import type { Database, SqlJsStatic } from 'sql.js';

export interface ResultSet { columns: string[]; rows: string[][] }
export type RunResult = { ok: true; result: ResultSet | null; changes: number } | { ok: false; error: string };

let engine: Promise<SqlJsStatic> | null = null;
/** Para las pruebas (Node): usar otro cargador del motor. */
export function useEngine(e: Promise<SqlJsStatic>): void { engine = e; }
/** Carga SQLite una sola vez y solo cuando hace falta (≈ 650 kB). */
export function loadSql(): Promise<SqlJsStatic> {
  engine ??= Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')]).then(([m, w]) => m.default({ locateFile: () => w.default }));
  return engine;
}

const cell = (v: unknown): string => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(Number.isInteger(v) ? v : Math.round(v * 1e6) / 1e6) : v instanceof Uint8Array ? '[BLOB]' : String(v));

/** Ejecuta SQL (una o varias sentencias) sobre la base y devuelve el ÚLTIMO resultado con filas. */
export function run(db: Database, sql: string): RunResult {
  try {
    const out = db.exec(sql);
    const last = out[out.length - 1];
    return { ok: true, result: last ? { columns: last.columns, rows: last.values.map((r) => r.map(cell)) } : null, changes: db.getRowsModified() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Base nueva con las tablas del laboratorio. */
export async function freshDb(setup: string): Promise<Database> {
  const SQL = await loadSql();
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(setup);
  return db;
}

/** Las tablas de partida (para enseñarlas antes de escribir): nombre, columnas y filas (como mucho `limit`). */
export function tablesOf(db: Database, limit = 8): Array<{ name: string } & ResultSet> {
  const names = run(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid;");
  if (!names.ok || !names.result) return [];
  return names.result.rows.map(([name]) => {
    const r = run(db, `SELECT * FROM "${name}" LIMIT ${limit};`);
    const cols = run(db, `PRAGMA table_info("${name}");`);
    return { name: name!, columns: r.ok && r.result ? r.result.columns : cols.ok && cols.result ? cols.result.rows.map((x) => x[1]!) : [], rows: r.ok && r.result ? r.result.rows : [] };
  });
}

const key = (row: string[]) => JSON.stringify(row.map((v) => v.trim().toLowerCase()));

/** Mismo resultado: mismo número de columnas y mismas filas (en el mismo orden solo si la solución ordena). */
export function sameResult(got: ResultSet | null, want: ResultSet | null, ordered: boolean): boolean {
  if (!got || !want) return !got && !want;
  if (got.columns.length !== want.columns.length || got.rows.length !== want.rows.length) return false;
  const a = got.rows.map(key), b = want.rows.map(key);
  if (ordered) return a.every((x, i) => x === b[i]);
  const sa = [...a].sort(), sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}

export interface LabVerdict { correct: boolean; got: RunResult; want: ResultSet | null; error?: string }

/** Corrige un intento: ejecuta la del alumno y la solución, cada una en una base nueva, y compara resultados. */
export async function gradeSql(lab: { setup: string; answer: string; check?: string }, attempt: string): Promise<LabVerdict> {
  const mine = await freshDb(lab.setup);
  const ref = await freshDb(lab.setup);
  try {
    let got = run(mine, attempt);
    const wantRun = run(ref, lab.answer);
    let want = wantRun.ok ? wantRun.result : null;
    if (lab.check) {
      // Sentencias que cambian datos o estructura: se compara cómo queda la base después.
      if (got.ok) got = run(mine, lab.check);
      const w = run(ref, lab.check);
      want = w.ok ? w.result : null;
    }
    if (!got.ok) return { correct: false, got, want, error: got.error };
    return { correct: sameResult(got.result, want, /\border\s+by\b/i.test(lab.answer) && !lab.check), got, want };
  } finally {
    mine.close();
    ref.close();
  }
}

/** Palabras para escribir rápido en el móvil: las de SQL más usadas y los nombres de tablas y columnas del laboratorio. */
export const SQL_KEYWORDS = ['SELECT', '*', 'FROM', 'WHERE', 'AND', 'OR', '=', '>', '<', 'LIKE', 'IN', 'BETWEEN', 'IS NULL', 'ORDER BY', 'DESC', 'GROUP BY', 'HAVING', 'COUNT(*)', 'SUM(', 'AVG(', 'MAX(', 'MIN(', 'JOIN', 'ON', 'LEFT JOIN', 'AS', 'DISTINCT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'PRIMARY KEY', 'REFERENCES', 'NOT NULL', '(', ')', ',', "'", ';'];

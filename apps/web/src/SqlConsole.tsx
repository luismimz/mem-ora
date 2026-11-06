// «Tu base de datos» (usuario, 6-nov-2026: «una base de datos persistente»): una consola MySQL (SQLite por dentro, con
// la misma traducción que los laboratorios) donde lo que creas SE QUEDA: tablas y filas se guardan en este dispositivo y
// siguen ahí la próxima vez. Para practicar la escalera por tu cuenta sobre tu propio taller de bicis.
import { useEffect, useRef, useState } from 'react';
import type { Database } from 'sql.js';
import { loadSql, run, tablesOf, type ResultSet, type RunResult } from './sqlLab';

const KEY = 'memora.sql.mi-bd';
const toB64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

function Table({ r }: { r: ResultSet }) {
  return (
    <div className="lab-table-wrap"><table className="lab-table"><thead><tr>{r.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{r.rows.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody></table></div>
  );
}

export function SqlConsole({ onExit }: { onExit: () => void }) {
  const db = useRef<Database | null>(null);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState('');
  const [out, setOut] = useState<RunResult | null>(null);
  const [tables, setTables] = useState<Array<{ name: string } & ResultSet>>([]);
  const [saved, setSaved] = useState(true);
  const refresh = () => { if (db.current) setTables(tablesOf(db.current, 20)); };
  const persist = () => {
    try { localStorage.setItem(KEY, toB64(db.current!.export())); setSaved(true); } catch { setSaved(false); }
  };
  useEffect(() => {
    void loadSql().then((SQL) => {
      let stored: string | null = null;
      try { stored = localStorage.getItem(KEY); } catch { /* sin almacenamiento: base solo en memoria */ }
      db.current = stored ? new SQL.Database(fromB64(stored)) : new SQL.Database();
      db.current.exec('PRAGMA foreign_keys = ON;');
      refresh(); setReady(true);
    });
  }, []);
  function exec() {
    if (!db.current || !text.trim()) return;
    const r = run(db.current, text);
    setOut(r);
    if (r.ok) { persist(); refresh(); }
  }
  function reset() {
    if (!db.current) return;
    void loadSql().then((SQL) => { db.current = new SQL.Database(); db.current.exec('PRAGMA foreign_keys = ON;'); persist(); refresh(); setOut(null); });
  }
  return (
    <div className="app sql-console">
      <header className="sql-head">
        <button type="button" className="link" onClick={onExit}>← Inicio</button>
        <h1>🗄️ Tu base de datos</h1>
        <p className="muted">Escribe en MySQL. Lo que crees se queda guardado en este móvil (no se sube al servidor).</p>
      </header>
      <textarea className="lab-input sql-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={"CREATE TABLE bici (id INT AUTO_INCREMENT PRIMARY KEY, modelo VARCHAR(30));\nINSERT INTO bici (modelo) VALUES ('Orbea');\nSELECT * FROM bici;"} autoCapitalize="none" autoCorrect="off" spellCheck={false} rows={6} aria-label="Tu consulta" />
      <div className="sql-actions">
        <button type="button" className="primary" disabled={!ready || !text.trim()} onClick={exec}>▶ Ejecutar</button>
        <button type="button" className="link sql-reset" disabled={!ready} onClick={reset}>🗑️ Empezar de cero</button>
      </div>
      {out && (out.ok
        ? <div className="sql-out ok">{out.result ? <Table r={out.result} /> : <p>✅ Hecho{out.changes ? ` · ${out.changes} ${out.changes === 1 ? 'fila' : 'filas'}` : ''}.</p>}</div>
        : <p className="sql-out ko">❌ {out.error}</p>)}
      {!saved && <p className="sql-out ko">No se ha podido guardar en este dispositivo: lo que hagas se perderá al salir.</p>}
      <h2 className="sql-sub">Tus tablas</h2>
      {tables.length ? tables.map((t) => <section key={t.name} className="sql-table"><h3>{t.name}</h3>{t.columns.length ? <Table r={t} /> : null}</section>) : <p className="muted">Todavía no tienes tablas. Empieza con CREATE TABLE.</p>}
    </div>
  );
}

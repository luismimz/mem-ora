// Dibujos de las fichas (D-112): tablas reales (🔑 clave primaria, 🔗 clave ajena, tipos de dato, filas de ejemplo) y
// diagramas E/R (entidades, relaciones en rombo, cardinalidad y participación). Bases de datos se entiende VIENDO.
import type { Visual, VisualTable } from '@memora/content';

type ER = Extract<Visual, { kind: 'er' }>;

/** Una tabla dibujada. `onTap` convierte las cabeceras en botones (laboratorio «toca la columna»). */
export function TableView({ t, onTap, picked, right }: { t: VisualTable; onTap?: (col: string) => void; picked?: string | null; right?: string[] }) {
  const mark = new Set(t.mark ?? []), bad = new Set(t.bad ?? []);
  const id = (c: string) => `${t.name}.${c}`;
  const state = (c: string) => (picked === undefined ? '' : right?.includes(id(c)) && picked !== null ? 'is-right' : picked === id(c) ? 'is-wrong' : '');
  return (
    <figure className="vt">
      <figcaption className="vt-name">{t.name}</figcaption>
      <div className="vt-scroll">
        <table>
          <thead>
            <tr>
              {t.columns.map((c) => {
                const label = <><span className="vt-col">{c.pk && <i title="clave primaria">🔑</i>}{c.fk && <i title={`clave ajena → ${c.fk}`}>🔗</i>}{c.name}</span>{c.type && <small className="vt-type">{c.type}</small>}{c.fk && <small className="vt-fk">→ {c.fk}</small>}</>;
                const cls = `${c.pk ? 'pk' : ''} ${c.fk ? 'fk' : ''} ${mark.has(c.name) ? 'mark' : ''} ${bad.has(c.name) ? 'bad' : ''} ${state(c.name)}`;
                return <th key={c.name} className={cls}>{onTap ? <button type="button" className="vt-tap" disabled={picked !== null && picked !== undefined} onClick={() => onTap(id(c.name))}>{label}</button> : label}</th>;
              })}
            </tr>
          </thead>
          {t.rows && t.rows.length > 0 && <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={`${mark.has(t.columns[j]!.name) ? 'mark' : ''} ${bad.has(t.columns[j]!.name) ? 'bad' : ''} ${v === null ? 'null' : ''}`}>{v ?? 'NULL'}</td>)}</tr>)}</tbody>}
        </table>
      </div>
    </figure>
  );
}

/** Resultado de una consulta (laboratorio de SQL). */
export function ResultView({ columns, rows, title }: { columns: string[]; rows: string[][]; title?: string }) {
  return (
    <figure className="vt vt-result">
      {title && <figcaption className="vt-name">{title}</figcaption>}
      <div className="vt-scroll">
        <table>
          <thead><tr>{columns.map((c, i) => <th key={i}><span className="vt-col">{c}</span></th>)}</tr></thead>
          <tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={v === 'NULL' ? 'null' : ''}>{v}</td>)}</tr>) : <tr><td colSpan={Math.max(1, columns.length)} className="null">(sin filas)</td></tr>}</tbody>
        </table>
      </div>
    </figure>
  );
}

const W = 360, BOX = 140, LINE = 15;

/**
 * Diagrama E/R en SVG. Cada entidad en su fila, alternando izquierda y derecha (zigzag): así cada relación es una línea
 * diagonal con sitio para su rombo y sus cardinalidades sin pisarse (con dos en la misma fila no cabía en un móvil).
 */
export function ERView({ v }: { v: ER }) {
  const GAP = 64;
  const heights = v.entities.map((e) => 26 + Math.max(1, e.attrs.length) * LINE + 6);
  let y = 8;
  const pos = v.entities.map((e, i) => {
    const p = { e, x: v.entities.length === 1 ? (W - BOX) / 2 : i % 2 === 0 ? 8 : W - BOX - 8, y, h: heights[i]! };
    y += heights[i]! + GAP;
    return p;
  });
  const H = y - GAP + 12;
  const at = (n: string) => pos.find((p) => p.e.name === n)!;
  const center = (p: { x: number; y: number; h: number }) => ({ x: p.x + BOX / 2, y: p.y + p.h / 2 });
  // Punto del borde de la caja en dirección a otro punto (para que las líneas no tapen el texto).
  const edge = (p: { x: number; y: number; h: number }, to: { x: number; y: number }) => {
    const c = center(p), dx = to.x - c.x, dy = to.y - c.y;
    const s = Math.min(Math.abs((BOX / 2) / (dx || 1e-9)), Math.abs((p.h / 2) / (dy || 1e-9)));
    return { x: c.x + dx * s, y: c.y + dy * s };
  };
  return (
    <svg className="ver" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Diagrama E/R: ${v.entities.map((e) => e.name).join(', ')}`}>
      {v.relations.map((r, i) => {
        const a = at(r.from), b = at(r.to);
        if (!a || !b) return null;
        const ca = center(a), cb = center(b);
        const pa = edge(a, cb), pb = edge(b, ca);
        const m = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
        const [ka, kb] = r.card.split(':') as [string, string];
        const lab = (p: { x: number; y: number }, t: number) => ({ x: p.x + (m.x - p.x) * t, y: p.y + (m.y - p.y) * t });
        const la = lab(pa, 0.3), lb = lab(pb, 0.3);
        return (
          <g key={i} className="ver-rel">
            <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />
            <polygon points={`${m.x},${m.y - 16} ${m.x + 34},${m.y} ${m.x},${m.y + 16} ${m.x - 34},${m.y}`} />
            <text x={m.x} y={m.y + 4} className="ver-relname">{r.name}</text>
            <text x={la.x + 8} y={la.y + 4} className="ver-card">{r.part?.[0] ?? ka}</text>
            <text x={lb.x + 8} y={lb.y + 4} className="ver-card">{r.part?.[1] ?? kb}</text>
            {r.attrs?.length ? <text x={m.x} y={m.y + 30} className="ver-relattr">{r.attrs.join(', ')}</text> : null}
          </g>
        );
      })}
      {pos.map(({ e, x, y, h }) => (
        <g key={e.name} className={`ver-ent ${e.weak ? 'weak' : ''}`}>
          <rect x={x} y={y} width={BOX} height={h} rx={8} />
          {e.weak && <rect x={x + 4} y={y + 4} width={BOX - 8} height={h - 8} rx={6} className="inner" />}
          <text x={x + BOX / 2} y={y + 18} className="ver-name">{e.name}</text>
          {e.attrs.map((a, j) => (
            <text key={a.name} x={x + 12} y={y + 36 + j * LINE} className={`ver-attr ${a.pk ? 'pk' : ''}`}>
              {a.pk ? '🔑 ' : a.multi ? '{ } ' : a.derived ? '/ ' : '• '}{a.name}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

export function VisualView({ v }: { v: Visual }) {
  return (
    <div className="visual">
      {v.kind === 'tables' ? <div className="vt-group">{v.tables.map((t) => <TableView key={t.name} t={t} />)}</div> : <ERView v={v} />}
      {v.caption && <p className="visual-cap">{v.caption}</p>}
      {v.kind === 'er' && <p className="visual-key">🔑 identificador · {'{ }'} multivaluado · / derivado · doble borde = entidad débil</p>}
    </div>
  );
}

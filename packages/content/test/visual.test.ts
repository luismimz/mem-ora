import { describe, expect, it } from 'vitest';
import { validateUnitPayload } from '../src';

const base = { name: 'clave ajena', gist: 'une tablas', definition: 'Columna que apunta a la clave primaria de otra tabla.', examples: [{ text: 'ALQUILER.dni → CLIENTE.dni' }] };
const tables = { kind: 'tables', tables: [
  { name: 'CLIENTE', columns: [{ name: 'dni', type: 'VARCHAR2(9)', pk: true }, { name: 'nombre', type: 'VARCHAR2(40)' }], rows: [['11A', 'Ana']] },
  { name: 'ALQUILER', columns: [{ name: 'id', pk: true }, { name: 'dni', fk: 'CLIENTE.dni' }], rows: [['1', '11A']], mark: ['dni'] },
] };
const codes = (p: unknown) => validateUnitPayload('concept', p).map((i) => `${i.code}@${i.path}`);

describe('dibujos y laboratorios (D-112)', () => {
  it('acepta tablas, diagrama E/R y laboratorios bien formados', () => {
    const er = { kind: 'er', entities: [{ name: 'CLIENTE', attrs: [{ name: 'dni', pk: true }] }, { name: 'BICI', attrs: [{ name: 'id', pk: true }] }], relations: [{ name: 'alquila', from: 'CLIENTE', to: 'BICI', card: 'N:M', part: ['(0,N)', '(0,N)'] }] };
    const labs = [
      { kind: 'sql', prompt: 'Nombres de los clientes', setup: "CREATE TABLE cliente(dni TEXT, nombre TEXT); INSERT INTO cliente VALUES ('11A','Ana');", answer: 'SELECT nombre FROM cliente;' },
      { kind: 'tap', prompt: 'Toca la clave ajena', visual: tables, target: ['ALQUILER.dni'] },
    ];
    expect(codes({ ...base, examples: [{ text: 'Dos tablas', visual: tables }, { text: 'El diagrama', visual: er }], labs })).toEqual([]);
  });
  it('detecta filas de otro ancho, referencias que no existen y tipos raros', () => {
    const bad = { kind: 'tables', tables: [{ name: 'T', columns: [{ name: 'a' }], rows: [['1', '2']], mark: ['z'] }] };
    const er = { kind: 'er', entities: [{ name: 'A', attrs: [] }], relations: [{ name: 'r', from: 'A', to: 'B', card: '2:3' }] };
    const c = codes({ ...base, examples: [{ text: 'x', visual: bad }, { text: 'y', visual: er }], labs: [{ kind: 'tap', prompt: 'p', visual: tables, target: ['CLIENTE.nada'] }] });
    expect(c).toEqual(expect.arrayContaining(['visual_bad_row@examples.0.visual.tables.0.rows.0', 'visual_bad_ref@examples.0.visual.tables.0.mark.0', 'visual_bad_ref@examples.1.visual.relations.0.to', 'invalid_choice@examples.1.visual.relations.0.card', 'visual_bad_ref@labs.0.target.0']));
  });
});

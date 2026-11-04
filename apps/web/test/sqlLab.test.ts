import initSqlJs from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { gradeSql, sameResult, useEngine } from '../src/sqlLab';

const setup = `CREATE TABLE cliente (dni TEXT PRIMARY KEY, nombre TEXT NOT NULL, ciudad TEXT);
CREATE TABLE alquiler (id INTEGER PRIMARY KEY, dni TEXT REFERENCES cliente(dni), horas INTEGER);
INSERT INTO cliente VALUES ('11A','Ana','Corralejo'),('22B','Luis','Puerto'),('33C','Eva','Corralejo');
INSERT INTO alquiler VALUES (1,'11A',2),(2,'11A',3),(3,'22B',1);`;

describe('laboratorio de SQL: se corrige por el resultado (D-112)', () => {
  beforeAll(() => useEngine(initSqlJs()));
  it('dos consultas distintas con el mismo resultado son correctas', async () => {
    const lab = { setup, answer: "SELECT nombre FROM cliente WHERE ciudad = 'Corralejo';" };
    expect((await gradeSql(lab, "select nombre from cliente where ciudad like 'Corralejo'")).correct).toBe(true);
    expect((await gradeSql(lab, 'SELECT nombre FROM cliente')).correct).toBe(false);
  });
  it('el orden solo cuenta si la solución ordena', async () => {
    const lab = { setup, answer: 'SELECT nombre FROM cliente ORDER BY nombre DESC;' };
    expect((await gradeSql(lab, 'SELECT nombre FROM cliente ORDER BY nombre')).correct).toBe(false);
    expect((await gradeSql(lab, 'SELECT nombre FROM cliente ORDER BY 1 DESC')).correct).toBe(true);
  });
  it('JOIN y GROUP BY reales', async () => {
    const lab = { setup, answer: 'SELECT c.nombre, SUM(a.horas) FROM cliente c JOIN alquiler a ON a.dni = c.dni GROUP BY c.nombre;' };
    expect((await gradeSql(lab, 'SELECT nombre, SUM(horas) AS total FROM alquiler JOIN cliente USING (dni) GROUP BY nombre')).correct).toBe(true);
  });
  it('un error del motor se enseña tal cual', async () => {
    const v = await gradeSql({ setup, answer: 'SELECT nombre FROM cliente;' }, 'SELECT nombr FROM cliente');
    expect(v.correct).toBe(false);
    expect(v.error).toMatch(/no such column: nombr/);
  });
  it('INSERT, UPDATE o CREATE se comprueban por cómo queda la base', async () => {
    const lab = { setup, answer: "INSERT INTO cliente VALUES ('44D','Leo','Puerto');", check: 'SELECT * FROM cliente ORDER BY dni;' };
    expect((await gradeSql(lab, "INSERT INTO cliente (dni, nombre, ciudad) VALUES ('44D', 'Leo', 'Puerto')")).correct).toBe(true);
    expect((await gradeSql(lab, "INSERT INTO cliente VALUES ('44D','Leo','Corralejo')")).correct).toBe(false);
  });
  it('las claves ajenas se cumplen (como en Oracle)', async () => {
    const v = await gradeSql({ setup, answer: 'SELECT 1;', check: 'SELECT COUNT(*) FROM alquiler;' }, "INSERT INTO alquiler VALUES (9,'NOEXISTE',1)");
    expect(v.error).toMatch(/FOREIGN KEY/);
  });
  it('compara sin mayúsculas ni espacios y con números iguales', () => {
    expect(sameResult({ columns: ['a'], rows: [['Ana ']] }, { columns: ['x'], rows: [['ana']] }, false)).toBe(true);
  });
});

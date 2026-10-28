// Contenido desde git (D-080): el volcado al arrancar, contra una base de datos en memoria que imita lo que usa de knex
// y de los servicios de Directus. Comprueba que importa, actualiza solo lo que cambió, publica y nunca duplica.
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileProblems, stable, syncCourse } from '../src/content/sync';

type Row = Record<string, any>;
let seq = 0;

/** Lo mínimo de knex que usan el volcado y la importación: where/whereNot/whereIn/first/select/max/orderBy/update. */
function fakeDb() {
  const tables = { courses: [] as Row[], modules: [] as Row[], units: [] as Row[], associations: [] as Row[], skills: [] as Row[] } as Record<'courses' | 'modules' | 'units' | 'associations' | 'skills', Row[]> & Record<string, Row[]>;
  const db: any = (name: string) => {
    let rows = () => tables[name]!;
    const filters: Array<(r: Row) => boolean> = [];
    let order: string | null = null;
    const q: any = {
      where(o: Row) { filters.push((r) => Object.entries(o).every(([k, v]) => r[k] === v)); return q; },
      whereNot(o: Row) { filters.push((r) => !Object.entries(o).every(([k, v]) => r[k] === v)); return q; },
      whereIn(k: string, vs: unknown[]) { filters.push((r) => vs.includes(r[k])); return q; },
      orderBy(k: string) { order = k; return q; },
      all() { let out = rows().filter((r) => filters.every((f) => f(r))); if (order) out = [...out].sort((a, b) => a[order!] - b[order!]); return out; },
      async first() { return q.all()[0]; },
      async select() { return q.all(); },
      max(expr: string) { const [col] = expr.split(' '); return { first: async () => ({ m: q.all().reduce((m: number | null, r: Row) => (m === null || r[col!] > m ? r[col!] : m), null) }) }; },
      async update(patch: Row) { for (const r of q.all()) Object.assign(r, patch); return 1; },
    };
    return q;
  };
  class ItemsService {
    constructor(private c: string) {}
    async createOne(data: Row) {
      const row: Row = { id: `${this.c}-${++seq}`, status: 'draft', ...data };
      if (this.c === 'units') row.payload = JSON.stringify(data.payload);
      if (this.c === 'associations') row.evidence = data.evidence ? JSON.stringify(data.evidence) : null;
      tables[this.c]!.push(row);
      return row.id;
    }
    async updateOne(id: string, data: Row) {
      const row = tables[this.c]!.find((r) => r.id === id)!;
      Object.assign(row, data);
      if (this.c === 'units' && data.payload) row.payload = JSON.stringify(data.payload);
      if (this.c === 'associations' && 'evidence' in data) row.evidence = data.evidence ? JSON.stringify(data.evidence) : null;
      return id;
    }
    async deleteMany(ids: string[]) { tables[this.c] = tables[this.c]!.filter((r) => !ids.includes(r.id)); }
    async deleteOne(id: string) { tables[this.c] = tables[this.c]!.filter((r) => r.id !== id); }
  }
  return { db, tables, services: { ItemsService } };
}

const course = { key: 'en-test', title: 'Inglés de prueba', contentLanguage: 'en', learnerLanguage: 'es', audio: true, visibility: 'public', license: 'proprietary-own' };
const word = (key: string, text: string, meaning: string, cue: string, scene: string) => ({
  key, type: 'term', text, meaning, examples: [{ text: `My ${text} is here.`, translation: `Mi ${meaning} está aquí.` }],
  association: { technique: 'absurd_scene', cue, scene, sceneTarget: `The ${text}.`, emoji: '🎈' },
});
const mission = (n: number, units: Row[]) => ({ schemaVersion: 1, origin: 'ai', course, modules: [{ key: `0${n}-m`, title: `Misión ${n}`, units }] });
function dirWith(files: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'memora-content-'));
  for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, name), JSON.stringify(data));
  return dir;
}

describe('contenido desde git (D-080)', () => {
  const m1 = mission(1, [word('dog', 'dog', 'perro', 'DOGO', 'Un DOGO es el PERRO del rey.'), word('cat', 'cat', 'gato', 'CATA', 'Un GATO hace una CATA.')]);

  it('primer arranque: crea el curso con sus misiones y lo publica todo', async () => {
    const { db, tables, services } = fakeDb();
    const r = await syncCourse(dirWith({ '01-m.json': m1 }), { db, services, schema: {} });
    expect(r.problems).toEqual([]);
    expect(tables.courses).toHaveLength(1);
    expect(tables.units.map((u) => u.status)).toEqual(['published', 'published']);
    expect(tables.associations.every((a) => a.status === 'published')).toBe(true);
    expect(tables.modules[0]!.status).toBe('published');
    expect(tables.courses[0]!.status).toBe('published');
  });

  it('segundo arranque sin cambios: no toca nada (idempotente)', async () => {
    const { db, tables, services } = fakeDb();
    const dir = dirWith({ '01-m.json': m1 });
    await syncCourse(dir, { db, services, schema: {} });
    const before = JSON.stringify(tables);
    const r = await syncCourse(dir, { db, services, schema: {} });
    expect(r).toMatchObject({ imported: [], createdUnits: 0, updatedUnits: 0, updatedAssociations: 0, published: 0 });
    expect(JSON.stringify(tables)).toBe(before);
  });

  it('una escena corregida actualiza solo esa asociación y conserva el id de la unidad (el progreso)', async () => {
    const { db, tables, services } = fakeDb();
    await syncCourse(dirWith({ '01-m.json': m1 }), { db, services, schema: {} });
    const ids = tables.units.map((u) => u.id);
    const fixed = mission(1, [word('dog', 'dog', 'perro', 'DOGO', 'Un DOGO gigante es el PERRO del rey.'), word('cat', 'cat', 'gato', 'CATA', 'Un GATO hace una CATA.')]);
    const r = await syncCourse(dirWith({ '01-m.json': fixed }), { db, services, schema: {} });
    expect(r).toMatchObject({ updatedAssociations: 1, updatedUnits: 0, createdUnits: 0 });
    expect(tables.units.map((u) => u.id)).toEqual(ids);
    expect(tables.associations.find((a) => a.text.includes('gigante'))!.status).toBe('published');
  });

  it('una misión nueva se añade al curso existente, se publica y queda detrás en orden', async () => {
    const { db, tables, services } = fakeDb();
    await syncCourse(dirWith({ '01-m.json': m1 }), { db, services, schema: {} });
    const m2 = mission(2, [word('house', 'house', 'casa', 'JAULA', 'Tu CASA es una JAULA.')]);
    const r = await syncCourse(dirWith({ '01-m.json': m1, '02-m.json': m2 }), { db, services, schema: {} });
    expect(r.imported).toHaveLength(1);
    expect(tables.courses).toHaveLength(1);
    expect(tables.modules.map((m) => [m.key, m.sort, m.status])).toEqual([['01-m', 0, 'published'], ['02-m', 1, 'published']]);
    expect(tables.units.find((u) => u.key === 'house')!.status).toBe('published');
  });

  it('un archivo con problemas no se vuelca y se informa (nunca a medias)', async () => {
    const { db, tables, services } = fakeDb();
    const bad = mission(1, [{ key: 'x', type: 'term', text: '', meaning: '', examples: [] }]);
    const r = await syncCourse(dirWith({ '01-m.json': bad }), { db, services, schema: {} });
    expect(r.problems.length).toBeGreaterThan(0);
    expect(tables.courses).toHaveLength(0);
  });

  it('stable compara contenido sin importar el orden de las claves', () => {
    expect(stable({ a: 1, b: [{ y: 2, x: 1 }] })).toBe(stable({ b: [{ x: 1, y: 2 }], a: 1 }));
  });
});

describe('el contenido del repositorio es válido', () => {
  const root = join(__dirname, '../../../../content');
  for (const course of readdirSync(root)) {
    for (const f of readdirSync(join(root, course)).filter((x) => x.endsWith('.json'))) {
      it(`${course}/${f}`, () => {
        expect(fileProblems(JSON.parse(readFileSync(join(root, course, f), 'utf8')))).toEqual([]);
      });
    }
    // Cada archivo se valida por separado; una clave repetida en DOS misiones pisaría la misma unidad al volcar.
    it(`${course}: ninguna clave de unidad o misión se repite entre archivos`, () => {
      const seen = new Map<string, string>(); const dups: string[] = [];
      for (const f of readdirSync(join(root, course)).filter((x) => x.endsWith('.json'))) {
        const file = JSON.parse(readFileSync(join(root, course, f), 'utf8')) as { modules: Array<{ key: string; units: Array<{ key: string }> }> };
        for (const k of file.modules.flatMap((m) => [`misión ${m.key}`, ...m.units.map((u) => u.key)])) {
          if (seen.has(k)) dups.push(`${k} (${seen.get(k)} y ${f})`); else seen.set(k, f);
        }
      }
      expect(dups).toEqual([]);
    });
  }
});

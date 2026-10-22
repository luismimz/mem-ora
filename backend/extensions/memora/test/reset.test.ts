import { describe, expect, it } from 'vitest';
import { resetProgress } from '../src/api/reset';

type Row = Record<string, any>;
function fakeDb(tables: Record<string, Row[]>) {
  return (name: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    const q: any = {
      where(o: Row) { filters.push((r) => Object.entries(o).every(([k, v]) => r[k] === v)); return q; },
      async select() { return tables[name]!.filter((r) => filters.every((f) => f(r))); },
      async del() { const before = tables[name]!.length; tables[name] = tables[name]!.filter((r) => !filters.every((f) => f(r))); return before - tables[name]!.length; },
    };
    return q;
  };
}
const data = () => ({
  learning_events: [{ user: 'luis', course: 'en' }, { user: 'luis', course: 'en' }, { user: 'luis', course: 'java' }, { user: 'ana', course: 'en' }],
  learner_states: [{ user: 'luis', course: 'en' }, { user: 'ana', course: 'en' }],
  session_positions: [{ user: 'luis', course: 'en' }],
});

describe('empezar de cero (D-082)', () => {
  it('borra solo el progreso de ese alumno en ese curso, después de guardar la copia', async () => {
    const tables = data();
    let saved: any = null;
    const r = await resetProgress(fakeDb(tables), 'luis', 'en', async (b) => { saved = b; return 'file-1'; });
    expect(r).toEqual({ events: 2, backup: 'file-1' });
    expect(saved.events).toHaveLength(2);
    expect(tables.learning_events).toEqual([{ user: 'luis', course: 'java' }, { user: 'ana', course: 'en' }]);
    expect(tables.learner_states).toEqual([{ user: 'ana', course: 'en' }]);
    expect(tables.session_positions).toEqual([]);
  });

  it('si la copia falla, no se borra nada', async () => {
    const tables = data();
    await expect(resetProgress(fakeDb(tables), 'luis', 'en', async () => { throw new Error('disco lleno'); })).rejects.toThrow();
    expect(tables.learning_events).toHaveLength(4);
  });
});

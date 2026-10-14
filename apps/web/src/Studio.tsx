// Studio · importar y exportar cursos en JSON (D-041). Solo autoría y administración. Lo importado entra como
// borrador: se revisa y se publica en el panel de Studio.
import { useEffect, useState } from 'react';
import { api, ApiError, type ImportResult } from './api';

const STATUS: Record<string, string> = { draft: 'borrador', published: 'publicado', archived: 'archivado' };
const n = (count = 0, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function Studio({ onExit }: { onExit: () => void }) {
  const [file, setFile] = useState<{ name: string; data: unknown } | null>(null);
  const [result, setResult] = useState<(ImportResult & { checked: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; key: string; title: string; status: string }>>([]);

  const loadCourses = () => api.studioCourses().then(setCourses).catch(() => setCourses([]));
  useEffect(() => void loadCourses(), []);

  async function pick(f: File | undefined) {
    setResult(null);
    setError(null);
    if (!f) return setFile(null);
    try {
      const data = JSON.parse(await f.text());
      setFile({ name: f.name, data });
      await send(data, true);
    } catch {
      setFile(null);
      setError('El archivo no es un JSON válido.');
    }
  }

  async function send(data: unknown, check: boolean) {
    setBusy(true);
    try {
      setResult({ ...(await api.importCourse(data, check)), checked: check });
      if (!check) void loadCourses();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Algo ha fallado.');
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string, key: string) {
    const data = await api.exportCourse(id);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${key}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="studio">
      <div className="top"><div className="logo">M</div><span className="pill">Studio</span><button type="button" className="link" onClick={onExit}>Volver</button></div>
      <section className="card-panel">
        <h2>Importar un curso</h2>
        <p className="muted">Sube un archivo JSON con el curso completo. Primero se comprueba; si todo está bien, se crea como <b>borrador</b> para revisarlo y publicarlo en el panel de Studio. Si hay errores no se crea nada.</p>
        <input type="file" accept="application/json,.json" aria-label="Archivo del curso" onChange={(e) => void pick(e.target.files?.[0])} />
        {error && <p className="banner">{error}</p>}
        {result && !result.ok && (
          <div className="problems" role="alert">
            <p><b>{result.problems.length} {result.problems.length === 1 ? 'problema' : 'problemas'}</b> en {file?.name}. No se ha creado nada.</p>
            <ul>{result.problems.map((p, i) => <li key={i}><b>{p.where}</b>: {p.message}</li>)}</ul>
          </div>
        )}
        {result?.ok && result.checked && file && (
          <p className="ok">Todo correcto en {file.name}. <button type="button" className="primary" disabled={busy} onClick={() => void send(file.data, false)}>Importar como borrador</button></p>
        )}
        {result?.ok && !result.checked && <p className="ok">Curso creado en borrador: {n(result.modules, 'módulo', 'módulos')}, {n(result.units, 'unidad', 'unidades')} y {n(result.associations, 'asociación', 'asociaciones')}. Revísalo y publícalo en el panel de Studio.</p>}
      </section>
      <section className="card-panel">
        <h2>Exportar</h2>
        <p className="muted">Descarga cualquier curso en el mismo formato. Sirve de copia del contenido y para editarlo fuera.</p>
        <ul className="export-list">
          {courses.map((c) => <li key={c.id}><span>{c.title} <small className="muted">· {STATUS[c.status] ?? c.status}</small></span><button type="button" className="link" onClick={() => void download(c.id, c.key)}>Descargar JSON</button></li>)}
        </ul>
      </section>
    </div>
  );
}

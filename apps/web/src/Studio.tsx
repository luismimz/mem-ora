// Studio · importar y exportar cursos en JSON (D-041). Solo autoría y administración. Lo importado entra como
// borrador: se revisa y se publica en el panel de Studio.
import { useEffect, useState } from 'react';
import { api, ApiError, type ImportResult, type SessionPayload, type StudioMission, type StudioRequest } from './api';
import { AssocSession } from './AssocSession';

const STATUS: Record<string, string> = { draft: 'borrador', published: 'publicado', archived: 'archivado' };
const REASON: Record<string, string> = { asociacion: 'La asociación no ayuda', significado: 'Significado o traducción mal', respuesta: 'La respuesta correcta está mal', audio: 'El audio suena mal', otro: 'Otra cosa' };
const n = (count = 0, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function Studio() {
  const [file, setFile] = useState<{ name: string; data: unknown } | null>(null);
  const [result, setResult] = useState<(ImportResult & { checked: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; key: string; title: string; status: string }>>([]);

  const [reviewCourse, setReviewCourse] = useState<string>('');
  const [missions, setMissions] = useState<StudioMission[] | null>(null);
  const [trying, setTrying] = useState<SessionPayload | null>(null);
  const [approval, setApproval] = useState<Record<string, string>>({});

  const loadCourses = () => api.studioCourses().then((list) => { setCourses(list); setReviewCourse((c) => c || list[0]?.id || ''); }).catch(() => setCourses([]));
  useEffect(() => void loadCourses(), []);
  const loadMissions = (id: string) => { if (!id) return; setMissions(null); void api.studioMissions(id).then(setMissions).catch(() => setMissions([])); };
  useEffect(() => void loadMissions(reviewCourse), [reviewCourse]);
  const [requests, setRequests] = useState<StudioRequest[] | null>(null);
  const loadRequests = (id: string) => { if (!id) return; setRequests(null); void api.studioRequests(id).then(setRequests).catch(() => setRequests([])); };
  useEffect(() => void loadRequests(reviewCourse), [reviewCourse]);
  async function closeRequest(r: StudioRequest, status: 'done' | 'dismissed') {
    setRequests((list) => (list ?? []).filter((x) => x.id !== r.id));
    await api.closeRequest(r.id, status).catch(() => loadRequests(reviewCourse));
  }

  async function tryMission(m: StudioMission) {
    try { setTrying(await api.previewMission(m.id)); } catch (e) { setApproval((a) => ({ ...a, [m.id]: e instanceof ApiError ? e.message : 'No se ha podido abrir.' })); }
  }
  async function approve(m: StudioMission) {
    setApproval((a) => ({ ...a, [m.id]: 'Aprobando…' }));
    try {
      const r = await api.approveMission(m.id);
      setApproval((a) => ({ ...a, [m.id]: r.failed.length ? `Publicadas ${r.published}. No se han podido publicar: ${r.failed.map((f) => `${f.key} (${f.message})`).join('; ')}` : `✓ Publicadas ${r.published}. La misión ya está en la app.` }));
      void loadMissions(reviewCourse);
      void loadCourses();
    } catch (e) {
      setApproval((a) => ({ ...a, [m.id]: e instanceof ApiError ? e.message : 'Algo ha fallado.' }));
    }
  }

  if (trying) return <AssocSession key={trying.state.plan.sessionId} payload={trying} courseId={trying.state.plan.courseId} preview staff onExit={() => setTrying(null)} onReload={() => setTrying(null)} />;


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
    <main className="studio">
      <header className="page-head"><p className="eyebrow">STUDIO</p><h1>Contenido</h1><p className="muted">Revisa y publica misiones, importa cursos y descarga copias.</p></header>
      <div className="studio-grid">
      <section className="card-panel studio-review">
        <h2>Revisar misiones</h2>
        <p className="muted">Prueba cada misión como la verá el alumno (no guarda progreso) y, si está bien, apruébala: se publican sus unidades y asociaciones con tu cuenta, con las mismas comprobaciones que en el panel.</p>
        <select aria-label="Curso a revisar" value={reviewCourse} onChange={(e) => setReviewCourse(e.target.value)}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? c.status}</option>)}
        </select>
        <ul className="export-list mission-review">
          {missions === null && <li className="muted" role="status">Cargando misiones…</li>}
          {(missions ?? []).map((m) => (
            <li key={m.id}>
              <span><b>{m.title}</b> <small className="muted">· {m.published === m.total ? 'publicada' : `${m.total - m.published} por publicar`}{m.rejected ? ` · ${m.rejected} rechazadas` : ''}</small>
                {approval[m.id] && <small className="approval">{approval[m.id]}</small>}</span>
              <span className="actions-inline">
                <button type="button" className="link" onClick={() => void tryMission(m)}>Probar</button>
                {m.published < m.total - m.rejected && <button type="button" className="link" onClick={() => void approve(m)}>Aprobar y publicar</button>}
              </span>
            </li>
          ))}
          {missions?.length === 0 && <li className="muted">Este curso no tiene misiones.</li>}
        </ul>
      </section>
      <div className="studio-side">
      <section className="card-panel studio-requests">
        <h2>Avisos de los alumnos {requests?.length ? <small className="muted">· {requests.length}</small> : null}</h2>
        <p className="muted">Errores que han reportado desde una tarjeta (⚑) y fichas que pidieron explicar mejor. Corrige el contenido (en <code>content/</code> o aquí) y márcalo como corregido.</p>
        <ul className="export-list">
          {requests === null && <li className="muted" role="status">Cargando avisos…</li>}
          {(requests ?? []).map((r) => (
            <li key={r.id}>
              <span><b>{r.label}</b> <small className="muted">· {r.unit}</small><br />
                <small className={r.kind === 'error' ? 'req-error' : 'muted'}>{r.kind === 'error' ? `⚑ ${REASON[r.reason ?? 'otro'] ?? r.reason}` : '🤔 Pide más explicación'}{r.times > 1 ? ` · ${r.times} veces` : ''}{r.note ? ` · «${r.note}»` : ''}</small></span>
              <span className="actions-inline">
                <a className="link" href={`/preview/${r.unitId}`} target="_blank" rel="noreferrer">Ver ficha</a>
                <button type="button" className="link" onClick={() => void closeRequest(r, 'done')}>Corregido</button>
                <button type="button" className="link" onClick={() => void closeRequest(r, 'dismissed')}>Descartar</button>
              </span>
            </li>
          ))}
          {requests?.length === 0 && <li className="muted">No hay avisos pendientes en este curso. 🎉</li>}
        </ul>
      </section>
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
      </div>
    </main>
  );
}

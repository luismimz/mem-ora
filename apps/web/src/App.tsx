import { Studio } from './Studio';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Course, type Me, type Mission, type SessionPayload } from './api';
import { AssocSession } from './AssocSession';
import { ARCADE_FROM, CHAT_AFTER_GRAMMAR, GRAMMAR_EVERY, milestones, type Milestones } from './milestones';
import { setLanguage } from './i18n';
import { setAudioEnabled } from './speech';

type Mode = 'associations' | 'grammar' | 'arcade' | 'chat';
type View = { name: 'loading' } | { name: 'login' } | { name: 'home' } | { name: 'session'; course: Course; payload: SessionPayload; mission?: string } | { name: 'studio' } | { name: 'preview'; payload: SessionPayload | null; error?: string };

const previewId = () => window.location.pathname.match(/^\/preview\/([\w-]+)/)?.[1] ?? null;
const PREF = 'memora.preferences';
/** Preferencias de la interfaz en este dispositivo (curso y modo por defecto). No es progreso: el progreso vive en el servidor. */
function readPrefs(): { course?: string; mode?: Mode } {
  try { return JSON.parse(localStorage.getItem(PREF) ?? '{}'); } catch { return {}; }
}
function writePrefs(p: { course?: string; mode?: Mode }) {
  try { localStorage.setItem(PREF, JSON.stringify({ ...readPrefs(), ...p })); } catch { /* sin almacenamiento */ }
}

const MODES: Array<{ id: Mode; ico: string; title: string; text: string; ready: boolean; lock?: string }> = [
  { id: 'associations', ico: '◈', title: 'Asociaciones', text: 'Historias absurdas que se quedan contigo.', ready: true },
  { id: 'grammar', ico: '▣', title: 'Gramática', text: 'Trucos para pasar del español al inglés.', ready: false, lock: 'Llega en el siguiente paso: un truco tras cada 15 palabras.' },
  { id: 'arcade', ico: '✦', title: 'Arcade', text: 'Recuerda jugando. Ya salta por sorpresa desde las 20 palabras.', ready: false, lock: 'El modo libre llega en el H3.' },
  { id: 'chat', ico: '◌', title: 'Chat', text: 'Conversa con personajes.', ready: false, lock: 'Se abre tras 3 sesiones de gramática.' },
];

export function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [me, setMe] = useState<Me | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<string | null>(readPrefs().course ?? null);
  const [mode, setMode] = useState<Mode>(readPrefs().mode ?? 'associations');
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [ms, setMs] = useState<Milestones | null>(null);
  const [missions, setMissions] = useState<{ missions: Mission[]; current: string | null } | null>(null);

  const start = useCallback(async () => {
    try { setMe(await api.me()); } catch { setView({ name: 'login' }); return; }
    api.whoami().then((w) => setStaff(w.staff)).catch(() => setStaff(false));
    const unitId = previewId();
    if (unitId) {
      try { setView({ name: 'preview', payload: await api.preview(unitId) }); } catch (e) { setView({ name: 'preview', payload: null, error: e instanceof Error ? e.message : 'Error' }); }
      return;
    }
    const list = await api.courses();
    setCourses(list);
    setCourse((c) => (c && list.some((x) => x.id === c) ? c : list[0]?.id ?? null));
    setView({ name: 'home' });
  }, []);
  useEffect(() => void start(), [start]);
  useEffect(() => {
    if (!course || view.name !== 'home') return;
    setMissions(null);
    api.progress(course).then((p) => setMs(milestones(p))).catch(() => setMs(null));
    api.missions(course).then(setMissions).catch(() => setMissions(null));
  }, [course, view.name]);

  async function open(selected: Mode, mission?: string) {
    const c = courses.find((x) => x.id === course);
    if (!c) return;
    const info = MODES.find((m) => m.id === selected)!;
    if (!info.ready) { setError(info.lock ?? 'Próximamente.'); return; }
    setLanguage(c.ui_language);
    setAudioEnabled(c.audio_enabled !== false);
    setError(null);
    try { setView({ name: 'session', course: c, payload: await api.session(c.id, mission), ...(mission ? { mission } : {}) }); } catch (e) { setError(e instanceof ApiError ? e.message : 'Algo ha fallado.'); }
  }

  if (view.name === 'loading') return <div className="app"><p style={{ paddingTop: '30vh', textAlign: 'center' }}>Preparando tu aventura…</p></div>;
  if (view.name === 'login') return <div className="app"><Login onDone={() => void start()} /></div>;
  if (view.name === 'preview') return <div className="app">{view.payload ? <AssocSession payload={view.payload} courseId={view.payload.state.plan.courseId} preview staff={staff} onExit={() => window.close()} onReload={() => void start()} /> : <p className="banner">{view.error}</p>}</div>;
  if (view.name === 'studio') return <div className="app"><Studio onExit={() => void start()} /></div>;
  if (view.name === 'session') return <div className="app"><AssocSession key={view.payload.state.plan.sessionId} payload={view.payload} courseId={view.course.id} staff={staff} onExit={() => void start()} onReload={() => void open('associations', view.mission)} onMission={(key) => void open('associations', key)} /></div>;

  const current = courses.find((c) => c.id === course);
  const enabled = MODES.filter((m) => !current || current.modes.includes(m.id));
  const has = (m: Mode) => enabled.some((x) => x.id === m);
  const currentMission = missions?.missions.find((m) => m.key === missions.current);
  return (
    <div className="app home">
      <div className="top"><div className="logo">M</div>{(me?.first_name || me?.email) && <span className="pill">{me?.first_name || me?.email}</span>}{staff && <button type="button" className="link" onClick={() => setView({ name: 'studio' })}>Studio</button>}<button type="button" className="link" onClick={() => void api.logout().then(() => setView({ name: 'login' }))}>Salir</button></div>
      <div className="home-grid">
        <section className="home-main">
          <div className="courses" role="tablist" aria-label="Cursos">
            {courses.map((c) => <button key={c.id} type="button" role="tab" aria-selected={c.id === course} className={c.id === course ? 'on' : ''} onClick={() => { setCourse(c.id); writePrefs({ course: c.id }); }}>{c.title.replace(/\s*\(.*\)$/, '')}</button>)}
          </div>
          <p className="eyebrow">TU AVENTURA</p>
          <h1>La historia sigue contigo.</h1>
          {current ? (
            <div className="hero">
              <div className="hero-art"><span aria-hidden="true">{current.title.startsWith('Java') ? '☕🧩' : '🏠🗝️'}</span><span className="tag">{current.title.replace(/\s*\(.*\)$/, '').toUpperCase()}</span></div>
              <div className="hero-body">
                <p className="eyebrow">MODO {(enabled.find((m) => m.id === mode) ?? enabled[0] ?? MODES[0]!).title.toUpperCase()}</p>
                {currentMission ? (
                  <>
                    <h3 className="hero-mission">Misión {currentMission.index} · {currentMission.title.replace(/^Misión \d+ · /, '')}</h3>
                    <p>{currentMission.worked}/{currentMission.total} trabajadas · {currentMission.status === 'pending' ? 'empieza aquí' : 'sigues por donde lo dejaste'}. Los repasos vuelven solos según la curva del olvido.</p>
                  </>
                ) : <p>{current.new_per_session ?? 15} nuevas por sesión, en escenas de 5. Puedes hacer varias sesiones al día; los repasos vuelven según la curva del olvido.</p>}
                <button type="button" className="primary" onClick={() => void open(has(mode) ? mode : 'associations')}>Continuar aventura →</button>
              </div>
            </div>
          ) : <p className="banner">Todavía no tienes cursos publicados.</p>}
          {ms && (
            <div className="meters" aria-label="Tu progreso">
              <Meter label="Palabras trabajadas" value={`${ms.words}/${ms.total}`} pct={ms.total ? ms.words / ms.total : 0} />
              {has('grammar') && <Meter label="Próximo truco de gramática" value={`faltan ${ms.grammarNext}`} pct={(GRAMMAR_EVERY - ms.grammarNext) / GRAMMAR_EVERY} />}
              {has('arcade') && <Meter label="Arcade sorpresa" value={ms.arcadeLeft ? `faltan ${ms.arcadeLeft}` : '¡activo!'} pct={Math.min(1, ms.words / ARCADE_FROM)} />}
              {has('chat') && (has('grammar')
                ? <Meter label="Chat" value={`${ms.grammarSessions}/${CHAT_AFTER_GRAMMAR} gramáticas`} pct={ms.grammarSessions / CHAT_AFTER_GRAMMAR} />
                : <Meter label="Chat" value={ms.words >= GRAMMAR_EVERY ? '¡disponible pronto!' : `faltan ${GRAMMAR_EVERY - ms.words}`} pct={Math.min(1, ms.words / GRAMMAR_EVERY)} />)}
            </div>
          )}
          {error && <p className="banner" role="status">{error}</p>}
        </section>
        <section className="home-side">
          <p className="eyebrow">ELIGE TU MOMENTO</p>
          <h2 className="h2">¿Qué te apetece hacer?</h2>
          <div className="modes">
            {enabled.map((m) => (
              <button key={m.id} type="button" className={`mode ${m.id === 'arcade' ? 'warm' : ''} ${m.ready ? '' : 'locked'}`} onClick={() => void open(m.id)}>
                <span className="ico">{m.ico}</span><b>{m.title}</b><span>{m.ready ? '↗' : '🔒'}</span>
                <small>{mode === m.id && <span className="fav">POR DEFECTO · </span>}{m.ready ? m.text : m.id === 'chat' && !has('grammar') ? 'En este curso se abre al llevar 15 conceptos trabajados.' : m.lock}</small>
              </button>
            ))}
          </div>
          <label className="pref"><span className="eyebrow">Modo por defecto</span>
            <select value={mode} onChange={(e) => { const v = e.target.value as Mode; setMode(v); writePrefs({ mode: v }); }}>
              {enabled.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
        </section>
      </div>
      {missions && missions.missions.length > 1 && <Missions list={missions.missions} current={missions.current} onOpen={(key) => void open('associations', key)} />}
    </div>
  );
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
  return <div className="meter"><div className="row"><span>{label}</span><b>{value}</b></div><div className="bar"><i style={{ width: `${Math.round(pct * 100)}%` }} /></div></div>;
}

/**
 * Las misiones del curso, como un mapa de juego, a todo el ancho y en filas (sin desplazamiento lateral). Tres estados
 * bien distintos: completada (✓), la actual (resaltada, «Continuar») y pendiente. Cada misión se puede abrir por separado.
 */
function Missions({ list, current, onOpen }: { list: Mission[]; current: string | null; onOpen: (key: string) => void }) {
  const done = list.filter((m) => m.status === 'done').length;
  const active = list.filter((m) => m.status === 'active').length;
  const pending = list.length - done - active;
  const clean = (t: string) => t.replace(/^Misión \d+ · /, '');
  return (
    <section className="missions" aria-label="Misiones">
      <div className="missions-head">
        <div><p className="eyebrow">TUS MISIONES</p><h2 className="h2">{done}/{list.length} completadas</h2></div>
        <ul className="missions-legend" aria-label="Leyenda">
          <li className="done">{done} completadas</li>
          <li className="active">{active} en curso</li>
          <li className="pending">{pending} pendientes</li>
        </ul>
      </div>
      <i className="missions-total" aria-hidden="true"><i style={{ width: `${(done / list.length) * 100}%` }} /></i>
      <ol className="mission-grid">
        {list.map((m) => {
          const isCurrent = m.key === current;
          const pct = m.total ? Math.round((m.worked / m.total) * 100) : 0;
          return (
            <li key={m.key}>
              <button type="button" className={`mission ${m.status} ${isCurrent ? 'current' : ''}`} onClick={() => onOpen(m.key)}
                aria-label={`Misión ${m.index}: ${clean(m.title)}. ${m.status === 'done' ? 'Completada' : m.status === 'active' ? `En curso, ${m.worked} de ${m.total}` : 'Pendiente'}`}>
                <span className="mission-top">
                  <span className="mission-n">{m.status === 'done' ? '✓' : m.index}</span>
                  <span className="mission-state">{isCurrent ? 'CONTINUAR →' : m.status === 'done' ? 'COMPLETADA' : m.status === 'active' ? 'EN CURSO' : 'PENDIENTE'}</span>
                </span>
                <b>{clean(m.title)}</b>
                <span className="mission-foot">
                  <i className="mission-bar"><i style={{ width: `${pct}%` }} /></i>
                  <small>{m.worked}/{m.total}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  return (
    <main style={{ paddingTop: '12vh' }}>
      <div className="logo" style={{ marginBottom: '1rem' }}>M</div>
      <h1>Aprende hoy. Recuérdalo mañana.</h1>
      <form className="login" onSubmit={(e) => { e.preventDefault(); api.login(email, password).then(onDone, () => setFailed(true)); }}>
        <input type="email" autoComplete="username" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Correo" />
        <input type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="Contraseña" />
        {failed && <p className="banner">No se ha podido entrar. Revisa el correo y la contraseña.</p>}
        <button type="submit" className="primary">Entrar</button>
      </form>
    </main>
  );
}

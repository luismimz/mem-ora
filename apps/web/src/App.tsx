import { Studio } from './Studio';
import { RetosHome } from './Retos';
import { bundles, cacheMe, cachedMe, downloadBundle, flush, isNetworkError, pendingCount, sessionProgress, type OfflineBundle, type OfflineSession } from './offline';
import { useCallback, useEffect, useState } from 'react';
import { Exam } from './Exam';
import { api, ApiError, type Course, type Me, type Mission, type Progress, type SessionPayload } from './api';
import { AssocSession } from './AssocSession';
import { Feed } from './Feed';
import { ARCADE_FROM, CHAT_AFTER_GRAMMAR, GRAMMAR_EVERY, milestones, type Milestones } from './milestones';
import { setLanguage } from './i18n';
import { preloadVoice, setAudioEnabled } from './speech';

type Mode = 'associations' | 'grammar' | 'arcade' | 'chat';
type View =
  | { name: 'loading' }
  | { name: 'login' }
  | { name: 'home' }
  | { name: 'profile' }
  | { name: 'offline' }
  | { name: 'offlineSession'; bundle: OfflineBundle; session: OfflineSession }
  | { name: 'studio' }
  | { name: 'session'; course: Course; payload: SessionPayload; mission?: string; focus?: 'fallos' }
  | { name: 'exam'; course: Course }
  | { name: 'preview'; payload: SessionPayload | null; error?: string };

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

/** Idiomas hablan de «palabras»; el resto de materias, de «conceptos». */
const isLanguage = (c?: Course) => c?.subject === 'idioma' || Boolean(c?.modes.includes('grammar'));
const unitsWord = (c?: Course) => (isLanguage(c) ? 'palabras' : 'conceptos');
const courseArt = (c?: Course) => (isLanguage(c) ? '🏠🗝️' : c?.subject === 'programación' ? '☕🧩' : '📚✨');
const cleanTitle = (t: string) => t.replace(/\s*\(.*\)$/, '');
const cleanMission = (t: string) => t.replace(/^Misión \d+ · /, '');

// ─── Direcciones: cada pantalla tiene la suya, así «atrás» del navegador funciona y nunca te saca de la app ───
type Route = { name: 'home' } | { name: 'offline' } | { name: 'profile' } | { name: 'studio' } | { name: 'session'; course: string; mission?: string; focus?: 'fallos' } | { name: 'exam'; course: string } | { name: 'preview'; unit: string };
function readRoute(): Route {
  const { pathname, search } = window.location;
  const q = new URLSearchParams(search);
  const preview = pathname.match(/^\/preview\/([\w-]+)/);
  if (preview) return { name: 'preview', unit: preview[1]! };
  if (pathname === '/perfil') return { name: 'profile' };
  if (pathname === '/sin-conexion') return { name: 'offline' };
  if (pathname === '/studio') return { name: 'studio' };
  if (pathname === '/simulacro' && q.get('curso')) return { name: 'exam', course: q.get('curso')! };
  if (pathname === '/sesion' && q.get('curso')) return { name: 'session', course: q.get('curso')!, ...(q.get('mision') ? { mission: q.get('mision')! } : {}), ...(q.get('foco') === 'fallos' ? { focus: 'fallos' as const } : {}) };
  return { name: 'home' };
}
function routePath(r: Route): string {
  if (r.name === 'profile') return '/perfil';
  if (r.name === 'offline') return '/sin-conexion';
  if (r.name === 'studio') return '/studio';
  if (r.name === 'preview') return `/preview/${r.unit}`;
  if (r.name === 'exam') return `/simulacro?curso=${encodeURIComponent(r.course)}`;
  if (r.name === 'session') return `/sesion?curso=${encodeURIComponent(r.course)}${r.mission ? `&mision=${encodeURIComponent(r.mission)}` : ''}${r.focus ? `&foco=${r.focus}` : ''}`;
  return '/';
}
const TITLES: Record<string, string> = { offline: 'Sin conexión', offlineSession: 'Sesión sin conexión', home: 'Inicio', profile: 'Tu perfil', studio: 'Studio', session: 'Sesión', exam: 'Simulacro', preview: 'Vista previa', login: 'Entrar', loading: 'Memora' };

export function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [me, setMe] = useState<Me | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<string | null>(readPrefs().course ?? null);
  const [mode, setMode] = useState<Mode>(readPrefs().mode ?? 'associations');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [ms, setMs] = useState<Milestones | null>(null);
  const [prog, setProg] = useState<Progress | null>(null);
  const [missions, setMissions] = useState<{ missions: Mission[]; current: string | null; newToday?: number; newTarget?: number } | null>(null);
  const [nudge, setNudge] = useState<Mode | null>(null);

  useEffect(() => { document.title = `${TITLES[view.name] ?? 'Memora'} · Memora`; }, [view.name]);

  /** Lleva a una pantalla y la apunta en el historial del navegador. */
  const go = useCallback((r: Route, replace = false) => {
    const path = routePath(r);
    if (path !== window.location.pathname + window.location.search) window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
    void show(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  async function openSession(c: Course, mission?: string, focus?: 'fallos') {
    setLanguage(c.ui_language);
    setAudioEnabled(c.audio_enabled !== false);
    if (c.audio_enabled !== false) preloadVoice(c.content_language);
    setError(null);
    setNotice(null);
    try { setView({ name: 'session', course: c, payload: await api.session(c.id, mission, focus), ...(mission ? { mission } : {}), ...(focus ? { focus } : {}) }); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Algo ha fallado.'); window.history.replaceState(null, '', '/'); setView({ name: 'home' }); }
  }

  async function show(r: Route, list: Course[] = courses) {
    if (r.name === 'preview') {
      try { setView({ name: 'preview', payload: await api.preview(r.unit) }); } catch (e) { setView({ name: 'preview', payload: null, error: e instanceof Error ? e.message : 'Error' }); }
      return;
    }
    if (r.name === 'exam') {
      const c = list.find((x) => x.id === r.course);
      if (c) { setCourse(c.id); return setView({ name: 'exam', course: c }); }
      window.history.replaceState(null, '', '/');
      return setView({ name: 'home' });
    }
    if (r.name === 'session') {
      const c = list.find((x) => x.id === r.course);
      if (c) { setCourse(c.id); return openSession(c, r.mission, r.focus); }
      window.history.replaceState(null, '', '/');
      return setView({ name: 'home' });
    }
    setView({ name: r.name } as View);
  }

  const start = useCallback(async () => {
    let who: Me | undefined;
    // D-071: solo se pide entrar si la sesión caducó de verdad (401/403). Un fallo pasajero del servidor (p. ej. al
    // desplegar) se reintenta unos segundos en vez de sacar al alumno.
    for (let attempt = 0; attempt < 5 && !who; attempt += 1) {
      try { who = await api.me(); } catch (e) {
        const saved = cachedMe();
        // Sin cobertura y con algo descargado: se abre directamente el modo sin conexión.
        if (isNetworkError(e) && saved && Object.keys(bundles()).length) { setMe(saved); setView({ name: 'offline' }); return; }
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 401 || status === 403 || (!saved && !isNetworkError(e))) { setView({ name: 'login' }); return; }
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (!who) { setView({ name: 'login' }); return; }
    setMe(who); cacheMe(who);
    // Si quedaron respuestas guardadas en el móvil, se envían ya.
    if (pendingCount()) flush().then((n) => n && setNotice(`Sincronizadas ${n} respuestas que hiciste sin conexión.`)).catch(() => undefined);
    api.whoami().then((w) => setStaff(w.staff)).catch(() => setStaff(false));
    const list = await api.courses().catch(() => [] as Course[]);
    setCourses(list);
    setCourse((c) => (c && list.some((x) => x.id === c) ? c : list[0]?.id ?? null));
    await show(readRoute(), list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void start(), [start]);
  useEffect(() => {
    const onPop = () => void show(readRoute());
    const onOnline = () => { if (pendingCount()) flush().then((n) => n && setNotice(`Sincronizadas ${n} respuestas que hiciste sin conexión.`)).catch(() => undefined); };
    window.addEventListener('popstate', onPop);
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('online', onOnline); };
  });
  useEffect(() => {
    if (!course || view.name !== 'home') return;
    setMissions(null);
    setProg(null);
    api.progress(course).then((p) => { setMs(milestones(p)); setProg(p); }).catch(() => { setMs(null); setProg(null); });
    api.missions(course).then(setMissions).catch(() => setMissions(null));
  }, [course, view.name]);

  function open(selected: Mode, mission?: string) {
    const info = MODES.find((m) => m.id === selected)!;
    // Un modo bloqueado no navega: su tarjeta ya explica por qué, y se resalta para que se vea.
    if (!info.ready) { setNudge(selected); window.setTimeout(() => setNudge(null), 900); return; }
    if (course) go({ name: 'session', course, ...(mission ? { mission } : {}) });
  }

  /** Al salir de una sesión: vuelve a Inicio y recuerda que el avance está guardado y dónde sigue. */
  function leaveSession() {
    if (view.name === 'session') {
      const m = view.payload.state.mission;
      setNotice(m ? `Tu avance está guardado. Sigues en la Misión ${m.index} · ${cleanMission(m.title)}.` : 'Tu avance está guardado.');
    }
    go({ name: 'home' });
  }

  async function logout() {
    await api.logout();
    window.history.replaceState(null, '', '/');
    setMe(null);
    setView({ name: 'login' });
  }

  if (view.name === 'loading') return <div className="app"><p className="loading" role="status">Preparando tu aventura…</p></div>;
  if (view.name === 'login') return <div className="app"><Login onDone={() => void start()} /></div>;
  if (view.name === 'preview') return <div className="app">{view.payload ? <AssocSession payload={view.payload} courseId={view.payload.state.plan.courseId} preview staff={staff} onExit={() => window.close()} onReload={() => void start()} /> : <p className="banner">{view.error}</p>}</div>;
  // Modo Flujo (D-072): pantalla completa propia, sin la estructura de la sesión por escenas.
  if (view.name === 'exam') return <div className="app"><Exam key={view.course.id} course={view.course} onExit={() => go({ name: 'home' })} onFailures={() => go({ name: 'session', course: view.course.id, focus: 'fallos' })} /></div>;
  if (view.name === 'session' && (view.payload.state.plan as { mode?: string }).mode === 'flow') return <Feed key={view.payload.state.plan.sessionId} payload={view.payload} courseId={view.course.id} onExit={leaveSession} onAgain={() => void openSession(view.course, view.mission, view.focus)} next={() => api.session(view.course.id)} />;
  if (view.name === 'session') return <div className="app"><AssocSession key={view.payload.state.plan.sessionId} payload={view.payload} courseId={view.course.id} staff={staff} onExit={leaveSession} onReload={() => void openSession(view.course, view.mission)} onMission={(key) => go({ name: 'session', course: view.course.id, mission: key })} /></div>;

  if (view.name === 'offlineSession') {
    const p = sessionProgress(view.session.id);
    const payload = { state: { ...view.session.state, ...(p ?? {}) }, units: view.bundle.units };
    setAudioEnabled(false);
    return <div className="app"><AssocSession key={view.session.id} payload={payload as SessionPayload} courseId={view.bundle.course.id} offline onExit={() => go({ name: 'offline' })} onReload={() => go({ name: 'offline' })} /></div>;
  }
  const bar = <TopBar me={me} staff={staff} active={view.name} onNav={(name) => go({ name })} />;
  if (view.name === 'offline') return <div className="app">{bar}<OfflineHome online={navigator.onLine} onPlay={(bundle, session) => setView({ name: 'offlineSession', bundle, session })} /></div>;
  if (view.name === 'studio') return <div className="app">{bar}<Studio /></div>;
  if (view.name === 'profile') return <div className="app">{bar}<Profile me={me} courses={courses} course={course} mode={mode} staff={staff}
    onCourse={(id) => { setCourse(id); writePrefs({ course: id }); }} onMode={(m) => { setMode(m); writePrefs({ mode: m }); }} onLogout={() => void logout()} /></div>;

  const current = courses.find((c) => c.id === course);
  // En un curso con Flujo (D-068) todo va dentro del Flujo (la gramática entra como «truco»): el selector de modos y
  // sus contadores (truco, Arcade, Chat) serían modos bloqueados que ya no existen.
  const flowCourse = Boolean((current?.modes as string[] | undefined)?.includes('flow'));
  const enabled = flowCourse ? [] : MODES.filter((m) => !current || current.modes.includes(m.id as Mode));
  const has = (m: Mode) => enabled.some((x) => x.id === m);
  const currentMission = missions?.missions.find((m) => m.key === missions.current);
  const words = unitsWord(current);
  const isMem = Boolean(current?.modes.includes('memory'));
  // Repasos vencidos ahora; el total del curso sale de las misiones (el progreso solo lista lo ya practicado).
  const due = prog ? prog.skills.filter((s) => s.dueAt !== null && s.dueAt <= Date.now()).length : null;
  const worked = missions?.missions.length
    ? missions.missions.reduce((a, m) => ({ done: a.done + m.worked, total: a.total + m.total }), { done: 0, total: 0 })
    : { done: ms?.words ?? 0, total: ms?.total ?? 0 };
  return (
    <div className="app home">
      {bar}
      {notice && <p className="banner notice" role="status">✓ {notice} <button type="button" className="link" aria-label="Cerrar aviso" onClick={() => setNotice(null)}>✕</button></p>}
      <div className="home-grid">
        <section className="home-main">
          {courses.length > 1 && (
            <div className="courses" role="tablist" aria-label="Tus cursos">
              {courses.map((c) => <button key={c.id} type="button" role="tab" aria-selected={c.id === course} className={c.id === course ? 'on' : ''} onClick={() => { setCourse(c.id); writePrefs({ course: c.id }); }}>{cleanTitle(c.title)}</button>)}
            </div>
          )}
          <p className="eyebrow">{isMem ? 'TU AVENTURA' : 'HOY'}</p>
          <h1>{isMem ? 'La historia sigue contigo.' : me?.first_name ? `Hola, ${me.first_name}.` : 'Hola.'}</h1>
          {current && isMem ? <RetosHome courseId={current.id} /> : current ? (
            <div className="hero">
              <div className="hero-art"><span aria-hidden="true">{courseArt(current)}</span><span className="tag">{cleanTitle(current.title).toUpperCase()}</span></div>
              <div className="hero-body">
                {enabled.length > 1 && <p className="eyebrow">MODO {(enabled.find((m) => m.id === mode) ?? enabled[0] ?? MODES[0]!).title.toUpperCase()}</p>}
                <ul className="today" aria-label="Tu día">
                  <li><b>{prog?.streak ?? '—'}</b><span>🔥 {prog?.streak === 1 ? 'día' : 'días'} de racha</span></li>
                  <li><b>{due ?? '—'}</b><span>🔁 {due === 1 ? 'repaso' : 'repasos'} pendientes</span></li>
                  <li className={prog?.today && prog.today.newUnits >= prog.today.goal ? 'goal-done' : ''}><b>{prog?.today ? `${prog.today.newUnits}/${prog.today.goal}` : '—'}</b><span>🎯 meta de hoy</span></li>
                </ul>
                {prog?.today && <div className="goal-bar" aria-label={`Meta de hoy: ${prog.today.newUnits} de ${prog.today.goal}`}><i style={{ width: `${Math.min(100, Math.round((prog.today.newUnits / Math.max(1, prog.today.goal)) * 100))}%` }} /></div>}
                {!missions ? (
                  <><h3 className="hero-mission skeleton-text">&nbsp;</h3><p className="skeleton-text">&nbsp;<br />&nbsp;</p></>
                ) : currentMission ? (
                  <>
                    <h3 className="hero-mission">Misión {currentMission.index} · {cleanMission(currentMission.title)}</h3>
                    <p>{currentMission.worked}/{currentMission.total} {words} · {currentMission.status === 'pending' ? 'empiezas aquí' : 'sigues por donde lo dejaste'}.</p>
                  </>
                ) : <p>Desliza para aprender. Los repasos vuelven solos, justo antes de que se te olviden.</p>}
                <button type="button" className="primary" onClick={() => open(has(mode) ? mode : 'associations')}>{currentMission?.status === 'pending' && currentMission.index === 1 ? 'Empezar →' : 'Seguir aprendiendo →'}</button>
                {(current.modes as string[]).includes('flow') && (prog?.failures ?? 0) > 0 && (
                  <button type="button" className="fails-btn" onClick={() => go({ name: 'session', course: current.id, focus: 'fallos' })}>
                    <span className="fails-n">{prog!.failures}</span>
                    <span><b>Vacía tus fallos</b><small>{prog!.failures === 1 ? 'Te queda 1 por acertar' : `Te quedan ${prog!.failures} por acertar`}{prog!.failures! > 8 ? ' · de 8 en 8' : ''}</small></span>
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </div>
          ) : <p className="banner">Todavía no tienes cursos publicados.</p>}
          {!ms && current && !isMem && <div className="meters" aria-hidden="true">{[0, 1].map((i) => <div key={i} className="meter skeleton" />)}</div>}
          {ms && !isMem && (
            <div className="meters" aria-label="Tu progreso">
              <Meter label={`${words[0]!.toUpperCase()}${words.slice(1)} trabajad${isLanguage(current) ? 'as' : 'os'}`} value={`${worked.done}/${worked.total}`} pct={worked.total ? worked.done / worked.total : 0} />
              {has('grammar') && <Meter label="Próximo truco de gramática" value={`faltan ${ms.grammarNext}`} pct={(GRAMMAR_EVERY - ms.grammarNext) / GRAMMAR_EVERY} />}
              {has('arcade') && <Meter label="Arcade sorpresa" value={ms.arcadeLeft ? `faltan ${ms.arcadeLeft}` : '¡activo!'} pct={Math.min(1, ms.words / ARCADE_FROM)} />}
              {has('chat') && (has('grammar')
                ? <Meter label="Chat" value={`${ms.grammarSessions}/${CHAT_AFTER_GRAMMAR} gramáticas`} pct={ms.grammarSessions / CHAT_AFTER_GRAMMAR} />
                : <Meter label="Chat" value={ms.words >= GRAMMAR_EVERY ? '¡disponible pronto!' : `faltan ${GRAMMAR_EVERY - ms.words}`} pct={Math.min(1, ms.words / GRAMMAR_EVERY)} />)}
            </div>
          )}
          {prog && !isMem && <Constancy prog={prog} missionsDone={missions?.missions.filter((m) => m.status === 'done').length ?? 0} words={words} />}
          {error && <p className="banner" role="alert">{error}</p>}
        </section>
        <section className="home-side">
          {enabled.length > 1 && <>
          <p className="eyebrow">ELIGE TU MOMENTO</p>
          <h2 className="h2">¿Qué te apetece hacer?</h2>
          <div className="modes">
            {enabled.map((m) => (
              <button key={m.id} type="button" aria-disabled={!m.ready} className={`mode ${m.id === 'arcade' ? 'warm' : ''} ${m.ready ? '' : 'locked'} ${nudge === m.id ? 'nudge' : ''}`} onClick={() => open(m.id)}>
                <span className="ico">{m.ico}</span><b>{m.title}</b><span>{m.ready ? '↗' : '🔒'}</span>
                <small>{mode === m.id && <span className="fav">POR DEFECTO · </span>}{m.ready ? m.text : m.id === 'chat' && !has('grammar') ? `En este curso se abre al llevar 15 ${words} trabajad${isLanguage(current) ? 'as' : 'os'}.` : m.lock}</small>
              </button>
            ))}
          </div>
          </>}
          {current && !isMem && !isLanguage(current) && (current.modes as string[]).includes('flow') && <ExamCard stats={prog?.exam} onOpen={() => go({ name: 'exam', course: current.id })} />}
          {current && !isMem && <FlightCard course={current} onOpen={() => go({ name: 'offline' })} />}
          {enabled.length > 1 && <p className="hint">Puedes cambiar el modo por defecto en <button type="button" className="link" onClick={() => go({ name: 'profile' })}>tu perfil</button>.</p>}
        </section>
      </div>
      {current && !isMem && (missions
        ? missions.missions.length > 0 && <Missions list={missions.missions} current={missions.current} onOpen={(key) => open('associations', key)} />
        : <section className="missions" aria-hidden="true"><div className="missions-head"><div><p className="eyebrow">TUS MISIONES</p><h2 className="h2 skeleton-text">&nbsp;</h2></div></div><ol className="mission-grid">{[0, 1, 2].map((i) => <li key={i}><span className="mission skeleton" /></li>)}</ol></section>)}
    </div>
  );
}

/**
 * Barra superior, igual en todas las pantallas (menos dentro de una sesión, que tiene la suya para concentrarse):
 * el logo vuelve a Inicio, la sección actual se marca, y el avatar lleva a tu perfil.
 */
function TopBar({ me, staff, active, onNav }: { me: Me | null; staff: boolean; active: string; onNav: (name: 'home' | 'profile' | 'studio' | 'offline') => void }) {
  const name = me?.first_name || me?.email?.split('@')[0] || 'Tú';
  const link = (id: 'home' | 'studio' | 'offline', label: string) => <button type="button" className={`nav-link ${active === id ? 'on' : ''}`} aria-current={active === id ? 'page' : undefined} onClick={() => onNav(id)}>{label}</button>;
  return (
    <header className="topbar">
      <button type="button" className="logo" aria-label="Memora · ir a Inicio" onClick={() => onNav('home')}>M</button>
      <nav aria-label="Principal" className="nav">
        {link('home', 'Inicio')}
        {link('offline', 'Sin conexión')}
        {staff && link('studio', 'Studio')}
      </nav>
      <button type="button" className={`avatar ${active === 'profile' ? 'on' : ''}`} aria-current={active === 'profile' ? 'page' : undefined} aria-label={`Tu perfil (${name})`} onClick={() => onNav('profile')}>
        <span className="avatar-i" aria-hidden="true">{name[0]!.toUpperCase()}</span><span className="avatar-n">{name}</span>
      </button>
    </header>
  );
}

/** Tu perfil: quién eres, cómo vas en cada curso, tus preferencias y la salida (lejos de los botones de uso diario). */
function Profile({ me, courses, course, mode, staff, onCourse, onMode, onLogout }: { me: Me | null; courses: Course[]; course: string | null; mode: Mode; staff: boolean; onCourse: (id: string) => void; onMode: (m: Mode) => void; onLogout: () => void }) {
  const [progress, setProgress] = useState<Record<string, { done: number; total: number; worked: number; units: number }>>({});
  useEffect(() => {
    for (const c of courses) {
      api.missions(c.id).then((r) => setProgress((p) => ({ ...p, [c.id]: { done: r.missions.filter((m) => m.status === 'done').length, total: r.missions.length, worked: r.missions.reduce((a, m) => a + m.worked, 0), units: r.missions.reduce((a, m) => a + m.total, 0) } }))).catch(() => undefined);
    }
  }, [courses]);
  const current = courses.find((c) => c.id === course);
  const modes = MODES.filter((m) => !current || current.modes.includes(m.id));
  const name = me?.first_name || me?.email?.split('@')[0] || 'Tú';
  return (
    <main className="profile">
      <div className="profile-col">
      <section className="card-panel profile-head">
        <span className="avatar-i big" aria-hidden="true">{name[0]!.toUpperCase()}</span>
        <div><h1>{name}</h1><p className="muted">{me?.email}{staff ? ' · autoría y revisión' : ''}</p></div>
      </section>
      <section className="card-panel">
        <h2>Tu progreso</h2>
        <ul className="progress-list">
          {courses.map((c) => {
            const p = progress[c.id];
            return (
              <li key={c.id}>
                <div className="row"><b>{cleanTitle(c.title)}</b><span className="muted">{p ? `${p.done}/${p.total} misiones · ${p.worked}/${p.units} ${unitsWord(c)}` : '…'}</span></div>
                <i className="mission-bar"><i style={{ width: `${p && p.units ? (p.worked / p.units) * 100 : 0}%` }} /></i>
              </li>
            );
          })}
          {!courses.length && <li className="muted">Todavía no tienes cursos.</li>}
        </ul>
      </section>
      </div>
      <div className="profile-col">
      <section className="card-panel">
        <h2>Preferencias</h2>
        <p className="muted">Se guardan en este dispositivo. Tu progreso está siempre en tu cuenta.</p>
        <label className="field"><span>Curso al entrar</span>
          <select value={course ?? ''} onChange={(e) => onCourse(e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{cleanTitle(c.title)}</option>)}</select>
        </label>
        <label className="field"><span>Modo por defecto</span>
          <select value={mode} onChange={(e) => onMode(e.target.value as Mode)}>{modes.map((m) => <option key={m.id} value={m.id}>{m.title}{m.ready ? '' : ' (próximamente)'}</option>)}</select>
        </label>
      </section>
      {current && <ResetCourse course={current} />}
      <section className="card-panel">
        <h2>Cuenta</h2>
        <button type="button" className="danger" onClick={onLogout}>Cerrar sesión</button>
      </section>
      </div>
    </main>
  );
}

/** Empezar de cero en un curso (D-082): dos toques para que no sea por error; se guarda una copia antes de borrar. */
function ResetCourse({ course }: { course: Course }) {
  const [step, setStep] = useState<'idle' | 'ask' | 'busy' | 'done' | 'error'>('idle');
  async function reset() {
    setStep('busy');
    try { await api.resetProgress(course.id, course.key); setStep('done'); } catch { setStep('error'); }
  }
  return (
    <section className="card-panel reset-course">
      <h2>Empezar de cero</h2>
      <p className="muted">Borra tu progreso en <b>{cleanTitle(course.title)}</b> para verlo todo desde la primera misión. Antes se guarda una copia. El resto de cursos no cambia.</p>
      {step === 'idle' && <button type="button" className="danger" onClick={() => setStep('ask')}>🔄 Empezar de cero en este curso</button>}
      {step === 'ask' && (
        <div className="reset-ask">
          <p><b>¿Seguro?</b> Volverás a la misión 1 con todo como nuevo.</p>
          <button type="button" className="danger" onClick={() => void reset()}>Sí, empezar de cero</button>
          <button type="button" className="link" onClick={() => setStep('idle')}>Cancelar</button>
        </div>
      )}
      {step === 'busy' && <p className="muted">Guardando la copia y borrando…</p>}
      {step === 'done' && <p className="notice">✓ Listo. Vuelve a Inicio y empieza la misión 1.</p>}
      {step === 'error' && <p className="banner">No se ha podido. No se ha borrado nada; inténtalo otra vez.</p>}
    </section>
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
  // Cuarto estado: lo ya trabajado que se está olvidando («conviene repasar»).
  const review = list.filter((m) => m.status !== 'pending' && (m.due ?? 0) > 0).length;
  const clean = (t: string) => t.replace(/^Misión \d+ · /, '');
  return (
    <section className="missions" aria-label="Misiones">
      <div className="missions-head">
        <div><p className="eyebrow">TUS MISIONES</p><h2 className="h2">{done}/{list.length} completadas</h2></div>
        <ul className="missions-legend" aria-label="Leyenda">
          <li className="done">{done} {done === 1 ? 'completada' : 'completadas'}</li>
          <li className="active">{active} en curso</li>
          <li className="pending">{pending} {pending === 1 ? 'pendiente' : 'pendientes'}</li>
          {review > 0 && <li className="review">{review} por repasar</li>}
        </ul>
      </div>
      <i className="missions-total" aria-hidden="true"><i style={{ width: `${(done / list.length) * 100}%` }} /></i>
      <ol className="mission-grid">
        {list.map((m) => {
          const isCurrent = m.key === current;
          const pct = m.total ? Math.round((m.worked / m.total) * 100) : 0;
          const fading = m.status !== 'pending' && (m.due ?? 0) > 0;
          return (
            <li key={m.key}>
              <button type="button" className={`mission ${m.status} ${fading ? 'fading' : ''} ${isCurrent ? 'current' : ''}`} onClick={() => onOpen(m.key)}
                aria-label={`Misión ${m.index}: ${clean(m.title)}. ${m.status === 'done' ? 'Completada' : m.status === 'active' ? `En curso, ${m.worked} de ${m.total}` : 'Pendiente'}${fading ? `. Conviene repasar ${m.due}` : ''}`}>
                <span className="mission-top">
                  <span className="mission-n">{m.status === 'done' ? '✓' : m.index}</span>
                  <span className="mission-state">{isCurrent ? 'CONTINUAR →' : fading ? `REPASAR · ${m.due}` : m.status === 'done' ? 'COMPLETADA' : m.status === 'active' ? 'EN CURSO' : 'PENDIENTE'}</span>
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

/**
 * Tu constancia (ideas de benrios.dev): los días que has estudiado en las últimas 12 semanas y logros HONESTOS. Los de
 * memoria cuentan solo lo que ya está en tu memoria a largo plazo (aprendido o más), no lo visto ni lo acertado al
 * elegir; los de racha usan tu mejor racha, para que no se pierdan si un día fallas.
 */
const TRACKS: Array<{ id: string; ico: string; steps: number[]; label: (n: number, words: string) => string }> = [
  { id: 'memory', ico: '🧠', steps: [10, 50, 100, 250, 500, 1000], label: (n, w) => `${n} ${w} en tu memoria` },
  { id: 'streak', ico: '🔥', steps: [3, 7, 14, 30, 60], label: (n) => `${n} días seguidos` },
  { id: 'missions', ico: '🗺️', steps: [1, 3, 5, 10, 17], label: (n) => `${n} ${n === 1 ? 'misión completada' : 'misiones completadas'}` },
];
function Constancy({ prog, missionsDone, words }: { prog: Progress; missionsDone: number; words: string }) {
  const cal = prog.calendar ?? [];
  const studied = cal.filter((n) => n > 0).length;
  // Lunes = 0 … domingo = 6; la última celda (hoy) cae en su fila y las semanas van en columnas.
  const today = (new Date().getDay() + 6) % 7;
  const pad = (today - ((cal.length - 1) % 7) + 7) % 7;
  const level = (n: number) => (n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4);
  // Logro conseguido: con la mejor racha. Lo que falta para el siguiente: con la racha de ahora (hay que encadenar días).
  const value: Record<string, number> = { memory: prog.units.filter((u) => u.level !== 'none').length, streak: Math.max(prog.bestStreak ?? 0, prog.streak ?? 0), missions: missionsDone };
  const now: Record<string, number> = { ...value, streak: prog.streak ?? 0 };
  return (
    <section className="constancy" aria-label="Tu constancia">
      <div className="constancy-head"><p className="eyebrow">TU CONSTANCIA</p><small>{studied} {studied === 1 ? 'día' : 'días'} estudiando en 12 semanas</small></div>
      {cal.length > 0 && (
        <div className="cal" role="img" aria-label={`Calendario: ${studied} días con estudio en las últimas 12 semanas`}>
          {Array.from({ length: pad }, (_, i) => <i key={`p${i}`} className="cal-pad" />)}
          {cal.map((n, i) => <i key={i} className={`cal-${level(n)} ${i === cal.length - 1 ? 'cal-today' : ''}`} title={`${n} respuestas`} />)}
        </div>
      )}
      <ul className="tracks">
        {TRACKS.map((t) => {
          const v = value[t.id] ?? 0;
          const got = t.steps.filter((x) => v >= x);
          const next = t.steps.find((x) => v < x);
          const prev = got[got.length - 1] ?? 0;
          const cur = now[t.id] ?? v;
          const base = t.id === 'streak' ? 0 : prev;
          return (
            <li key={t.id} className={got.length ? 'earned' : ''}>
              <span className="track-ico" aria-hidden="true">{t.ico}</span>
              <span className="track-body">
                <b>{got.length ? t.label(prev, words) : `Primer logro: ${t.label(t.steps[0]!, words)}`}</b>
                {next ? <><i className="track-bar"><i style={{ width: `${Math.round((Math.max(0, cur - base) / (next - base)) * 100)}%` }} /></i><small>Siguiente logro: {t.label(next, words)} · faltan {next - cur}</small></> : <small>¡Todos los logros de este camino! 🏆</small>}
              </span>
              <span className="track-n" aria-label={`${got.length} de ${t.steps.length} logros`}>{got.length}/{t.steps.length}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Simulacro de examen en Inicio (cursos que no son de idiomas): la mejor nota y a por otro. */
function ExamCard({ stats, onOpen }: { stats?: Progress['exam']; onOpen: () => void }) {
  const best = stats?.best;
  const g = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <section className="card-panel exam-card">
      <h2>📝 Simulacro de examen</h2>
      <p className="muted">30 preguntas de todo lo que has trabajado, 60 minutos, sin ayudas hasta el final. Se aprueba con un 7.</p>
      {best && <p className="exam-card-best">Mejor nota: <b className={best.grade >= 7 ? 'pass' : 'fail'}>{g(best.grade)}</b> · {stats!.taken} {stats!.taken === 1 ? 'simulacro' : 'simulacros'}</p>}
      <button type="button" className="primary" onClick={onOpen}>{best ? 'Hacer otro simulacro' : 'Hacer un simulacro'}</button>
    </section>
  );
}

/** Preparar un curso para jugar sin conexión (avión, metro): descarga sus sesiones al móvil. */
function FlightCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const [state, setState] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });
  const saved = bundles()[course.id];
  async function download() {
    setState({ busy: true, msg: null });
    try {
      const b = await downloadBundle(course.id);
      setState({ busy: false, msg: `✓ Listo: ${b.sessions.length} sesiones guardadas en este dispositivo.` });
    } catch (e) {
      setState({ busy: false, msg: e instanceof Error ? e.message : 'No se ha podido descargar.' });
    }
  }
  return (
    <section className="flight card-panel">
      <div className="row"><b>✈️ Sin conexión</b>{saved && <button type="button" className="link" onClick={onOpen}>Abrir</button>}</div>
      <p className="muted">{saved ? `Descargado el ${new Date(saved.generatedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: ${saved.sessions.length} sesiones.` : 'Descarga este curso para estudiar sin cobertura. Tus respuestas se guardan en el móvil y se envían al volver la red.'}</p>
      <button type="button" className="primary" disabled={state.busy} onClick={() => void download()}>{state.busy ? 'Descargando…' : saved ? 'Actualizar descarga' : 'Descargar para el vuelo'}</button>
      {state.msg && <p className="muted" role="status">{state.msg}</p>}
    </section>
  );
}

/** Lo descargado, listo para jugar sin red: sesiones por curso con su estado. */
function OfflineHome({ online, onPlay }: { online: boolean; onPlay: (b: OfflineBundle, s: OfflineSession) => void }) {
  const all = Object.values(bundles());
  const pending = pendingCount();
  return (
    <main className="offline">
      <header className="page-head"><p className="eyebrow">{online ? 'CON CONEXIÓN' : 'SIN CONEXIÓN'}</p><h1>Modo avión</h1>
        <p className="muted">{pending ? `${pending} respuestas guardadas en el móvil: se enviarán solas al volver la red.` : 'Todo sincronizado.'}</p></header>
      {!all.length && <p className="banner">Aún no has descargado ningún curso. Con conexión, ve a Inicio y pulsa «Descargar para el vuelo».</p>}
      {all.map((b) => (
        <section key={b.course.id} className="card-panel">
          <h2>{b.course.title.replace(/\s*\(.*\)$/, '')}</h2>
          <ul className="offline-list">
            {b.sessions.map((s) => {
              const p = sessionProgress(s.id);
              const st = p?.finished ? 'hecha' : p && p.index > 0 ? `en curso · ${Math.round((p.index / s.state.plan.steps.length) * 100)} %` : 'pendiente';
              return (
                <li key={s.id}>
                  <button type="button" className={`offline-item ${p?.finished ? 'done' : ''}`} onClick={() => onPlay(b, s)}>
                    <span>{p?.finished ? '✓' : '▶'}</span><b>{s.title.replace(/^Misión (\d+) · /, 'M$1 · ')}</b><small>{st}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  // Las cuentas con verificación en dos pasos (2FA) piden además el código de la app de autenticación.
  const [needsOtp, setNeedsOtp] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setFailed(null);
    try {
      await api.login(email, password, needsOtp ? otp.replace(/\s/g, '') : undefined);
      onDone();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'INVALID_OTP') {
        if (needsOtp) setFailed('El código no es correcto o ha caducado. Prueba con el que muestra ahora tu app de autenticación.');
        setNeedsOtp(true);
      } else setFailed('No se ha podido entrar. Revisa el correo y la contraseña.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="logo" style={{ marginBottom: '1rem' }}>M</div>
      <h1>Aprende hoy. Recuérdalo mañana.</h1>
      <form className="login" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <input type="email" autoComplete="username" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Correo" disabled={needsOtp} />
        <input type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="Contraseña" disabled={needsOtp} />
        {needsOtp && (
          <>
            <p className="muted">Tu cuenta tiene verificación en dos pasos. Escribe el código de 6 cifras de tu app de autenticación.</p>
            <input inputMode="numeric" autoComplete="one-time-code" placeholder="Código de verificación" value={otp} onChange={(e) => setOtp(e.target.value)} required aria-label="Código de verificación" autoFocus maxLength={8} />
          </>
        )}
        {failed && <p className="banner" role="alert">{failed}</p>}
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Entrando…' : needsOtp ? 'Verificar y entrar' : 'Entrar'}</button>
        {needsOtp && <button type="button" className="link" onClick={() => { setNeedsOtp(false); setOtp(''); setFailed(null); }}>Usar otra cuenta</button>}
      </form>
    </main>
  );
}

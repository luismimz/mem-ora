import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Course, type Me, type SessionPayload } from './api';
import { setLanguage, t } from './i18n';
import { SessionView } from './SessionView';

type View = { name: 'loading' } | { name: 'login' } | { name: 'courses' } | { name: 'session'; course: Course; payload: SessionPayload } | { name: 'preview'; unitId: string; payload: SessionPayload | null; error?: string };

const previewId = () => window.location.pathname.match(/^\/preview\/([\w-]+)/)?.[1] ?? null;

export function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [me, setMe] = useState<Me | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch {
      setView({ name: 'login' });
      return;
    }
    const unitId = previewId();
    if (unitId) {
      try {
        setView({ name: 'preview', unitId, payload: await api.preview(unitId) });
      } catch (e) {
        setView({ name: 'preview', unitId, payload: null, error: e instanceof Error ? e.message : t('error.generic') });
      }
      return;
    }
    setCourses(await api.courses());
    setView({ name: 'courses' });
  }, []);

  useEffect(() => void start(), [start]);

  async function openCourse(course: Course) {
    setLanguage(course.ui_language);
    setError(null);
    try {
      setView({ name: 'session', course, payload: await api.session(course.id) });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('error.generic'));
    }
  }

  async function logout() {
    await api.logout();
    setMe(null);
    setView({ name: 'login' });
  }

  return (
    <div className="app">
      <header>
        <strong>{t('app.name')}</strong>
        {me && <span className="who">{me.first_name ?? me.email} · <button type="button" className="link" onClick={() => void logout()}>{t('logout')}</button></span>}
      </header>
      {view.name === 'loading' && <p>{t('session.loading')}</p>}
      {view.name === 'login' && <Login onDone={() => void start()} />}
      {view.name === 'courses' && (
        <main>
          <h1>{t('courses.title')}</h1>
          {error && <p className="banner warn">{error}</p>}
          {courses.length === 0 ? <p>{t('courses.empty')}</p> : (
            <ul className="courses">{courses.map((c) => <li key={c.id}><span>{c.title}</span><button type="button" onClick={() => void openCourse(c)}>{t('courses.study')}</button></li>)}</ul>
          )}
        </main>
      )}
      {view.name === 'session' && <SessionView key={view.payload.state.plan.sessionId} payload={view.payload} courseId={view.course.id} onExit={() => void start()} onReload={() => void openCourse(view.course)} />}
      {view.name === 'preview' && (view.payload ? <SessionView payload={view.payload} courseId={view.payload.state.plan.courseId} preview onExit={() => window.close()} onReload={() => void start()} /> : <main><p className="banner warn">{view.error}</p></main>)}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  return (
    <main>
      <h1>{t('login.title')}</h1>
      <form className="login" onSubmit={(e) => { e.preventDefault(); api.login(email, password).then(onDone, () => setFailed(true)); }}>
        <label>{t('login.email')}<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>{t('login.password')}<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {failed && <p className="banner warn">{t('login.error')}</p>}
        <button type="submit">{t('login.submit')}</button>
      </form>
    </main>
  );
}

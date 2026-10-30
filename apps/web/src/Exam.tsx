// Simulacro de examen (idea de benrios.dev, 22-oct-2026). 30 preguntas de todo lo ya trabajado, 60 minutos, sin
// ayudas hasta el final; se aprueba con un 7. Al terminar: la nota, la mejor nota y la corrección de cada fallo con su
// explicación. Las respuestas cuentan como reconocimiento (peso bajo, regla 9) y los fallos van a «Vacía tus fallos».
import { useEffect, useMemo, useRef, useState } from 'react';
import { examCorrect, exercisesOf, exerciseView, isMulti, MULTI_SEP, unitText, type ClientEvent } from '@memora/experiences';
import { api, ApiError, type Course, type ExamPayload, type ExamStats } from './api';
import { deviceId, nextSeq } from './device';
import { enqueue, isNetworkError } from './offline';

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const grade1 = (g: number) => g.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function Exam({ course, onExit, onFailures, onGuided }: { course: Course; onExit: () => void; onFailures: () => void; onGuided: () => void }) {
  const [data, setData] = useState<ExamPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [doubt, setDoubt] = useState<Record<string, boolean>>({});
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [leaving, setLeaving] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [result, setResult] = useState<{ correct: number; grade: number; ms: number; stats: ExamStats | null } | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(true);
  const started = useRef(0);
  const shownAt = useRef(0);

  useEffect(() => { api.exam(course.id).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : 'No se ha podido preparar el simulacro.')); }, [course.id]);
  useEffect(() => {
    if (phase !== 'run') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);
  useEffect(() => { shownAt.current = Date.now(); setConfirmEnd(false); }, [idx]);
  const left = deadline - now;
  useEffect(() => { if (phase === 'run' && left <= 0) void finish(); }, [left, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const questions = data?.questions ?? [];
  const q = questions[idx];
  const answered = useMemo(() => questions.filter((x) => picks[x.id] !== undefined).length, [questions, picks]);

  function start() {
    const t = Date.now();
    started.current = t; shownAt.current = t;
    setDeadline(t + (data?.minutes ?? 60) * 60_000); setNow(t); setPhase('run');
  }
  function pick(option: string) {
    if (!q) return;
    // Varias correctas (D-105): cada toque marca o desmarca; se guardan juntas.
    if (q.multi) {
      const cur = (picks[q.id] ?? '').split(MULTI_SEP).filter(Boolean);
      const next = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option];
      setPicks((p) => { const n = { ...p }; if (next.length) n[q.id] = next.join(MULTI_SEP); else delete n[q.id]; return n; });
      setSpent((s) => ({ ...s, [q.id]: (s[q.id] ?? 0) + (Date.now() - shownAt.current) }));
      shownAt.current = Date.now();
      return;
    }
    setPicks((p) => ({ ...p, [q.id]: option }));
    setSpent((s) => ({ ...s, [q.id]: (s[q.id] ?? 0) + (Date.now() - shownAt.current) }));
    shownAt.current = Date.now();
  }
  async function finish() {
    if (!data || phase !== 'run') return;
    setPhase('done');
    const ms = Date.now() - started.current;
    const correct = questions.filter((x) => examCorrect(x, data.units, picks[x.id] ?? null)).length;
    const total = questions.length;
    const grade = Math.round((correct / total) * 100) / 10;
    setResult({ correct, grade, ms, stats: null });
    // Cada respuesta, como reconocimiento (peso bajo). En un examen, lo que se deja en blanco cuenta como fallo: así
    // también entra en «Vacía tus fallos» y se repasa.
    const events: ClientEvent[] = questions.map((x) => ({
      id: crypto.randomUUID(), kind: 'attempt', at: Date.now(), deviceId: deviceId(), seq: nextSeq(), courseId: course.id, unitKey: x.unitKey, skillKey: x.skillKey,
      format: 'recognition_choice', correct: examCorrect(x, data.units, picks[x.id] ?? null), hint: 0, timeMs: Math.round(spent[x.id] ?? 0), contextId: `${x.unitKey}#exam`, ...(doubt[x.id] ? { doubt: true } : {}),
    }));
    try { if (events.length) await api.events(course.id, events); } catch (e) { if (isNetworkError(e)) enqueue(course.id, events); }
    try { const r = await api.examResult(course.id, { examId: data.examId, correct, total, ms }); setResult({ correct, grade: r.grade, ms, stats: r.stats }); } catch { /* la nota se ve igual */ }
  }

  if (error) return <main className="exam"><p className="banner">{error}</p><button type="button" className="primary" onClick={onExit}>Volver</button></main>;
  if (!data) return <main className="exam"><p className="loading" role="status">Preparando tu simulacro…</p></main>;
  if (!data.available) return (
    <main className="exam exam-intro">
      <p className="eyebrow">SIMULACRO DE EXAMEN</p>
      <h1>Aún no hay bastante</h1>
      <p>El simulacro pregunta solo lo que ya has trabajado, y para que sea un examen necesita al menos {data.need} fichas con preguntas. Llevas {data.worked}.</p>
      <p>Mientras tanto, el <b>modelo guiado</b> te enseña cada tema antes de su pregunta.</p>
      <button type="button" className="primary" onClick={onGuided}>📖 Aprende y resuelve</button>
      <button type="button" className="link" onClick={onExit}>Seguir aprendiendo</button>
    </main>
  );

  if (phase === 'intro') {
    const best = data.stats.best;
    return (
      <main className="exam exam-intro">
        <p className="eyebrow">SIMULACRO DE EXAMEN · {course.title.toUpperCase()}</p>
        <h1>¿Aprobarías hoy?</h1>
        <ul className="exam-rules">
          <li>📝 <b>{questions.length} preguntas</b> de todos los temas que ya has trabajado</li>
          <li>⏱️ <b>{data.minutes} minutos</b>; al acabar el tiempo se entrega solo</li>
          <li>🤐 <b>Sin ayudas</b> hasta el final: después ves cada fallo con su explicación (en blanco cuenta como fallo)</li>
          <li>✅ Se aprueba con un <b>{data.pass}</b></li>
        </ul>
        <p className="exam-best">{best ? <>Tu mejor nota: <b>{grade1(best.grade)}</b> · {data.stats.taken} {data.stats.taken === 1 ? 'simulacro' : 'simulacros'}</> : 'Es tu primer simulacro de este curso.'}</p>
        <button type="button" className="primary" onClick={start}>Empezar el simulacro</button>
        <button type="button" className="link" onClick={onGuided}>Prefiero antes el modelo guiado (ficha y pregunta)</button>
        <button type="button" className="link" onClick={onExit}>Ahora no</button>
      </main>
    );
  }

  if (phase === 'done' && result) {
    const pass = result.grade >= data.pass;
    const best = result.stats?.best;
    const list = questions.map((x, n) => ({ x, n, ok: examCorrect(x, data.units, picks[x.id] ?? null) })).filter((r) => !onlyWrong || !r.ok);
    return (
      <main className="exam exam-done">
        <p className="eyebrow">RESULTADO DEL SIMULACRO</p>
        <div className={`exam-grade ${pass ? 'pass' : 'fail'}`}><b>{grade1(result.grade)}</b><span>{pass ? '✅ APROBADO' : '❌ SUSPENSO'}</span></div>
        <p className="exam-sum">{result.correct} de {questions.length} correctas · {mmss(result.ms)} de {data.minutes}:00{best ? <> · mejor nota: <b>{grade1(best.grade)}</b></> : null}</p>
        {result.correct < questions.length && <button type="button" className="fails-btn" onClick={onFailures}><span className="fails-n">{questions.length - result.correct}</span><span><b>Repasa tus fallos ahora</b><small>Con su ficha y su explicación, en el Flujo</small></span><span aria-hidden="true">→</span></button>}
        <div className="exam-filter" role="tablist" aria-label="Qué preguntas ver">
          <button type="button" role="tab" aria-selected={onlyWrong} className={onlyWrong ? 'on' : ''} onClick={() => setOnlyWrong(true)}>Fallos ({questions.length - result.correct})</button>
          <button type="button" role="tab" aria-selected={!onlyWrong} className={!onlyWrong ? 'on' : ''} onClick={() => setOnlyWrong(false)}>Todas ({questions.length})</button>
        </div>
        <ol className="exam-review">
          {list.map(({ x, n, ok }) => {
            const ex = exercisesOf(data.units[x.unitKey]!)[x.exercise]!;
            const mine = picks[x.id];
            return (
              <li key={x.id} className={ok ? 'ok' : 'ko'}>
                <small>Pregunta {n + 1} · {unitText(data.units[x.unitKey]!)}{doubt[x.id] ? ' · 🤔 la marcaste dudosa' : ''}</small>
                <p className="exam-q">{exerciseView(ex).prompt}</p>
                {ex.code && <pre className="exam-code"><code>{exerciseView(ex).code}</code></pre>}
                {!ok && <p className="exam-mine">{mine === undefined ? 'Sin responder' : <>Tu respuesta: <s>{mine.split(MULTI_SEP).join(' · ')}</s></>}</p>}
                <p className="exam-right">✓ {isMulti(ex) ? ex.answers!.join(' · ') : ex.answer}</p>
                {ex.explanation && <p className="exam-why">{ex.explanation}</p>}
              </li>
            );
          })}
          {list.length === 0 && <li className="ok"><p className="exam-q">¡Ningún fallo! 🎉</p></li>}
        </ol>
        <button type="button" className="primary" onClick={onExit}>Volver a Inicio</button>
      </main>
    );
  }

  if (!q) return null;
  const ex = exercisesOf(data.units[q.unitKey]!)[q.exercise]!;
  const last = idx === questions.length - 1;
  return (
    <main className="exam exam-run">
      <header className="exam-top">
        {leaving
          ? <><button type="button" className="exam-leave" onClick={onExit}>Salir y perderlo</button><button type="button" className="link" onClick={() => setLeaving(false)}>Seguir</button></>
          : <button type="button" className="exam-x" aria-label="Salir del simulacro" onClick={() => setLeaving(true)}>✕</button>}
        <span className="exam-count">{idx + 1}/{questions.length}</span>
        <span className={`exam-clock ${left < 5 * 60_000 ? 'hurry' : ''}`} role="timer" aria-label={`Quedan ${mmss(left)}`}>⏱️ {mmss(left)}</span>
      </header>
      <div className="exam-dots" aria-hidden="true">{questions.map((x, n) => <i key={x.id} className={`${picks[x.id] !== undefined ? 'done' : ''} ${doubt[x.id] ? 'doubt' : ''} ${n === idx ? 'here' : ''}`} onClick={() => setIdx(n)} />)}</div>
      <p className="exam-q">{exerciseView(ex).prompt}</p>
      {ex.code && <pre className="exam-code"><code>{exerciseView(ex).code}</code></pre>}
      {q.multi && <p className="multi-hint">☑️ Marca <b>todas</b> las correctas</p>}
      <div className="exam-options">
        {q.options.map((o, n) => { const on = q.multi ? (picks[q.id] ?? '').split(MULTI_SEP).includes(o) : picks[q.id] === o; return <button type="button" key={o} className={on ? 'on' : ''} {...(q.multi ? { role: 'checkbox', 'aria-checked': on } : { 'aria-pressed': on })} onClick={() => pick(o)}><span>{'ABCDEFGH'[n]}</span>{o}</button>; })}
      </div>
      <button type="button" className={`unsure-inline ${doubt[q.id] ? 'on' : ''}`} aria-pressed={Boolean(doubt[q.id])} onClick={() => setDoubt((d) => ({ ...d, [q.id]: !d[q.id] }))}>🤔 {doubt[q.id] ? 'Marcada como dudosa' : 'Marcar como dudosa'}</button>
      <nav className="exam-nav">
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>← Anterior</button>
        {last
          ? (confirmEnd || answered === questions.length
            ? <button type="button" className="primary" onClick={() => void finish()}>{answered === questions.length ? 'Entregar' : `Entregar con ${questions.length - answered} sin responder`}</button>
            : <button type="button" className="primary" onClick={() => setConfirmEnd(true)}>Entregar</button>)
          : <button type="button" className="primary" onClick={() => setIdx((i) => i + 1)}>Siguiente →</button>}
      </nav>
      <p className="exam-left">{answered} de {questions.length} respondidas</p>
    </main>
  );
}

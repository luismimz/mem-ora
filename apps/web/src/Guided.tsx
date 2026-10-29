// Modelo de examen guiado (petición del usuario, 23-oct-2026: «debes enseñarme primero y después se resuelven»).
// Cada pregunta del modelo llega DESPUÉS de su ficha: primero se aprende (qué es, ejemplo, el truco para recordarlo) y
// luego se resuelve, con la corrección y su porqué al momento. Sin reloj. Va por orden del temario y puede incluir temas
// aún no trabajados (por eso enseña antes). Las respuestas cuentan poco (vista la ficha justo antes: pista 1; si se
// vuelve a mirar, pista 2), así que nunca marcan «dominado» (regla 9); los fallos van a «Vacía tus fallos».
import { useEffect, useState } from 'react';
import { examCorrect, exercisesOf, exerciseView, unitText, type ClientEvent } from '@memora/experiences';
import { api, ApiError, type Course, type ExamPayload } from './api';
import { deviceId, nextSeq } from './device';
import { hue, UnitFicha } from './Feed';
import { enqueue, isNetworkError } from './offline';

export function Guided({ course, onExit, onExam, onFailures }: { course: Course; onExit: () => void; onExam: () => void; onFailures: () => void }) {
  const [data, setData] = useState<ExamPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState<'learn' | 'ask' | 'end'>('learn');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [peek, setPeek] = useState<Record<string, boolean>>({});
  const [askedAt, setAskedAt] = useState(Date.now());

  useEffect(() => {
    setData(null); setIdx(0); setStep('learn'); setPicks({}); setPeek({});
    api.exam(course.id, true).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : 'No se ha podido preparar el modelo de examen.'));
  }, [course.id, round]);
  useEffect(() => { document.querySelector('.guided .slide')?.scrollTo({ top: 0 }); }, [idx, step]);

  const shell = (body: React.ReactNode, tone = 30, pct = 0) => (
    <div className="feed guided" role="application" aria-label="Modelo de examen guiado">
      <header className="feed-top">
        <button type="button" className="feed-x" aria-label="Salir" onClick={onExit}>✕</button>
        <div className="feed-bar" aria-label={`Progreso ${pct} %`}><i style={{ width: `${pct}%` }} /></div>
        {data && data.questions.length > 0 && step !== 'end' && <span className="feed-xp">{idx + 1}/{data.questions.length}</span>}
      </header>
      <main className="feed-stage"><div className="slide" style={{ '--tone': tone } as React.CSSProperties}>{body}</div></main>
    </div>
  );

  if (error) return shell(<><p className="tag ko">MODELO DE EXAMEN</p><p className="teach-note">{error}</p><button type="button" className="go wide" onClick={onExit}>Volver</button></>);
  if (!data) return shell(<p className="tag" role="status">Preparando tu modelo de examen…</p>);
  const qs = data.questions;
  if (!qs.length) return shell(<><p className="tag">MODELO DE EXAMEN</p><h3 className="ask">Este curso aún no tiene preguntas de examen</h3><button type="button" className="go wide" onClick={onExit}>Volver</button></>);

  const results = qs.map((q) => examCorrect(q, data.units, picks[q.id] ?? null));
  if (step === 'end') {
    const right = results.filter(Boolean).length;
    const fails = qs.length - right;
    return shell(
      <div className="guided-end">
        <p className="tag">MODELO GUIADO TERMINADO</p>
        <div className="end-xp">{right}/{qs.length}</div>
        <p className="end-next">{fails === 0 ? 'Todo bien a la primera después de aprenderlo. Ahora, a ver si lo recuerdas sin la ficha delante.' : `Has aprendido ${qs.length} temas y ${fails === 1 ? 'te ha costado 1' : `te han costado ${fails}`}. Vuelven en tus repasos para que no se olviden.`}</p>
        <button type="button" className="go wide" onClick={onExam}>📝 Ahora el simulacro, sin ayudas</button>
        {fails > 0 && <button type="button" className="option" onClick={onFailures}>{fails === 1 ? 'Repasa tu fallo ahora' : `Repasa tus ${fails} fallos ahora`}</button>}
        <button type="button" className="option ghost" onClick={() => setRound((r) => r + 1)}>Otro modelo guiado</button>
        <button type="button" className="option ghost" onClick={onExit}>Volver a Inicio</button>
      </div>, 140, 100);
  }

  const q = qs[idx]!;
  const unit = data.units[q.unitKey]!;
  const ex = exercisesOf(unit)[q.exercise]!;
  const picked = picks[q.id];
  const pct = Math.round(((idx + (step === 'ask' ? 0.5 : 0) + (picked !== undefined ? 0.5 : 0)) / qs.length) * 100);

  if (step === 'learn') {
    return shell(<>
      <p className="tag">📖 PRIMERO APRENDE · TEMA {idx + 1} DE {qs.length}</p>
      <UnitFicha unit={unit} courseId={course.id} />
      <button type="button" className="go wide" onClick={() => { setStep('ask'); setAskedAt(Date.now()); }}>{peek[q.id] ? 'Volver a la pregunta →' : 'Ya lo tengo: a la pregunta →'}</button>
    </>, hue(unit.key), pct);
  }

  async function answer(option: string) {
    if (picked !== undefined) return;
    setPicks((p) => ({ ...p, [q.id]: option }));
    const event: ClientEvent = {
      id: crypto.randomUUID(), kind: 'attempt', at: Date.now(), deviceId: deviceId(), seq: nextSeq(), courseId: course.id, unitKey: q.unitKey, skillKey: q.skillKey,
      format: 'recognition_choice', correct: examCorrect(q, data!.units, option), hint: peek[q.id] ? 2 : 1, timeMs: Date.now() - askedAt, contextId: `${q.unitKey}#exam-guided`,
    };
    try { await api.events(course.id, [event]); } catch (e) { if (isNetworkError(e)) enqueue(course.id, [event]); }
  }
  const ok = picked !== undefined && results[idx];
  return shell(<>
    <p className={`tag ${picked !== undefined && !ok ? 'ko' : ''}`}>✍️ AHORA RESUÉLVELO · {unitText(unit).toUpperCase()}</p>
    <h3 className="ask guided-q">{exerciseView(ex).prompt}</h3>
    {ex.code && <pre className="learn-code guided-code"><code>{exerciseView(ex).code}</code></pre>}
    <div className="options">
      {q.options.map((o) => (
        <button type="button" key={o} className={`option long ${picked !== undefined && o === ex.answer ? 'is-right' : ''} ${picked === o && o !== ex.answer ? 'is-wrong' : ''}`} disabled={picked !== undefined && o !== picked && o !== ex.answer} onClick={() => void answer(o)}>{o}</button>
      ))}
    </div>
    {picked === undefined
      ? <button type="button" className="more-btn" onClick={() => { setPeek((p) => ({ ...p, [q.id]: true })); setStep('learn'); }}>📖 Ver la ficha otra vez</button>
      : <div className={`guided-why ${ok ? 'ok' : 'ko'}`} role="status">
          <b>{ok ? '✓ ¡Bien!' : `✗ Era «${ex.answer}».`}</b>
          {ex.explanation && <p>{ex.explanation}</p>}
        </div>}
    {picked !== undefined && <button type="button" className="go wide" onClick={() => { if (idx + 1 < qs.length) { setIdx(idx + 1); setStep('learn'); } else setStep('end'); }}>{idx + 1 < qs.length ? 'Siguiente tema →' : 'Ver cómo me ha ido →'}</button>}
  </>, hue(unit.key), pct);
}

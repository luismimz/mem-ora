// Modo Asociaciones: historias absurdas en el centro (D-038). Tarjeta → recordar → completar la historia →
// resultado, en escenas de 5; Arcade sorpresa; rescate inverso; resumen. Teclear solo en repasos.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HintLevel } from '@memora/core';
import {
  choicesFor,
  gradeReview,
  reviewHints,
  storyGap,
  unitMeaning,
  unitText,
  type AssocPlan,
  type AssocStep,
  type Choice,
  type ClientEvent,
  type SessionUnit,
} from '@memora/experiences';
import { api, ApiError, type SessionPayload } from './api';
import { deviceId, nextSeq } from './device';
import { audioEnabled, speak } from './speech';

interface Outcome { correct: boolean; hint: number }
interface Props { payload: SessionPayload; courseId: string; preview?: boolean; onExit: () => void; onReload: () => void }

/** Resalta las palabras en MAYÚSCULAS de una escena. */
function Highlight({ text }: { text: string }) {
  return <>{text.split(/(\p{Lu}{2,}(?:\s+\p{Lu}{2,})*)/u).map((p, i) => (/^\p{Lu}{2,}/u.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</>;
}

/** Tarjeta que se arrastra: ← (o tecla ←) continúa, como en V2. */
function SwipeCard({ children, onNext, label = 'Conecta', className = '' }: { children: ReactNode; onNext?: () => void; label?: string; className?: string }) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!onNext) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'Enter') onNext(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onNext]);
  return (
    <div
      className={`card enter ${className}`}
      style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : undefined }}
      onPointerDown={(e) => { if (!onNext || (e.target as HTMLElement).closest('button')) return; start.current = e.clientX; }}
      onPointerMove={(e) => { if (start.current !== null) setDx(Math.min(0, e.clientX - start.current)); }}
      onPointerUp={() => { if (start.current !== null && dx < -90) onNext?.(); start.current = null; setDx(0); }}
    >
      {children}
      {onNext && <div className="foot"><button type="button" className="link" onClick={onNext}>{label} · arrastra ← o pulsa ←</button></div>}
    </div>
  );
}

function Art({ unit, small = false, chain = true }: { unit: SessionUnit; small?: boolean; chain?: boolean }) {
  const a = unit.association;
  return (
    <div className={`art ${small ? 'small' : ''}`}>
      <span className="emoji" aria-hidden="true">{a?.emoji ?? '✨'}</span>
      {chain && a?.cue && <div className="chain">{a.cue}<em>→</em><b>{unitText(unit).toUpperCase()}</b><em>→</em>{unitMeaning(unit).toUpperCase()}</div>}
    </div>
  );
}

export function AssocSession({ payload, courseId, preview = false, onExit, onReload }: Props) {
  const plan = payload.state.plan as unknown as AssocPlan;
  const units = payload.units;
  const [index, setIndex] = useState(payload.state.index);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(payload.state.outcomes);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [warning, setWarning] = useState<string | null>(payload.resumed ? 'Seguimos donde lo dejaste.' : null);
  const queue = useRef<ClientEvent[]>([]);
  const step = plan.steps[index];
  const unit = step?.unitKey ? units[step.unitKey] : undefined;
  const sessionUnits = useMemo(() => [...new Set(plan.steps.map((s) => s.unitKey).filter(Boolean))], [plan]);
  const startedAt = useRef(plan.createdAt);

  const skillOf = (u: SessionUnit, kind: string) => u.skills.find((s) => s.kind === kind);

  function event(u: SessionUnit, skillKey: string, extra: Partial<ClientEvent>): ClientEvent {
    const skill = u.skills.find((s) => s.key === skillKey);
    return { id: crypto.randomUUID(), at: Date.now(), deviceId: deviceId(), seq: nextSeq(), courseId, unitKey: u.key, skillKey, kind: 'attempt', ...(skill?.associationId ? { associationId: skill.associationId } : {}), ...extra };
  }
  const expose = (u: SessionUnit) => { for (const s of u.skills) queue.current.push(event(u, s.key, { kind: 'exposure' })); };
  const attempt = (u: SessionUnit, correct: boolean, contextId: string, timeMs: number, format: ClientEvent['format'] = 'recognition_choice', hint = 0) => {
    const recall = skillOf(u, 'recall');
    if (recall) queue.current.push(event(u, recall.key, { format, correct, hint: hint as HintLevel, timeMs, contextId }));
  };

  async function advance(outcome?: Outcome) {
    const nextOutcomes = outcome && step ? { ...outcomes, [step.id]: outcome } : outcomes;
    const nextIndex = index + 1;
    setOutcomes(nextOutcomes);
    setIndex(nextIndex);
    if (preview) { queue.current = []; return; }
    const batch = queue.current.splice(0);
    try {
      if (batch.length) await api.events(courseId, batch);
      await api.position(courseId, { sessionId: plan.sessionId, index: nextIndex, outcomes: nextOutcomes, finished: nextIndex >= plan.steps.length - 1, deviceId: deviceId() });
    } catch (e) {
      queue.current.unshift(...batch);
      if (e instanceof ApiError && e.code === 'SESSION_CHANGED') onReload();
      else setWarning('No se ha podido guardar el último paso; se reintentará en el siguiente.');
    }
  }

  function scored(correct: boolean) {
    setCombo((c) => (correct ? c + 1 : 0));
    if (correct) setXp((x) => x + 10 + Math.min(combo, 5) * 2);
  }

  if (!plan.steps.length) return <Empty courseId={courseId} onExit={onExit} />;

  const progress = Math.round((index / plan.steps.length) * 100);
  const sceneOf = (s: AssocStep) => (s.scene >= 0 && s.scene < plan.scenes.length ? `ESCENA ${s.scene + 1}/${plan.scenes.length}` : '');

  return (
    <main className="stage">
      <div className="top">
        <button type="button" className="link" onClick={onExit}>← Inicio</button>
        <span className="eyebrow">{preview ? 'VISTA PREVIA' : step ? sceneOf(step) || (step.kind === 'review' ? 'REPASO' : '') : ''}</span>
        <span className="pill">{progress}%</span>
      </div>
      <div className="bar"><i style={{ width: `${progress}%` }} /></div>
      {preview && <p className="banner">Vista previa como alumno: no se guarda ningún progreso.</p>}
      {warning && <p className="banner" role="status">{warning}</p>}

      {step?.kind === 'card' && unit && <Card key={step.id} unit={unit} position={plan.scenes[step.scene]!.indexOf(unit.key) + 1} total={plan.scenes[step.scene]!.length} onNext={() => { expose(unit); void advance(); }} />}

      {step?.kind === 'recall' && unit && (
        <Choose key={step.id} title={`RECUERDA · ${plan.scenes[step.scene]!.indexOf(unit.key) + 1}/${plan.scenes[step.scene]!.length}`} combo={combo}
          art={<Art unit={unit} chain={false} />} question={<>¿Cómo se dice <em>{unitMeaning(unit)}</em>?</>}
          choices={choicesFor(unitText(unit).toUpperCase(), plan.scenes[step.scene]!.map((k) => unitText(units[k]!).toUpperCase()), step.id)}
          reveal={unit} onAnswer={(ok, ms) => { attempt(unit, ok, `${unit.key}#recall`, ms); scored(ok); }} onDone={(ok) => void advance({ correct: ok, hint: 0 })} />
      )}

      {step?.kind === 'story' && unit && <StoryStep key={step.id} unit={unit} scene={plan.scenes[step.scene]!.map((k) => units[k]!)} seed={step.id} combo={combo}
        onAnswer={(ok, ms) => { attempt(unit, ok, `${unit.key}#story`, ms); scored(ok); }} onDone={(ok) => void advance({ correct: ok, hint: 0 })} />}

      {step?.kind === 'sceneResult' && <SceneResult scene={plan.scenes[step.scene]!.map((k) => units[k]!)} steps={plan.steps} outcomes={outcomes} sceneIndex={step.scene} xp={xp} onNext={() => void advance()} />}

      {step?.kind === 'arcade' && <Arcade key={step.id} units={step.arcadeUnits!.map((k) => units[k]!).filter(Boolean)} seed={step.id}
        onAnswer={(u, ok, ms) => { attempt(u, ok, `${u.key}#arcade`, ms); scored(ok); }} onDone={() => void advance()} />}

      {step?.kind === 'rescue' && unit && (
        <Choose key={step.id} title={`RESCATE · ${sessionUnits.indexOf(unit.key) + 1}/${sessionUnits.length}`} combo={combo}
          art={<Art unit={unit} chain={false} />} question={<span className="scene-text"><Highlight text={unit.association?.text ?? unitMeaning(unit)} /><br /><small>¿Qué palabra esconde esta escena?</small></span>}
          choices={choicesFor(unitText(unit).toUpperCase(), sessionUnits.map((k) => unitText(units[k]!).toUpperCase()), step.id, 4)}
          reveal={unit} onAnswer={(ok, ms) => { attempt(unit, ok, `${unit.key}#rescue`, ms); scored(ok); }} onDone={(ok) => void advance({ correct: ok, hint: 0 })} />
      )}

      {step?.kind === 'review' && unit && <Review key={step.id} unit={unit} startHint={(step.startHint ?? 0) as HintLevel}
        onAnswer={(ok, hint, ms, format) => { attempt(unit, ok, `${unit.key}#review`, ms, format, hint); scored(ok && hint === 0); }} onDone={(ok, hint) => void advance({ correct: ok, hint })} />}

      {step?.kind === 'summary' && <Summary plan={plan} outcomes={outcomes} units={units} xp={xp} minutes={Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))} preview={preview} courseId={courseId} onExit={onExit} />}
    </main>
  );
}

function Card({ unit, position, total, onNext }: { unit: SessionUnit; position: number; total: number; onNext: () => void }) {
  const a = unit.association;
  const respelling = unit.type === 'term' ? (unit.payload as { pronunciation?: { respelling?: string; ipa?: string } }).pronunciation : undefined;
  useEffect(() => { speak(unitText(unit), unit.language); }, [unit]);
  return (
    <SwipeCard onNext={onNext}>
      {unit.place && <p className="place">{unit.place}</p>}
      <p className="eyebrow">ASOCIACIÓN {position}/{total}</p>
      <div className="word"><strong lang={unit.language}>{unitText(unit).toUpperCase()}</strong><span>{unitMeaning(unit)}</span></div>
      <p className="ipa">{respelling?.ipa ? `${respelling.ipa} · ` : ''}{respelling?.respelling ? `≈ ${respelling.respelling}` : ''}</p>
      <Art unit={unit} />
      {a?.cue ? (
        <div className="sounds"><div><p className="eyebrow" style={{ color: 'var(--muted)' }}>SUENA A</p><div className="bridge">{a.cue}</div></div>
          {audioEnabled() && <button type="button" className="round" aria-label={`Escuchar ${unitText(unit)}`} onClick={() => speak(unitText(unit), unit.language)}>🔊</button>}</div>
      ) : <div className="sounds"><p className="eyebrow" style={{ color: 'var(--muted)' }}>IMAGEN DIRECTA</p>{audioEnabled() && <button type="button" className="round" onClick={() => speak(unitText(unit), unit.language)}>🔊</button>}</div>}
      {a?.text && <p className="scene-text"><Highlight text={a.text} /></p>}
      {a?.sceneTarget && <p className="scene-en" lang={unit.language}>{a.sceneTarget} {audioEnabled() && <button type="button" className="link" aria-label="Escuchar la escena" onClick={() => speak(a.sceneTarget!, unit.language)}>🔊</button>}</p>}
    </SwipeCard>
  );
}

function Choose({ title, combo, art, question, choices, reveal, onAnswer, onDone }: { title: string; combo: number; art: ReactNode; question: ReactNode; choices: Choice[]; reveal: SessionUnit; onAnswer: (ok: boolean, ms: number) => void; onDone: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const t0 = useRef(performance.now());
  const ok = picked !== null && choices[picked]!.correct;
  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const right = choices[i]!.correct;
    onAnswer(right, Math.round(performance.now() - t0.current));
    speak(unitText(reveal), reveal.language);
    if (right) setTimeout(() => onDone(true), 750);
  }
  return (
    <SwipeCard className={picked === null ? '' : ok ? 'ok' : 'ko'} onNext={picked !== null && !ok ? () => onDone(false) : undefined} label="Seguir">
      <div className="row"><p className="eyebrow">{title}</p><span key={combo} className={`combo ${combo > 1 ? 'hot' : ''}`}>COMBO x{Math.max(1, combo)}</span></div>
      <div style={{ marginTop: '.8rem' }}>{art}</div>
      <div className="question">{question}</div>
      <div className="choices">{choices.map((c, i) => <button type="button" key={c.label} className={`choice ${picked !== null && c.correct ? 'right' : ''} ${picked === i && !c.correct ? 'wrong' : ''}`} onClick={() => pick(i)}>{c.label}</button>)}</div>
      {picked !== null && !ok && <div className="feedback ko"><p>Vuelve a la escena:</p><p className="scene-text"><Highlight text={reveal.association?.text ?? ''} /></p><p>{reveal.association?.cue ? `${reveal.association.cue} → ` : ''}{unitText(reveal).toUpperCase()} · {unitMeaning(reveal)}</p><p style={{ color: 'var(--muted)' }}>Volverá en tu repaso.</p></div>}
      {ok && <div className="feedback ok">¡CLAC! +{10} XP</div>}
    </SwipeCard>
  );
}

function StoryStep({ unit, scene, seed, combo, onAnswer, onDone }: { unit: SessionUnit; scene: SessionUnit[]; seed: string; combo: number; onAnswer: (ok: boolean, ms: number) => void; onDone: (ok: boolean) => void }) {
  const gap = storyGap(unit);
  const parts = gap.text.split('______');
  const choices = choicesFor(gap.answer, scene.map((u) => storyGap(u).answer), seed);
  return (
    <Choose title="COMPLETA LA HISTORIA" combo={combo} art={<Art unit={unit} small chain={false} />} reveal={unit}
      question={<div className="story">{parts.length === 2 ? <><Highlight text={parts[0]!} /><span className="gap" /><Highlight text={parts[1]!} /></> : <Highlight text={gap.text} />}</div>}
      choices={choices} onAnswer={onAnswer} onDone={onDone} />
  );
}

function SceneResult({ scene, steps, outcomes, sceneIndex, xp, onNext }: { scene: SessionUnit[]; steps: AssocStep[]; outcomes: Record<string, Outcome>; sceneIndex: number; xp: number; onNext: () => void }) {
  const recalls = steps.filter((s) => s.scene === sceneIndex && s.kind === 'recall');
  const right = recalls.filter((s) => outcomes[s.id]?.correct).length;
  return (
    <SwipeCard onNext={onNext} label="Seguir">
      <div className="art"><span className="emoji">{scene.map((u) => u.association?.emoji?.slice(0, 2) ?? '✨').join(' ')}</span></div>
      <div className="reward">
        <p className="eyebrow">{right}/{recalls.length} RECORDADAS</p>
        <div className="big">{right === recalls.length ? '¡Conexión hecha!' : 'Vamos bien.'}</div>
        <div className="xp">+{xp} XP</div>
        <p>{right === recalls.length ? 'Volverán en 1 hora para fijarlas.' : 'Las que fallaron vuelven pronto en tu repaso, sin repetir ahora toda la ronda.'}</p>
      </div>
    </SwipeCard>
  );
}

function Arcade({ units, seed, onAnswer, onDone }: { units: SessionUnit[]; seed: string; onAnswer: (u: SessionUnit, ok: boolean, ms: number) => void; onDone: () => void }) {
  const [i, setI] = useState(-1);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(5);
  const [score, setScore] = useState(0);
  const t0 = useRef(performance.now());
  const u = units[i];
  const inverse = i % 2 === 1;
  const choices = useMemo(() => (u ? choicesFor(inverse ? unitMeaning(u).toUpperCase() : unitText(u).toUpperCase(), units.map((x) => (inverse ? unitMeaning(x).toUpperCase() : unitText(x).toUpperCase())), `${seed}-${i}`, 3) : []), [u, units, seed, i, inverse]);
  useEffect(() => {
    if (i < 0 || picked !== null) return;
    t0.current = performance.now();
    setLeft(5);
    const tick = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100);
    return () => clearInterval(tick);
  }, [i, picked]);
  useEffect(() => { if (i >= 0 && picked === null && left <= 0) answer(-1); });
  function answer(k: number) {
    if (!u || picked !== null) return;
    const ok = k >= 0 && choices[k]!.correct;
    setPicked(k);
    onAnswer(u, ok, Math.round(performance.now() - t0.current));
    if (ok) setScore((s) => s + 100 + Math.round(left * 20));
    setTimeout(() => { setPicked(null); setI((n) => n + 1); }, ok ? 500 : 1300);
  }
  if (i < 0) return <SwipeCard onNext={() => setI(0)} label="¡Jugar!"><div className="reward"><p className="eyebrow">ARCADE SORPRESA</p><div className="big">¡Ráfaga!</div><p>{units.length} recuerdos en 5 segundos cada uno. Escena → palabra y palabra → significado.</p><div className="art small"><span className="emoji">⚡🎯</span></div></div></SwipeCard>;
  if (!u) return <SwipeCard onNext={onDone} label="Seguir"><div className="reward"><p className="eyebrow">FIN DE LA RÁFAGA</p><div className="xp">{score}</div><p>puntos · lo que falló vuelve a tu repaso</p></div></SwipeCard>;
  return (
    <div className={`card enter ${picked === null ? '' : picked >= 0 && choices[picked]!.correct ? 'ok' : 'ko'}`}>
      <div className="row"><p className="eyebrow">ARCADE · {i + 1}/{units.length}</p><span className="combo hot">{score} PTS</span></div>
      <div className="timer"><i style={{ width: `${(left / 5) * 100}%` }} /></div>
      <Art unit={u} small chain={false} />
      <div className="question">{inverse ? <>¿Qué significa <em>{unitText(u)}</em>?</> : <>¿Qué palabra esconde esta escena?</>}</div>
      <div className="choices">{choices.map((c, k) => <button type="button" key={c.label} className={`choice ${picked !== null && c.correct ? 'right' : ''} ${picked === k && !c.correct ? 'wrong' : ''}`} onClick={() => answer(k)}>{c.label}</button>)}</div>
    </div>
  );
}

function Review({ unit, startHint, onAnswer, onDone }: { unit: SessionUnit; startHint: HintLevel; onAnswer: (ok: boolean, hint: number, ms: number, format: ClientEvent['format']) => void; onDone: (ok: boolean, hint: number) => void }) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState<HintLevel>(startHint);
  const [result, setResult] = useState<{ ok: boolean; hint: number } | null>(null);
  const t0 = useRef(performance.now());
  const hints = reviewHints(unit);
  function check(revealed = false) {
    const r = gradeReview(unit, text, startHint, hint, revealed);
    setResult({ ok: r.correct, hint: r.hint });
    onAnswer(r.correct, r.hint, Math.round(performance.now() - t0.current), r.format);
    speak(unitText(unit), unit.language);
  }
  return (
    <SwipeCard className={result ? (result.ok ? 'ok' : 'ko') : ''} onNext={result ? () => onDone(result.ok, result.hint) : undefined} label="Seguir">
      <p className="eyebrow">REPASO</p>
      <div className="question">¿Cómo se dice <em>{unitMeaning(unit)}</em>?</div>
      <form onSubmit={(e) => { e.preventDefault(); if (!result) check(); }}>
        <input className="answer-input" lang={unit.language} autoFocus autoCapitalize="off" autoComplete="off" spellCheck={false} value={text} disabled={Boolean(result)} onChange={(e) => setText(e.target.value)} aria-label="Tu respuesta" />
        {!result && <div className="actions"><button type="submit" className="go" disabled={!text.trim()}>Comprobar</button><button type="button" disabled={hint >= 4} onClick={() => setHint((h) => Math.min(4, h + 1) as HintLevel)}>💡 Pista</button><button type="button" onClick={() => check(true)}>Ver</button></div>}
      </form>
      {hints.slice(0, hint).map((h, i) => <p key={i} className="hintbox">{i + 1}. <Highlight text={h} /></p>)}
      {result && <div className={`feedback ${result.ok ? 'ok' : 'ko'}`}>{result.ok ? (result.hint ? '¡Bien, con ayuda!' : '¡Sin ayuda! Se espacia más.') : <>Era <b>{unitText(unit).toUpperCase()}</b>.<p className="scene-text"><Highlight text={unit.association?.text ?? ''} /></p></>}</div>}
    </SwipeCard>
  );
}

function Summary({ plan, outcomes, units, xp, minutes, preview, courseId, onExit }: { plan: AssocPlan; outcomes: Record<string, Outcome>; units: Record<string, SessionUnit>; xp: number; minutes: number; preview: boolean; courseId: string; onExit: () => void }) {
  const fresh = plan.scenes.flat().length;
  const recalls = plan.steps.filter((s) => s.kind === 'recall' || s.kind === 'review');
  const first = recalls.filter((s) => outcomes[s.id]?.correct && !outcomes[s.id]?.hint).length;
  const helped = recalls.filter((s) => outcomes[s.id]?.correct && outcomes[s.id]?.hint).length;
  const [next, setNext] = useState<number | null>(null);
  useEffect(() => {
    if (preview) return;
    api.progress(courseId).then((p) => { const due = p.skills.map((s) => s.dueAt).filter((d): d is number => Boolean(d) && d! > Date.now()); setNext(due.length ? Math.min(...due) : null); }).catch(() => undefined);
  }, [courseId, preview]);
  const when = next ? new Date(next).toLocaleString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : 'según la curva del olvido';
  return (
    <div className="card enter">
      <div className="reward">
        <p className="eyebrow">SESIÓN COMPLETADA</p>
        <div className="big">{fresh ? `¡${fresh} ${fresh === 1 ? 'palabra nueva' : 'palabras nuevas'}!` : '¡Repaso hecho!'}</div>
        <div className="xp">+{xp} XP</div>
        <div className="stats"><div><b>{first}</b>a la primera</div><div><b>{helped}</b>con ayuda</div><div><b>{minutes}</b>min</div></div>
        <p>Próximo repaso: {when}.</p>
        {Object.keys(units).length > 0 && <p style={{ fontSize: '.85rem' }}>La gramática con estas palabras llegará en el modo Gramática.</p>}
      </div>
      <button type="button" className="primary" onClick={onExit}>Terminar</button>
    </div>
  );
}

/** Nada pendiente: explica cuándo vuelve el primer repaso y si ya no quedan palabras nuevas en el curso. */
function Empty({ courseId, onExit }: { courseId: string; onExit: () => void }) {
  const [info, setInfo] = useState<{ next: number | null; left: number } | null>(null);
  useEffect(() => {
    api.progress(courseId).then((p) => {
      const due = p.skills.map((s) => s.dueAt).filter((d): d is number => Boolean(d));
      setInfo({ next: due.length ? Math.min(...due) : null, left: p.skills.filter((s) => s.status === 'new').length });
    }).catch(() => setInfo({ next: null, left: 0 }));
  }, [courseId]);
  const when = info?.next ? new Date(info.next).toLocaleString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <main className="stage"><div className="card enter"><div className="reward">
      <p className="eyebrow">TODO AL DÍA</p>
      <div className="big">Ahora no hay nada pendiente.</div>
      {info && info.left === 0 && <p>Ya has empezado todas las palabras de este curso. Lo que toca ahora es repasarlas.</p>}
      <p>{when ? <>Tu próximo repaso vuelve el <b>{when}</b>, según la curva del olvido.</> : 'Tus repasos volverán según la curva del olvido (1 h, 3 h, 24 h…).'}</p>
    </div><button type="button" className="primary next" onClick={onExit}>Volver al inicio</button></div></main>
  );
}

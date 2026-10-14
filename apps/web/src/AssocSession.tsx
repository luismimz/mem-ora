// Modo Asociaciones: historias absurdas en el centro (D-038). Tarjeta → recordar → completar la historia →
// resultado, en escenas de 5; Arcade sorpresa; rescate inverso; resumen. Teclear solo en repasos.
import React, { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HintLevel } from '@memora/core';
import type { ConceptExercise, ConceptPayload } from '@memora/content';
import {
  choicesFor,
  gradeReview,
  reviewHints,
  storyGap,
  unitMeaning,
  challengeChoices,
  exercisesOf,
  gradeChallenge,
  shuffledSteps,
  unitText,
  type AssocPlan,
  type AssocOutcome,
  type AssocStep,
  type Choice,
  type ClientEvent,
  type SessionUnit,
} from '@memora/experiences';
import { api, ApiError, type Mission, type MissionRef, type SessionPayload } from './api';
import { deviceId, nextSeq } from './device';
import { audioEnabled, setAudioEnabled, speak } from './speech';
import { enqueue, isNetworkError, saveSessionProgress } from './offline';
import { milestones, type Milestones } from './milestones';

interface Outcome { correct: boolean; hint: number }
interface Props { payload: SessionPayload; courseId: string; preview?: boolean; staff?: boolean; onExit: () => void; onReload: () => void; /** Abre una sesión de esa misión (al deslizar el resumen). */ onMission?: (key: string) => void; /** Sesión descargada: se juega sin red. */ offline?: boolean }

/** Nombres largos (GENERALIZACIÓN/ESPECIALIZACIÓN, DBMS_OUTPUT.PUT_LINE) se parten tras «/», «_» o «.», no a mitad. */
function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[/_.])/);
  return <>{parts.map((part, i) => <Fragment key={i}>{part}{i < parts.length - 1 && <wbr />}</Fragment>)}</>;
}

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
      {chain && <div className="chain">{a?.cue && <>{a.cue}<em>→</em></>}<b>{unitText(unit).toUpperCase()}</b><em>→</em>{unit.type === 'concept' ? unitMeaning(unit) : unitMeaning(unit).toUpperCase()}</div>}
    </div>
  );
}

export function AssocSession({ payload, courseId, preview: previewProp = false, staff = false, onExit, onReload, onMission, offline = false }: Props) {
  // La vista previa trae si el curso tiene audio (en sesión normal lo fija la portada).
  if (payload.audio !== undefined) setAudioEnabled(payload.audio);
  // Modo revisión (solo equipo): saltar a cualquier paso; desde el primer salto no se guarda progreso.
  const [reviewing, setReviewing] = useState(false);
  const preview = previewProp || reviewing;
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
    // Sin conexión: las respuestas van a la cola del móvil y el punto de la sesión se guarda en el dispositivo.
    if (offline) {
      enqueue(courseId, batch);
      saveSessionProgress(plan.sessionId, { index: nextIndex, outcomes: nextOutcomes, finished: nextIndex >= plan.steps.length - 1 });
      return;
    }
    try {
      if (batch.length) await api.events(courseId, batch);
      await api.position(courseId, { sessionId: plan.sessionId, index: nextIndex, outcomes: nextOutcomes, finished: nextIndex >= plan.steps.length - 1, deviceId: deviceId() });
    } catch (e) {
      if (isNetworkError(e)) {
        // Se cayó la red a mitad: nada se pierde, se guarda en el móvil y se enviará al volver la cobertura.
        enqueue(courseId, batch);
        setWarning('Sin conexión: tus respuestas se guardan en el móvil y se enviarán al volver la red.');
        return;
      }
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
        <button type="button" className="link back" onClick={onExit} title="Tu avance se guarda en cada paso">← {previewProp ? 'Volver' : 'Inicio'}</button>
        <span className="session-where">
          {payload.state.mission && <b>Misión {payload.state.mission.index} · {payload.state.mission.title.replace(/^Misión \d+ · /, '')}</b>}
          <span className="eyebrow">{preview ? 'VISTA PREVIA' : step ? sceneOf(step) || (step.kind === 'review' ? 'REPASO' : step.kind === 'challenge' ? 'RETO' : step.kind === 'summary' ? 'RESUMEN' : '') : ''}</span>
        </span>
        <span className="pill">{progress}%</span>
      </div>
      <div className="bar"><i style={{ width: `${progress}%` }} /></div>
      {staff && (
        <div className="banner review">
          <label>Revisar paso <select value={index} onChange={(e) => { setReviewing(true); setIndex(Number(e.target.value)); }}>
            {plan.steps.map((s, i) => <option key={s.id} value={i}>{i + 1}. {stepLabel(s, units)}</option>)}
          </select></label>
          {preview && <small>No guarda progreso</small>}
        </div>
      )}
      {preview && !staff && <p className="banner">Vista previa como alumno: no se guarda ningún progreso.</p>}
      {warning && <p className="banner" role="status">{warning}</p>}

      {step?.kind === 'card' && unit && <Card key={step.id} unit={unit} position={plan.scenes[step.scene]!.indexOf(unit.key) + 1} total={plan.scenes[step.scene]!.length} onNext={() => { expose(unit); void advance(); }} />}

      {step?.kind === 'recall' && unit && (
        <Choose key={step.id} title={`RECUERDA · ${plan.scenes[step.scene]!.indexOf(unit.key) + 1}/${plan.scenes[step.scene]!.length}`} combo={combo}
          art={<Art unit={unit} chain={false} />} question={<>{askName(unit)} <em>{unitMeaning(unit)}</em>?</>}
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
          art={<Art unit={unit} chain={false} />} question={<span className="scene-text"><Highlight text={masked(unit.association?.text ?? unitMeaning(unit), unitText(unit))} /><br /><small>{hiddenName(unit)}</small></span>}
          choices={choicesFor(unitText(unit).toUpperCase(), sessionUnits.map((k) => unitText(units[k]!).toUpperCase()), step.id, 4)}
          reveal={unit} quiet onAnswer={(ok, ms) => { attempt(unit, ok, `${unit.key}#rescue`, ms); scored(ok); }} onDone={(ok) => void advance({ correct: ok, hint: 0 })} />
      )}

      {step?.kind === 'review' && unit && <Review key={step.id} unit={unit} startHint={(step.startHint ?? 0) as HintLevel}
        onAnswer={(ok, hint, ms, format) => { attempt(unit, ok, `${unit.key}#review`, ms, format, hint); scored(ok && hint === 0); }} onDone={(ok, hint) => void advance({ correct: ok, hint })} />}

      {step?.kind === 'challenge' && unit && exercisesOf(unit)[step.exercise ?? 0] && (
        <Challenge key={step.id} unit={unit} exercise={exercisesOf(unit)[step.exercise ?? 0]!} typed={Boolean(step.typed)} seed={step.id} combo={combo}
          onAnswer={(outcome, ms) => { queue.current.push(event(unit, step.skillKey!, { format: outcome.format, correct: outcome.correct, hint: outcome.hint, timeMs: ms, contextId: `${unit.key}#challenge-${step.exercise ?? 0}` })); scored(outcome.correct); }}
          onDone={(ok) => void advance({ correct: ok, hint: 0 })} />
      )}

      {step?.kind === 'summary' && <Summary plan={plan} outcomes={outcomes} units={units} xp={xp} minutes={Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))} preview={preview} courseId={courseId} mission={payload.state.mission} onMission={onMission} onExit={onExit} />}
    </main>
  );
}

/** Oculta la respuesta si la escena o la analogía la nombra («Un atributo static es…» → «Un atributo ___ es…»). */
const masked = (text: string, answer: string) => (answer ? text.replace(new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '___') : text);

/** Las preguntas dicen «palabra» en idiomas y «concepto» en el resto de materias. */
const askName = (u: SessionUnit) => (u.type === 'concept' ? '¿Qué concepto es' : '¿Cómo se dice');
const hiddenName = (u: SessionUnit) => (u.type === 'concept' ? '¿Qué concepto esconde?' : '¿Qué palabra esconde esta escena?');

/** Concepto: definición, un ejemplo (código o caso) y con qué no confundirlo. */

function ConceptDetails({ payload, language }: { payload: ConceptPayload; language: string }) {
  const ex = payload.examples[0];
  return (
    <div className="concept">
      <p>{payload.definition}</p>
      {ex && <pre lang={language}><code>{ex.text}</code></pre>}
      {ex?.explanation && <p className="muted">{ex.explanation}</p>}
      {payload.contrast && <p className="contrast">{payload.contrast}</p>}
    </div>
  );
}

/**
 * Trazado de código (D-044): la tarjeta se recorre en tres toques. 1) la definición en una frase; 2) la historia absurda;
 * 3) el código corto con cada línea comentada con un elemento de esa historia.
 */
function TraceCard({ unit, position, total, onNext }: { unit: SessionUnit; position: number; total: number; onNext: () => void }) {
  const [part, setPart] = useState(0);
  const a = unit.association!;
  const p = unit.payload as ConceptPayload;
  const titles = ['1 · LA DEFINICIÓN', '2 · LA HISTORIA', '3 · EL CÓDIGO'];
  return (
    <SwipeCard className="trace" onNext={part === 2 ? onNext : undefined}>
      {unit.place && <p className="place">{unit.place}</p>}
      <p className="eyebrow">ASOCIACIÓN {position}/{total} · {titles[part]}</p>
      <div className={`word ${unit.type === 'concept' ? 'concept' : ''} ${unitText(unit).length > 20 ? 'xlong' : unitText(unit).length > 11 ? 'long' : ''}`}><strong lang={unit.language} style={{ '--n': Math.max(...unitText(unit).split(/[\s/_.]+/).map((w) => w.length)) } as React.CSSProperties}><Breakable text={unitText(unit).toUpperCase()} /></strong><span>{unitMeaning(unit)}</span></div>
      <div className="steps-dots" aria-hidden="true">{titles.map((t, i) => <i key={t} className={i <= part ? 'on' : ''} />)}</div>
      {part === 0 && <p className="trace-definition">{p.definition}</p>}
      {part === 1 && <><Art unit={unit} small /><p className="scene-text"><Highlight text={a.text} /></p></>}
      {part === 2 && (
        <>
          <pre className="trace-code" lang={unit.language}><code>{(a.trace ?? []).map((l, i) => <span key={i} className="trace-line"><span>{l.code}</span><span className="trace-note">{'// '}<Highlight text={l.note} /></span></span>)}</code></pre>
          {p.contrast && <p className="contrast">{p.contrast}</p>}
        </>
      )}
      {part < 2 && <button type="button" className="primary" onClick={() => setPart((x) => x + 1)}>{part === 0 ? 'Ver la historia →' : 'Ver el código →'}</button>}
    </SwipeCard>
  );
}

function Card({ unit, position, total, onNext }: { unit: SessionUnit; position: number; total: number; onNext: () => void }) {
  const a = unit.association;
  if (a?.technique === 'code_trace' && unit.type === 'concept') return <TraceCard unit={unit} position={position} total={total} onNext={onNext} />;
  const respelling = unit.type === 'term' ? (unit.payload as { pronunciation?: { respelling?: string; ipa?: string } }).pronunciation : undefined;
  useEffect(() => { speak(unitText(unit), unit.language); }, [unit]);
  return (
    <SwipeCard onNext={onNext}>
      {unit.place && <p className="place">{unit.place}</p>}
      <p className="eyebrow">ASOCIACIÓN {position}/{total}</p>
      <div className={`word ${unit.type === 'concept' ? 'concept' : ''} ${unitText(unit).length > 20 ? 'xlong' : unitText(unit).length > 11 ? 'long' : ''}`}><strong lang={unit.language} style={{ '--n': Math.max(...unitText(unit).split(/[\s/_.]+/).map((w) => w.length)) } as React.CSSProperties}><Breakable text={unitText(unit).toUpperCase()} /></strong><span>{unitMeaning(unit)}</span></div>
      <p className="ipa">{respelling?.ipa ? `${respelling.ipa} · ` : ''}{respelling?.respelling ? `≈ ${respelling.respelling}` : ''}</p>
      <Art unit={unit} />
      {a?.cue ? (
        <div className="sounds"><div><p className="eyebrow" style={{ color: 'var(--muted)' }}>{a.technique === 'analogy' ? 'SE PARECE A' : 'SUENA A'}</p><div className="bridge">{a.cue}</div></div>
          {audioEnabled() && <button type="button" className="round" aria-label={`Escuchar ${unitText(unit)}`} onClick={() => speak(unitText(unit), unit.language)}>🔊</button>}</div>
      ) : <div className="sounds"><p className="eyebrow" style={{ color: 'var(--muted)' }}>{unit.type === 'concept' ? 'IMAGEN' : 'IMAGEN DIRECTA'}</p>{audioEnabled() && <button type="button" className="round" aria-label={`Escuchar ${unitText(unit)}`} onClick={() => speak(unitText(unit), unit.language)}>🔊</button>}</div>}
      {a?.text && <p className="scene-text"><Highlight text={a.text} /></p>}
      {a?.sceneTarget && <p className="scene-en" lang={unit.language}>{a.sceneTarget} {audioEnabled() && <button type="button" className="link" aria-label="Escuchar la escena" onClick={() => speak(a.sceneTarget!, unit.language)}>🔊</button>}</p>}
      {unit.type === 'concept' && <ConceptDetails payload={unit.payload as ConceptPayload} language={unit.language} />}
    </SwipeCard>
  );
}

function Choose({ title, combo, art, question, choices, reveal, quiet = false, onAnswer, onDone }: { title: string; quiet?: boolean; combo: number; art: ReactNode; question: ReactNode; choices: Choice[]; reveal: SessionUnit; onAnswer: (ok: boolean, ms: number) => void; onDone: (ok: boolean) => void }) {
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
      {ok && !quiet && <div className="feedback ok">¡CLAC! +{10} XP</div>}
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
      <div className="question">{inverse ? <>¿Qué significa <em>{unitText(u)}</em>?</> : <>{hiddenName(u)}</>}</div>
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
      <div className="question">{askName(unit)} <em>{unitMeaning(unit)}</em>?</div>
      <form onSubmit={(e) => { e.preventDefault(); if (!result) check(); }}>
        <input className="answer-input" lang={unit.language} autoFocus autoCapitalize="off" autoComplete="off" spellCheck={false} value={text} disabled={Boolean(result)} onChange={(e) => setText(e.target.value)} aria-label="Tu respuesta" />
        {!result && <div className="actions"><button type="submit" className="go" disabled={!text.trim()}>Comprobar</button><button type="button" disabled={hint >= 4} onClick={() => setHint((h) => Math.min(4, h + 1) as HintLevel)}>💡 Pista</button><button type="button" onClick={() => check(true)}>Ver</button></div>}
      </form>
      {hints.slice(0, hint).map((h, i) => <p key={i} className="hintbox">{i + 1}. <Highlight text={h} /></p>)}
      {result && <div className={`feedback ${result.ok ? 'ok' : 'ko'}`}>{result.ok ? (result.hint ? '¡Bien, con ayuda!' : '¡Sin ayuda! Se espacia más.') : <>Era <b>{unitText(unit).toUpperCase()}</b>.<p className="scene-text"><Highlight text={unit.association?.text ?? ''} /></p></>}</div>}
    </SwipeCard>
  );
}

/** «palabras nuevas» en idiomas; «conceptos nuevos» en el resto. */
const noun = (u: SessionUnit | undefined, n: number) => (u?.type === 'concept' ? (n === 1 ? 'concepto nuevo' : 'conceptos nuevos') : n === 1 ? 'palabra nueva' : 'palabras nuevas');

const CHALLENGE_TITLES: Record<ConceptExercise['kind'], string> = {
  predict_output: 'RETO · PREDICE LA SALIDA',
  fill_gap: 'RETO · COMPLETA EL CÓDIGO',
  find_bug: 'RETO · ENCUENTRA EL ERROR',
  apply_case: 'RETO · APLÍCALO',
  order_steps: 'RETO · ORDENA LOS PASOS',
};

/**
 * Reto de aplicación de un concepto. El primer día, con opciones (u ordenando); en el repaso, escribiendo la respuesta
 * sin opciones. Ordenar pasos se hace tocándolos en orden.
 */
function Challenge({ unit, exercise, typed, seed, combo, onAnswer, onDone }: { unit: SessionUnit; exercise: ConceptExercise; typed: boolean; seed: string; combo: number; onAnswer: (o: AssocOutcome, ms: number) => void; onDone: (ok: boolean) => void }) {
  const t0 = useRef(performance.now());
  const [result, setResult] = useState<AssocOutcome | null>(null);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const isOrder = exercise.kind === 'order_steps';
  const pool = useMemo(() => (isOrder ? shuffledSteps(exercise, seed) : []), [exercise, seed, isOrder]);
  const choices = useMemo(() => challengeChoices(exercise, seed), [exercise, seed]);

  function finish(answer: string | string[], revealed = false) {
    const o = gradeChallenge(exercise, answer, typed, revealed);
    setResult(o);
    onAnswer(o, Math.round(performance.now() - t0.current));
  }
  function tapStep(s: string) {
    if (result || order.includes(s)) return;
    const next = [...order, s];
    setOrder(next);
    if (next.length === pool.length) finish(next);
  }

  return (
    <SwipeCard className="challenge" onNext={result ? () => onDone(result.correct) : undefined}>
      <div className="row"><p className="eyebrow">{CHALLENGE_TITLES[exercise.kind]}</p><span key={combo} className={`combo ${combo > 1 ? 'hot' : ''}`}>COMBO x{Math.max(1, combo)}</span></div>
      <p className="place">{unitText(unit)} · {unitMeaning(unit)}</p>
      <div className="question">{exercise.prompt}</div>
      {exercise.code && <div className="concept"><pre lang={unit.language}><code>{exercise.code}</code></pre></div>}
      {isOrder ? (
        <>
          <ol className="order-picked">{order.map((s) => <li key={s}>{s}</li>)}</ol>
          <div className="choices order-pool">{pool.map((s) => <button type="button" key={s} className="choice" disabled={order.includes(s) || Boolean(result)} onClick={() => tapStep(s)}>{s}</button>)}</div>
          {!result && order.length > 0 && <button type="button" className="link" onClick={() => setOrder([])}>Empezar de nuevo</button>}
        </>
      ) : typed ? (
        <form onSubmit={(e) => { e.preventDefault(); if (!result && text.trim()) finish(text); }}>
          <input className="answer-input" lang={unit.language} autoFocus autoCapitalize="off" autoComplete="off" spellCheck={false} value={text} disabled={Boolean(result)} onChange={(e) => setText(e.target.value)} aria-label="Tu respuesta" />
          {!result && <div className="actions"><button type="submit" className="go" disabled={!text.trim()}>Comprobar</button><button type="button" onClick={() => finish(text, true)}>Ver</button></div>}
        </form>
      ) : (
        <div className="choices">{choices.map((c) => <button type="button" key={c.label} className={`choice ${result && c.correct ? 'right' : ''} ${picked === c.label && !c.correct ? 'wrong' : ''}`} disabled={Boolean(result)} onClick={() => { setPicked(c.label); finish(c.label); }}>{c.label}</button>)}</div>
      )}
      {result && (
        <div className={`feedback ${result.correct ? 'ok' : 'ko'}`}>
          <p>{result.correct ? '¡Correcto! +10 XP' : isOrder ? 'El orden era:' : <>Era <b>{exercise.answer}</b>.</>}</p>
          {!result.correct && isOrder && <ol>{exercise.steps!.map((s) => <li key={s}>{s}</li>)}</ol>}
          {exercise.explanation && <p>{exercise.explanation}</p>}
          <button type="button" className="primary" onClick={() => onDone(result.correct)}>Seguir →</button>
        </div>
      )}
    </SwipeCard>
  );
}

function Summary({ plan, outcomes, units, xp, minutes, preview, courseId, mission, onMission, onExit }: { plan: AssocPlan; outcomes: Record<string, Outcome>; units: Record<string, SessionUnit>; xp: number; minutes: number; preview: boolean; courseId: string; mission?: MissionRef; onMission?: (key: string) => void; onExit: () => void }) {
  const fresh = plan.scenes.flat().length;
  const recalls = plan.steps.filter((s) => s.kind === 'recall' || s.kind === 'review');
  const first = recalls.filter((s) => outcomes[s.id]?.correct && !outcomes[s.id]?.hint).length;
  const helped = recalls.filter((s) => outcomes[s.id]?.correct && outcomes[s.id]?.hint).length;
  const [next, setNext] = useState<number | null>(null);
  const [ms, setMs] = useState<Milestones | null>(null);
  const [here, setHere] = useState<Mission | null>(null);
  useEffect(() => {
    // Solo lee el avance (no guarda nada), así que también vale al revisar pasos.
    if (!mission) return;
    api.missions(courseId).then((r) => setHere(r.missions.find((m) => m.key === mission.key) ?? null)).catch(() => undefined);
  }, [courseId, mission]);
  // Al deslizar: si a la misión le quedan conceptos, se sigue en ella; si está completa, se pasa a la siguiente.
  const left = here ? here.total - here.worked : 0;
  const target = !mission || !onMission || !here ? null : left > 0 ? { key: mission.key, label: `Desliza para seguir · quedan ${left}` } : mission.next ? { key: mission.next.key, label: `Desliza · Misión ${mission.index + 1}` } : null;
  useEffect(() => {
    if (preview) return;
    api.progress(courseId).then((p) => { setMs(milestones(p)); const due = p.skills.map((s) => s.dueAt).filter((d): d is number => Boolean(d) && d! > Date.now()); setNext(due.length ? Math.min(...due) : null); }).catch(() => undefined);
  }, [courseId, preview]);
  const when = next ? new Date(next).toLocaleString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : 'según la curva del olvido';
  const reward = (
    <div className="reward">
      <p className="eyebrow">{mission ? `MISIÓN ${mission.index} · ${here && left === 0 ? 'COMPLETADA' : 'SESIÓN COMPLETADA'}` : 'SESIÓN COMPLETADA'}</p>
      <div className="big">{fresh ? `¡${fresh} ${noun(Object.values(units)[0], fresh)}!` : '¡Repaso hecho!'}</div>
      <div className="xp">+{xp} XP</div>
      <div className="stats"><div><b>{first}</b>a la primera</div><div><b>{helped}</b>con ayuda</div><div><b>{minutes}</b>min</div></div>
      {here && <p>{mission!.title.replace(/^Misión \d+ · /, '')}: <b>{here.worked}/{here.total}</b> trabajadas{left === 0 && mission!.next ? <> · siguiente: <b>{mission!.next.title.replace(/^Misión \d+ · /, '')}</b></> : ''}</p>}
      <p>Próximo repaso: {when}.</p>
      {ms && !mission && <p><b>{ms.words}</b> {Object.values(units)[0]?.type === 'concept' ? 'conceptos trabajados' : 'palabras trabajadas'} · {ms.arcadeLeft ? <>Arcade sorpresa en <b>{ms.arcadeLeft}</b></> : 'Arcade sorpresa activo'}</p>}
    </div>
  );
  // Con una misión por delante, se sigue deslizando (sin botones); si no, se termina.
  if (target) return <SwipeCard className="summary" label={target.label} onNext={() => onMission!(target.key)}>{reward}</SwipeCard>;
  return (
    <div className="card enter">
      {reward}
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

const STEP_NAMES: Record<AssocStep['kind'], string> = { review: 'Repaso', card: 'Asociación', recall: 'Recuerda', story: 'Completa la historia', sceneResult: 'Resultado de la escena', arcade: 'Arcade sorpresa', rescue: 'Rescate', challenge: 'Reto', summary: 'Resumen' };
function stepLabel(s: AssocStep, units: Record<string, SessionUnit>): string {
  const u = s.unitKey ? units[s.unitKey] : undefined;
  return `${STEP_NAMES[s.kind]}${u ? ` · ${unitText(u).toUpperCase()}` : ''}${s.scene >= 0 && s.kind !== 'summary' ? ` (escena ${s.scene + 1})` : ''}`;
}

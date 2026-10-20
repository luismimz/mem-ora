// Modo Flujo (D-068, D-072): aprender deslizando, como en una red social. Pantalla completa, una tarjeta cada vez,
// deslizar hacia arriba para seguir. Asociación → relámpago / ¿verdad o mentira? → pregunta jefe. Se enseña en el
// error y lo fallado vuelve unas tarjetas después. Puntos, racha, combos, vibración y sonido; «una ronda más».
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HintLevel } from '@memora/core';
import type { ConceptPayload } from '@memora/content';
import {
  challengeChoices,
  choicesFor,
  exercisesOf,
  gradeChallenge,
  gradeReview,
  reviewHints,
  unitMeaning,
  unitText,
  type AssocPlan,
  type AssocStep,
  type ClientEvent,
  type SessionUnit,
} from '@memora/experiences';
import { api, ApiError, type Progress, type SessionPayload } from './api';
import { deviceId, nextSeq } from './device';
import { enqueue, isNetworkError, saveSessionProgress } from './offline';
import { audioEnabled, speak } from './speech';

interface Outcome { correct: boolean; hint: number }
interface Props { payload: SessionPayload; courseId: string; offline?: boolean; onExit: () => void; onAgain: () => void }

const COMBO_PARTY = [3, 5, 10, 15, 20];

// ─── Pequeñas piezas ──────────────────────────────────────────────────────────────────────────────────────

function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[/_.])/);
  return <>{parts.map((p, i) => <Fragment key={i}>{p}{i < parts.length - 1 && <wbr />}</Fragment>)}</>;
}
function Marked({ text }: { text: string }) {
  return <>{text.split(/(\p{Lu}{2,}(?:\s+\p{Lu}{2,})*)/u).map((p, i) => (/^\p{Lu}{2,}/u.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</>;
}
/** Color de fondo estable por unidad: cada concepto tiene «su» color, como una portada. */
function hue(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
const sfx = (() => {
  let ctx: AudioContext | null = null;
  const on = () => { try { return localStorage.getItem('memora.sfx') !== 'off'; } catch { return true; } };
  return (kind: 'ok' | 'ko' | 'party') => {
    if (!on()) return;
    try {
      ctx ??= new AudioContext();
      const notes = kind === 'ok' ? [660, 880] : kind === 'party' ? [523, 659, 784, 1047] : [220];
      notes.forEach((f, i) => {
        const o = ctx!.createOscillator(); const g = ctx!.createGain();
        o.frequency.value = f; o.type = 'sine';
        const t = ctx!.currentTime + i * 0.07;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + 0.2);
      });
    } catch { /* sin audio: no pasa nada */ }
  };
})();
/** «hoy a las 17:06», «mañana a las 9:00» o «el jueves a las 10:15». */
function whenLabel(at: number) {
  const d = new Date(at); const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  const hour = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (diff <= 0) return `hoy a las ${hour}`;
  if (diff === 1) return `mañana a las ${hour}`;
  return `el ${d.toLocaleDateString('es-ES', { weekday: 'long' })} a las ${hour}`;
}
const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };

/** Tarjeta a pantalla completa: se pasa deslizando hacia arriba, tocando, o con ↑ / espacio. */
function Slide({ children, onNext, tone, className = '' }: { children: ReactNode; onNext?: () => void; tone: number; className?: string }) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  const box = useRef<HTMLElement>(null);
  const atEnd = () => { const el = box.current; return !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 4; };
  useEffect(() => {
    if (!onNext) return;
    const key = (e: KeyboardEvent) => { if (['ArrowUp', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); onNext(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onNext]);
  return (
    <section ref={box} className={`slide ${className}`} style={{ '--tone': tone, transform: dy ? `translateY(${dy}px)` : undefined } as React.CSSProperties}
      onPointerDown={(e) => { if (!onNext || (e.target as HTMLElement).closest('button, input, pre')) return; start.current = atEnd() ? e.clientY : null; }}
      onPointerMove={(e) => { if (start.current !== null) setDy(Math.min(0, e.clientY - start.current)); }}
      onPointerUp={() => { if (start.current !== null && dy < -60) onNext?.(); start.current = null; setDy(0); }}>
      {children}
      {onNext && <button type="button" className="go next" onClick={onNext}>Siguiente ↑</button>}
    </section>
  );
}

/**
 * La ficha completa (D-073): primero la mnemotecnia (para recordar) y después «Qué es» y «Ejemplo» (para entender).
 * Todo lo que se pregunte después está aquí: se evalúa lo que se enseña.
 */
function Concept({ unit, full = true }: { unit: SessionUnit; full?: boolean }) {
  const a = unit.association;
  const p = unit.payload as Partial<ConceptPayload> & { examples?: Array<{ text: string; explanation?: string; translation?: string }> };
  const ex = p.examples?.[0];
  const code = ex && unit.language !== 'es' && /[;{}()=<>]|\w+\.\w+\(/.test(ex.text);
  return (
    <div className="concept-face">
      <div className="face-emoji" aria-hidden="true">{a?.emoji ?? '✨'}</div>
      <h2 lang={unit.language}><Breakable text={unitText(unit).toUpperCase()} /></h2>
      <p className="face-meaning">{unitMeaning(unit)}</p>
      {a?.cue && <p className="face-cue">{a.technique === 'analogy' ? 'como' : 'suena a'} <b>{a.cue}</b></p>}
      {a?.text && <p className="face-story"><Marked text={a.text} /></p>}
      {full && (p.definition || ex) && (
        <div className="face-learn">
          {p.definition && <><p className="learn-label">QUÉ ES</p><p className="learn-text">{p.definition}</p></>}
          {p.contrast && <p className="learn-contrast">{p.contrast}</p>}
          {ex && <><p className="learn-label">EJEMPLO</p>{code ? <pre className="learn-code" lang={unit.language}><code>{ex.text}</code></pre> : <p className="learn-text">{ex.text}</p>}{(ex.explanation || ex.translation) && <p className="learn-note">{ex.explanation ?? ex.translation}</p>}</>}
        </div>
      )}
    </div>
  );
}

// ─── Tarjetas ─────────────────────────────────────────────────────────────────────────────────────────────

function Reel({ unit, onNext }: { unit: SessionUnit; onNext: () => void }) {
  useEffect(() => { if (audioEnabled()) speak(unitText(unit), unit.language); }, [unit]);
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className="reel">
      <p className="tag">NUEVO PARA TU MEMORIA</p>
      <Concept unit={unit} />
    </Slide>
  );
}

/** Aviso al fallar: la asociación completa (se enseña en el error). */
function Teach({ unit, onNext }: { unit: SessionUnit; onNext: () => void }) {
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className="teach">
      <p className="tag ko">RECUÉRDALO ASÍ · VUELVE EN UN MOMENTO</p>
      <Concept unit={unit} />
    </Slide>
  );
}

function Quick({ unit, reverse, pool, retry, onResult }: { unit: SessionUnit; reverse: boolean; pool: SessionUnit[]; retry: boolean; onResult: (ok: boolean, ms: number) => void }) {
  const label = (u: SessionUnit) => (reverse ? unitMeaning(u) : unitText(u).toUpperCase());
  const choices = useMemo(() => choicesFor(label(unit), pool.map(label), `${unit.key}-${reverse}-${retry}`, 3), [unit, pool, reverse, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<number | null>(null);
  const t0 = useRef(performance.now());
  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i]!.correct;
    setTimeout(() => onResult(ok, Math.round(performance.now() - t0.current)), ok ? 420 : 650);
  }
  return (
    <Slide tone={hue(unit.key)} className={picked === null ? '' : choices[picked]!.correct ? 'right' : 'wrong'}>
      <p className="tag">{retry ? 'OTRA VEZ, AHORA AL REVÉS' : 'RELÁMPAGO'}</p>
      <div className="face-emoji small" aria-hidden="true">{unit.association?.emoji ?? '✨'}</div>
      <h3 className="ask">{reverse ? <>¿Qué es <b>{unitText(unit).toUpperCase()}</b>?</> : <>¿Cuál es <b>{unitMeaning(unit)}</b>?</>}</h3>
      <div className="options">
        {choices.map((c, i) => <button type="button" key={c.label} className={`option ${c.label.length > 24 ? 'long' : ''} ${picked !== null && c.correct ? 'is-right' : ''} ${picked === i && !c.correct ? 'is-wrong' : ''}`} onClick={() => pick(i)}>{c.label}</button>)}
      </div>
    </Slide>
  );
}

/** ¿Verdad o mentira?: desliza → (verdad) o ← (mentira), o toca los botones. */
function Judge({ unit, shown, onResult }: { unit: SessionUnit; shown: SessionUnit; onResult: (ok: boolean, ms: number) => void }) {
  const truth = shown.key === unit.key;
  const [dx, setDx] = useState(0);
  const [done, setDone] = useState<boolean | null>(null);
  const start = useRef<number | null>(null);
  const t0 = useRef(performance.now());
  function answer(saysTrue: boolean) {
    if (done !== null) return;
    const ok = saysTrue === truth;
    setDone(ok);
    setTimeout(() => onResult(ok, Math.round(performance.now() - t0.current)), ok ? 420 : 650);
  }
  return (
    <Slide tone={hue(unit.key)} className={done === null ? '' : done ? 'right' : 'wrong'}>
      <p className="tag">¿VERDAD O MENTIRA?</p>
      <div className="judge-card" style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 18}deg)` : undefined }}
        onPointerDown={(e) => { start.current = e.clientX; }}
        onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
        onPointerUp={() => { if (start.current !== null && Math.abs(dx) > 80) answer(dx > 0); start.current = null; setDx(0); }}>
        <div className="face-emoji small" aria-hidden="true">{unit.association?.emoji ?? '✨'}</div>
        <h2 lang={unit.language}><Breakable text={unitText(unit).toUpperCase()} /></h2>
        <p className="judge-eq">=</p>
        <p className="face-meaning">{unitMeaning(shown)}</p>
        {done !== null && <p className="judge-truth">{truth ? '✓ Era verdad' : `✗ Era mentira: es «${unitMeaning(unit)}»`}</p>}
      </div>
      <div className="judge-buttons">
        <button type="button" className="option no" onClick={() => answer(false)}>✗ Mentira</button>
        <button type="button" className="option yes" onClick={() => answer(true)}>✓ Verdad</button>
      </div>
    </Slide>
  );
}

function Boss({ unit, step, onResult }: { unit: SessionUnit; step: AssocStep; onResult: (ok: boolean, ms: number, format: ClientEvent['format']) => void }) {
  const exercise = exercisesOf(unit)[step.exercise ?? 0]!;
  const choices = useMemo(() => challengeChoices(exercise, step.id), [exercise, step.id]);
  const [picked, setPicked] = useState<string | null>(null);
  const t0 = useRef(performance.now());
  const right = picked !== null && gradeChallenge(exercise, picked, false).correct;
  function pick(label: string) {
    if (picked !== null) return;
    setPicked(label);
    const r = gradeChallenge(exercise, label, false);
    if (r.correct) setTimeout(() => onResult(true, Math.round(performance.now() - t0.current), r.format), 700);
  }
  return (
    <Slide tone={hue(unit.key)} className={`boss ${picked === null ? '' : right ? 'right' : 'wrong'}`}>
      <p className="tag boss-tag">👑 PREGUNTA JEFE · {unitText(unit).toUpperCase()}</p>
      <h3 className="ask">{exercise.prompt}</h3>
      {exercise.code && <blockquote className="reading">{exercise.code}</blockquote>}
      <div className="options">
        {choices.map((c) => <button type="button" key={c.label} className={`option ${c.label.length > 24 ? 'long' : ''} ${picked !== null && c.correct ? 'is-right' : ''} ${picked === c.label && !c.correct ? 'is-wrong' : ''}`} onClick={() => pick(c.label)}>{c.label}</button>)}
      </div>
      {picked !== null && !right && (
        <div className="boss-explain">
          {exercise.explanation && <p>{exercise.explanation}</p>}
          <button type="button" className="go" onClick={() => onResult(false, Math.round(performance.now() - t0.current), 'recognition_choice')}>Entendido</button>
        </div>
      )}
    </Slide>
  );
}

/** Solo en idiomas: escribir la palabra. */
function Write({ unit, onResult }: { unit: SessionUnit; onResult: (ok: boolean, ms: number, hint: number, format: ClientEvent['format']) => void }) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState<HintLevel>(0);
  const [done, setDone] = useState<boolean | null>(null);
  const t0 = useRef(performance.now());
  const hints = reviewHints(unit);
  function check(reveal = false) {
    const r = gradeReview(unit, text, 0, hint, reveal);
    setDone(r.correct);
    setTimeout(() => onResult(r.correct, Math.round(performance.now() - t0.current), r.hint, r.format), r.correct ? 500 : 1400);
  }
  return (
    <Slide tone={hue(unit.key)} className={done === null ? '' : done ? 'right' : 'wrong'}>
      <p className="tag">ESCRÍBELO</p>
      <h3 className="ask">¿Cómo se dice <b>{unitMeaning(unit)}</b>?</h3>
      {hint > 0 && <p className="face-cue">{hints[hint - 1]}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && done === null) check(); }}>
        <input className="write" autoFocus value={text} onChange={(e) => setText(e.target.value)} lang={unit.language} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={done !== null} />
        {done === null && <button type="submit" className="go wide" disabled={!text.trim()}>Comprobar</button>}
      </form>
      {done === null && <div className="judge-buttons"><button type="button" className="option" disabled={hint >= 4} onClick={() => setHint((h) => Math.min(4, h + 1) as HintLevel)}>💡 Pista</button><button type="button" className="option" onClick={() => check(true)}>Ver</button></div>}
      {done === false && <p className="judge-truth">Es <b>{unitText(unit)}</b></p>}
    </Slide>
  );
}

// ─── El flujo ─────────────────────────────────────────────────────────────────────────────────────────────

export function Feed({ payload, courseId, offline = false, onExit, onAgain }: Props) {
  const plan = payload.state.plan as unknown as AssocPlan;
  const units = payload.units;
  const [index, setIndex] = useState(payload.state.index);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(payload.state.outcomes);
  const [teaching, setTeaching] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [party, setParty] = useState<string | null>(null);
  const [floater, setFloater] = useState<{ id: number; text: string } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const queue = useRef<ClientEvent[]>([]);
  const step = plan.steps[index];
  const unit = step?.unitKey ? units[step.unitKey] : undefined;
  const sessionUnits = useMemo(() => [...new Set(plan.steps.map((s) => s.unitKey).filter(Boolean))].map((k) => units[k]!).filter(Boolean), [plan, units]);
  const pool = (u: SessionUnit) => {
    const same = sessionUnits.filter((x) => x.type === u.type);
    return same.length >= 4 ? same : [...same, ...Object.values(units).filter((x) => x.type === u.type && !same.includes(x)).slice(0, 6)];
  };

  // Lo fallado antes en la sesión: la repesca solo se hace para eso; lo demás se salta solo.
  const failed = useMemo(() => {
    const f = new Set<string>();
    plan.steps.slice(0, index).forEach((s) => { if (s.unitKey && outcomes[s.id]?.correct === false) f.add(s.unitKey); });
    return f;
  }, [plan, index, outcomes]);
  const skip = Boolean(step?.retry && !failed.has(step.unitKey));
  useEffect(() => { if (skip) void advance(); }, [skip, index]); // eslint-disable-line react-hooks/exhaustive-deps

  function event(u: SessionUnit, skillKey: string, extra: Partial<ClientEvent>): ClientEvent {
    const skill = u.skills.find((s) => s.key === skillKey);
    return { id: crypto.randomUUID(), at: Date.now(), deviceId: deviceId(), seq: nextSeq(), courseId, unitKey: u.key, skillKey, kind: 'attempt', ...(skill?.associationId ? { associationId: skill.associationId } : {}), ...extra };
  }
  const recallKey = (u: SessionUnit) => u.skills.find((s) => s.kind === 'recall')?.key;

  async function save(nextIndex: number, nextOutcomes: Record<string, Outcome>) {
    const batch = queue.current.splice(0);
    const finished = nextIndex >= plan.steps.length - 1;
    if (offline) { enqueue(courseId, batch); saveSessionProgress(plan.sessionId, { index: nextIndex, outcomes: nextOutcomes, finished }); return; }
    try {
      if (batch.length) await api.events(courseId, batch);
      await api.position(courseId, { sessionId: plan.sessionId, index: nextIndex, outcomes: nextOutcomes, finished, deviceId: deviceId() });
    } catch (e) {
      if (isNetworkError(e)) { enqueue(courseId, batch); return; }
      queue.current.unshift(...batch);
      if (e instanceof ApiError && e.code === 'SESSION_CHANGED') onAgain();
    }
  }
  async function advance(outcome?: Outcome) {
    const nextOutcomes = outcome && step ? { ...outcomes, [step.id]: outcome } : outcomes;
    const nextIndex = index + 1;
    setOutcomes(nextOutcomes);
    setIndex(nextIndex);
    await save(nextIndex, nextOutcomes);
  }
  function scored(ok: boolean, points: number) {
    if (ok) {
      const c = combo + 1;
      setCombo(c); setBest((b) => Math.max(b, c));
      const gain = points + Math.min(c, 10) * 2;
      setXp((x) => x + gain);
      setFloater({ id: Date.now(), text: `+${gain}` });
      buzz(12);
      if (COMBO_PARTY.includes(c)) { setParty(`🔥 ¡${c} seguidas!`); sfx('party'); buzz([20, 40, 20]); setTimeout(() => setParty(null), 1400); } else sfx('ok');
    } else { setCombo(0); sfx('ko'); buzz([30, 30, 30]); }
  }
  /** Respuesta de una tarjeta de pregunta: puntúa, guarda y, si es fallo, enseña la asociación antes de seguir. */
  function answered(u: SessionUnit, ok: boolean, ms: number, contextId: string, points: number, skillKey = recallKey(u), format: ClientEvent['format'] = 'recognition_choice', hint = 0) {
    if (skillKey) queue.current.push(event(u, skillKey, { format, correct: ok, hint: hint as HintLevel, timeMs: ms, contextId }));
    scored(ok, points);
    if (!ok) { setTeaching(u.key); return; }
    void advance({ correct: true, hint });
  }

  useEffect(() => {
    if (step?.kind === 'summary' && !offline) api.progress(courseId).then(setProgress).catch(() => undefined);
  }, [step?.kind, courseId, offline]);

  const visible = plan.steps.filter((s) => !s.retry || failed.has(s.unitKey) || plan.steps.indexOf(s) < index);
  const position = Math.min(visible.length, visible.findIndex((s) => s.id === step?.id) + 1 || visible.length);
  const pct = Math.round((position / Math.max(1, visible.length)) * 100);

  let card: ReactNode = null;
  if (teaching && units[teaching]) card = <Teach key={`teach-${step?.id}`} unit={units[teaching]!} onNext={() => { setTeaching(null); void advance({ correct: false, hint: 0 }); }} />;
  else if (!step || skip) card = null;
  else if (step.kind === 'reel' && unit) card = <Reel key={step.id} unit={unit} onNext={() => { for (const s of unit.skills) queue.current.push(event(unit, s.key, { kind: 'exposure' })); void advance(); }} />;
  else if (step.kind === 'quick' && unit) card = <Quick key={step.id} unit={unit} reverse={Boolean(step.reverse)} retry={Boolean(step.retry)} pool={pool(unit)} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#quick${step.reverse ? '-inv' : ''}`, 10)} />;
  else if (step.kind === 'judge' && unit) card = <Judge key={step.id} unit={unit} shown={units[step.statementOf ?? unit.key] ?? unit} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#judge`, 8)} />;
  else if (step.kind === 'challenge' && unit) card = <Boss key={step.id} unit={unit} step={step} onResult={(ok, ms, format) => answered(unit, ok, ms, `${unit.key}#boss-${step.exercise ?? 0}`, 25, step.skillKey, format)} />;
  else if (step.kind === 'review' && unit) card = <Write key={step.id} unit={unit} onResult={(ok, ms, hint, format) => answered(unit, ok, ms, `${unit.key}#write`, 20, step.skillKey, format, hint)} />;
  else if (step.kind === 'summary') {
    const asked = plan.steps.filter((s) => ['quick', 'judge', 'challenge', 'review'].includes(s.kind) && outcomes[s.id]);
    const right = asked.filter((s) => outcomes[s.id]!.correct).length;
    const newOnes = plan.steps.filter((s) => s.kind === 'reel').length;
    const next = progress?.skills.map((s) => s.dueAt).filter((d): d is number => Boolean(d) && d! > Date.now());
    const when = next?.length ? whenLabel(Math.min(...next)) : null;
    card = (
      <Slide tone={45} className="end">
        <p className="tag">RONDA COMPLETADA</p>
        <div className="end-xp">+{xp} XP</div>
        <div className="end-stats">
          <div><b>{progress?.streak ?? '—'}</b><span>{progress?.streak === 1 ? 'día de racha' : 'días de racha'} 🔥</span></div>
          <div><b>{right}/{asked.length}</b><span>aciertos</span></div>
          <div><b>{best}</b><span>mejor combo</span></div>
          <div><b>{newOnes}</b><span>nuevos en tu memoria</span></div>
        </div>
        {when && <p className="end-next">Tu próximo repaso: {when}, justo antes de que se te olvide.</p>}
        <button type="button" className="go wide" onClick={onAgain}>⚡ Una ronda más</button>
        <button type="button" className="option ghost" onClick={onExit}>Salir</button>
      </Slide>
    );
  }

  return (
    <div className="feed" role="application" aria-label="Sesión en modo Flujo">
      <header className="feed-top">
        <button type="button" className="feed-x" aria-label="Salir" onClick={onExit}>✕</button>
        <div className="feed-bar" aria-label={`Progreso ${pct} %`}><i style={{ width: `${pct}%` }} /></div>
        <span className="feed-xp">{xp} XP</span>
        <span className={`feed-combo ${combo >= 3 ? 'hot' : ''}`}>🔥{combo}</span>
      </header>
      <main className="feed-stage">{card}</main>
      {floater && <span key={floater.id} className="floater">{floater.text}</span>}
      {party && <div className="party" role="status">{party}</div>}
    </div>
  );
}

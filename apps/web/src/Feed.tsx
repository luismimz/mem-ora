// Modo Flujo (D-068, D-072, D-077): aprender deslizando, como en una red social. Pantalla completa, una tarjeta cada
// vez y sin botones de avance: se desliza hacia arriba para seguir y, al acertar, pasa sola. Asociación → relámpago /
// ¿verdad o mentira? → pregunta jefe. Se enseña en el error y lo fallado vuelve unas tarjetas después. Infinito: cada
// ronda acaba en un hito y la siguiente ya está cargada. Puntos, racha con protector, combos, vibración y sonido.
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
import { enablePush, pushState, type PushState } from './push';

interface Outcome { correct: boolean; hint: number }
interface Props { payload: SessionPayload; courseId: string; offline?: boolean; onExit: () => void; onAgain: () => void; next?: () => Promise<SessionPayload> }

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

/**
 * Tarjeta a pantalla completa: se pasa deslizando hacia arriba (o con ↑ / espacio). Sin botones de avance (D-077).
 * En el móvil el gesto va por eventos táctiles: la tarjeta tiene `touch-action: pan-y` para poder desplazar las fichas
 * largas, y con eso el navegador cancela los pointer events (pointercancel) en cuanto el dedo se mueve en vertical, así
 * que el deslizar nunca llegaba a dispararse. Los touch events siguen llegando aunque el navegador haga scroll.
 * El ratón y el lápiz siguen usando pointer events. Solo cuenta como «siguiente» si el gesto empieza con la ficha ya
 * leída hasta abajo (si no, el deslizar sirve para leerla).
 */
function Slide({ children, onNext, tone, className = '' }: { children: ReactNode; onNext?: () => void; tone: number; className?: string }) {
  const [dy, setDy] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLElement>(null);
  const atEnd = () => { const el = box.current; return !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 4; };
  useEffect(() => {
    if (!onNext) return;
    const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.('input, textarea')) return; if (['ArrowUp', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); onNext(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onNext]);
  const begin = (target: EventTarget | null, x: number, y: number) => {
    start.current = onNext && !(target as HTMLElement | null)?.closest?.('button, input, textarea, a') && atEnd() ? { x, y } : null;
  };
  const move = (x: number, y: number) => {
    const s = start.current;
    if (!s) return;
    const ddy = y - s.y;
    if (Math.abs(ddy) > Math.abs(x - s.x)) setDy(Math.min(0, ddy));
  };
  const finish = (x: number, y: number) => {
    const s = start.current;
    start.current = null;
    setDy(0);
    if (!s || !onNext) return;
    const ddy = y - s.y;
    if (ddy < -50 && Math.abs(ddy) > Math.abs(x - s.x)) onNext();
  };
  const cancel = () => { start.current = null; setDy(0); };
  return (
    <section ref={box} className={`slide ${className}`} style={{ '--tone': tone, transform: dy ? `translateY(${dy}px)` : undefined } as React.CSSProperties}
      onTouchStart={(e) => { const t = e.touches[0]; if (e.touches.length !== 1 || !t) { cancel(); return; } begin(e.target, t.clientX, t.clientY); }}
      onTouchMove={(e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); }}
      onTouchEnd={(e) => { const t = e.changedTouches[0]; if (t) finish(t.clientX, t.clientY); else cancel(); }}
      onTouchCancel={cancel}
      onPointerDown={(e) => { if (e.pointerType !== 'touch') begin(e.target, e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (e.pointerType !== 'touch') move(e.clientX, e.clientY); }}
      onPointerUp={(e) => { if (e.pointerType !== 'touch') finish(e.clientX, e.clientY); }}
      onPointerCancel={(e) => { if (e.pointerType !== 'touch') cancel(); }}>
      {children}
      {onNext && <p className="slide-hint" aria-hidden="true">↑ desliza para seguir</p>}
    </section>
  );
}

type Example = { text: string; explanation?: string; translation?: string };
// Código: contenido que no es español y parece código (en inglés, una frase normal se queda como texto).
const isCode = (unit: SessionUnit, text: string) => unit.language !== 'es' && /[;{}()=<>\[\]]|\w+\.\w+|^\s*(docker|mongo|sqlite|pg_|cp |npm|git |-)/m.test(text);

/**
 * La ficha completa (D-073, D-077): primero la mnemotecnia (para recordar) y después «Qué es» y los ejemplos (para
 * entender). Todo lo que se pregunte después está aquí: cada pregunta tiene su ejemplo visto. «Explícame más» abre la
 * letra pequeña (qué corresponde a qué, dónde falla la comparación, cada línea del código) y deja anotada la petición.
 */
function Concept({ unit, full = true, courseId, step }: { unit: SessionUnit; full?: boolean; courseId?: string; step?: string }) {
  const a = unit.association;
  const p = unit.payload as Partial<ConceptPayload> & { examples?: Example[] };
  const examples = ((p.examples ?? []) as Example[]).slice(0, 4);
  const [more, setMore] = useState(false);
  const [asked, setAsked] = useState(false);
  function explain() {
    setMore(true);
    if (asked || !courseId) return;
    setAsked(true);
    api.clarify(courseId, unit.key, step ?? 'reel').catch(() => undefined);
  }
  const extra = Boolean(a?.analogy || a?.trace?.length);
  // Idiomas (D-078): 🔊 para oír la palabra, sus ejemplos y la escena en el idioma que se aprende.
  const voice = unit.type === 'term' && audioEnabled();
  const say = (text: string) => (voice ? <button type="button" className="say" aria-label={`Escuchar «${text}»`} onClick={(e) => { e.stopPropagation(); speak(text, unit.language); }}>🔊</button> : null);
  const rawPron = (unit.payload as { pronunciation?: string | { respelling?: string } }).pronunciation;
  const pron = typeof rawPron === 'string' ? rawPron : rawPron?.respelling;
  return (
    <div className="concept-face">
      <div className="face-emoji" aria-hidden="true">{a?.emoji ?? '✨'}</div>
      <h2 lang={unit.language}><Breakable text={unitText(unit).toUpperCase()} />{say(unitText(unit))}</h2>
      {voice && pron && <p className="face-pron">se pronuncia <b>{pron}</b></p>}
      <p className="face-meaning">{unitMeaning(unit)}</p>
      {a?.cue && <p className="face-cue">{a.technique === 'analogy' ? 'como' : 'suena a'} <b>{a.cue}</b></p>}
      {a?.text && <p className="face-story"><Marked text={a.text} /></p>}
      {voice && a?.sceneTarget && <p className="face-target" lang={unit.language}>{a.sceneTarget} {say(a.sceneTarget)}</p>}
      {full && (p.definition || examples.length > 0) && (
        <div className="face-learn">
          {p.definition && <><p className="learn-label">QUÉ ES</p><p className="learn-text">{p.definition}</p></>}
          {p.contrast && <p className="learn-contrast">{p.contrast}</p>}
          {examples.length > 0 && <p className="learn-label">{examples.length > 1 ? 'EJEMPLOS' : 'EJEMPLO'}</p>}
          {examples.map((ex, i) => (
            <div key={i} className="learn-example">
              {isCode(unit, ex.text) ? <pre className="learn-code" lang={unit.language}><code>{ex.text}</code></pre> : <p className="learn-text" lang={voice ? unit.language : undefined}>{ex.text} {voice && say(ex.text)}</p>}
              {(ex.explanation || ex.translation) && <p className="learn-note">{ex.explanation ?? ex.translation}</p>}
            </div>
          ))}
          {more && a?.analogy && <><p className="learn-label">CÓMO ENCAJA</p><p className="learn-text">{a.analogy.mapping}</p><p className="learn-label">OJO, AQUÍ NO VALE</p><p className="learn-text">{a.analogy.breaksWhere}</p></>}
          {more && a?.trace?.length ? <><p className="learn-label">LÍNEA A LÍNEA</p>{a.trace.map((l, i) => <div key={i} className="learn-example"><pre className="learn-code"><code>{l.code}</code></pre><p className="learn-note"><Marked text={l.note} /></p></div>)}</> : null}
          {courseId && (more
            ? <p className="learn-asked">{extra ? '✓ Anotado: también ampliaré esta ficha.' : '✓ Anotado: ampliaré esta ficha con más explicación.'}</p>
            : <button type="button" className="more-btn" onClick={explain}>🤔 No lo entiendo: explícamelo más</button>)}
        </div>
      )}
    </div>
  );
}

// ─── Tarjetas ─────────────────────────────────────────────────────────────────────────────────────────────

const FOCUS_TAG = { errors: 'TUS ERRORES · RECUÉRDALO', practice: 'REFUERZO · LO QUE MÁS TE CUESTA' } as const;

function Reel({ unit, focus, courseId, onNext }: { unit: SessionUnit; focus?: AssocStep['focus']; courseId: string; onNext: () => void }) {
  useEffect(() => { if (audioEnabled()) speak(unitText(unit), unit.language); }, [unit]);
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className="reel">
      <p className={`tag ${focus === 'errors' ? 'ko' : ''}`}>{focus ? FOCUS_TAG[focus] : 'NUEVO PARA TU MEMORIA'}</p>
      <Concept unit={unit} courseId={courseId} step="reel" />
    </Slide>
  );
}

/** Aviso al fallar: la asociación completa (se enseña en el error). */
function Teach({ unit, note, courseId, onNext }: { unit: SessionUnit; note?: string; courseId: string; onNext: () => void }) {
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className="teach">
      <p className="tag ko">RECUÉRDALO ASÍ · VUELVE EN UN MOMENTO</p>
      {note && <p className="teach-note">{note}</p>}
      <Concept unit={unit} courseId={courseId} step="teach" />
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

function Boss({ unit, step, onResult }: { unit: SessionUnit; step: AssocStep; onResult: (ok: boolean, ms: number, format: ClientEvent['format'], note?: string) => void }) {
  const exercise = exercisesOf(unit)[step.exercise ?? 0]!;
  const choices = useMemo(() => challengeChoices(exercise, step.id), [exercise, step.id]);
  const [picked, setPicked] = useState<string | null>(null);
  const t0 = useRef(performance.now());
  const right = picked !== null && gradeChallenge(exercise, picked, false).correct;
  function pick(label: string) {
    if (picked !== null) return;
    setPicked(label);
    const r = gradeChallenge(exercise, label, false);
    const ms = Math.round(performance.now() - t0.current);
    setTimeout(() => onResult(r.correct, ms, r.format, `La respuesta es «${exercise.answer}».${exercise.explanation ? ` ${exercise.explanation}` : ''}`), r.correct ? 700 : 900);
  }
  return (
    <Slide tone={hue(unit.key)} className={`boss ${picked === null ? '' : right ? 'right' : 'wrong'}`}>
      <p className="tag boss-tag">👑 PREGUNTA JEFE · {unitText(unit).toUpperCase()}</p>
      <h3 className="ask">{exercise.prompt}</h3>
      {exercise.code && <blockquote className="reading">{exercise.code}</blockquote>}
      <div className="options">
        {choices.map((c) => <button type="button" key={c.label} className={`option ${c.label.length > 24 ? 'long' : ''} ${picked !== null && c.correct ? 'is-right' : ''} ${picked === c.label && !c.correct ? 'is-wrong' : ''}`} onClick={() => pick(c.label)}>{c.label}</button>)}
      </div>
    </Slide>
  );
}

/** Sube de nivel (D-077): ya lo has repasado con éxito; ahora lo completas tú, sin opciones. */
function Complete({ unit, step, onResult }: { unit: SessionUnit; step: AssocStep; onResult: (ok: boolean, ms: number, format: ClientEvent['format'], note?: string) => void }) {
  const exercise = exercisesOf(unit)[step.exercise ?? 0]!;
  const [text, setText] = useState('');
  const [done, setDone] = useState<boolean | null>(null);
  const t0 = useRef(performance.now());
  function check() {
    if (done !== null || !text.trim()) return;
    const r = gradeChallenge(exercise, text, true);
    setDone(r.correct);
    const ms = Math.round(performance.now() - t0.current);
    setTimeout(() => onResult(r.correct, ms, r.format, `La respuesta es «${exercise.answer}».${exercise.explanation ? ` ${exercise.explanation}` : ''}`), r.correct ? 600 : 1300);
  }
  return (
    <Slide tone={hue(unit.key)} className={done === null ? '' : done ? 'right' : 'wrong'}>
      <p className="tag boss-tag">⬆️ SUBES DE NIVEL · COMPLÉTALO</p>
      <h3 className="ask">{exercise.prompt}</h3>
      {exercise.code && <blockquote className="reading">{exercise.code}</blockquote>}
      <form className="complete" onSubmit={(e) => { e.preventDefault(); check(); }}>
        <input className="write" autoFocus value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={done !== null} aria-label="Tu respuesta" />
        {done === null && <button type="submit" className="go" disabled={!text.trim()} aria-label="Comprobar">✓</button>}
      </form>
      {done === false && <p className="judge-truth">Es <b>{exercise.answer}</b></p>}
    </Slide>
  );
}

/** Solo en idiomas: escribir la palabra. */
function Write({ unit, levelUp = false, onResult }: { unit: SessionUnit; levelUp?: boolean; onResult: (ok: boolean, ms: number, hint: number, format: ClientEvent['format']) => void }) {
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
      <p className="tag">{levelUp ? '⬆️ SUBES DE NIVEL · ESCRÍBELO' : 'ESCRÍBELO'}</p>
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

/** En el hito (D-077): ofrecer el aviso de repaso una sola vez; nunca tapa nada y se puede ignorar deslizando. */
function PushOptIn() {
  const [state, setState] = useState<PushState | 'busy' | null>(null);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('memora.push.ask') === 'no'; } catch { return false; } });
  useEffect(() => { pushState().then(setState).catch(() => setState('unsupported')); }, []);
  if (hidden || state === null || state === 'unsupported' || state === 'denied') return null;
  if (state === 'on') return <p className="end-next">🔔 Te avisaré en el móvil cuando toque repasar.</p>;
  if (state === 'ios-install') return <p className="end-next push-tip">🔔 Para que te avise cuando toque repasar: en Safari, <b>Compartir → Añadir a pantalla de inicio</b>, y abre Memora desde su icono.</p>;
  const no = () => { setHidden(true); try { localStorage.setItem('memora.push.ask', 'no'); } catch { /* sin almacenamiento */ } };
  return (
    <div className="push-ask">
      <button type="button" className="more-btn" disabled={state === 'busy'} onClick={() => { setState('busy'); enablePush().then(setState).catch(() => setState('off')); }}>🔔 Avísame cuando toque repasar</button>
      <button type="button" className="push-no" onClick={no}>Ahora no</button>
    </div>
  );
}

// ─── El flujo ─────────────────────────────────────────────────────────────────────────────────────────────

export function Feed({ payload, courseId, offline = false, onExit, onAgain, next }: Props) {
  // Infinito (D-077): la ronda actual vive aquí; al llegar al hito se carga la siguiente y se encadena sin cortes.
  const [batch, setBatch] = useState(payload);
  const [upcoming, setUpcoming] = useState<SessionPayload | 'loading' | 'error' | null>(null);
  const [round, setRound] = useState(1);
  const plan = batch.state.plan as unknown as AssocPlan;
  const units = batch.units;
  const [index, setIndex] = useState(batch.state.index);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(batch.state.outcomes);
  const [teaching, setTeaching] = useState<{ key: string; note?: string } | null>(null);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [roundXp, setRoundXp] = useState(0);
  const [party, setParty] = useState<string | null>(null);
  const [floater, setFloater] = useState<{ id: number; text: string } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const queue = useRef<ClientEvent[]>([]);
  const saving = useRef<Promise<void>>(Promise.resolve());
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

  async function persist(nextIndex: number, nextOutcomes: Record<string, Outcome>) {
    const batchEvents = queue.current.splice(0);
    const finished = nextIndex >= plan.steps.length - 1;
    if (offline) { enqueue(courseId, batchEvents); saveSessionProgress(plan.sessionId, { index: nextIndex, outcomes: nextOutcomes, finished }); return; }
    try {
      if (batchEvents.length) await api.events(courseId, batchEvents);
      await api.position(courseId, { sessionId: plan.sessionId, index: nextIndex, outcomes: nextOutcomes, finished, deviceId: deviceId() });
    } catch (e) {
      if (isNetworkError(e)) { enqueue(courseId, batchEvents); return; }
      queue.current.unshift(...batchEvents);
      if (e instanceof ApiError && e.code === 'SESSION_CHANGED') onAgain();
    }
  }
  function save(nextIndex: number, nextOutcomes: Record<string, Outcome>) {
    saving.current = saving.current.then(() => persist(nextIndex, nextOutcomes));
    return saving.current;
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
      setXp((x) => x + gain); setRoundXp((x) => x + gain);
      setFloater({ id: Date.now(), text: `+${gain}` });
      buzz(12);
      if (COMBO_PARTY.includes(c)) { setParty(`🔥 ¡${c} seguidas!`); sfx('party'); buzz([20, 40, 20]); setTimeout(() => setParty(null), 1400); } else sfx('ok');
    } else { setCombo(0); sfx('ko'); buzz([30, 30, 30]); }
  }
  /** Respuesta de una tarjeta de pregunta: puntúa, guarda y, si es fallo, enseña la ficha antes de seguir. */
  function answered(u: SessionUnit, ok: boolean, ms: number, contextId: string, points: number, skillKey = recallKey(u), format: ClientEvent['format'] = 'recognition_choice', hint = 0, note?: string) {
    if (skillKey) queue.current.push(event(u, skillKey, { format, correct: ok, hint: hint as HintLevel, timeMs: ms, contextId }));
    scored(ok, points);
    if (!ok) { setTeaching({ key: u.key, ...(note ? { note } : {}) }); return; }
    void advance({ correct: true, hint });
  }

  // En el hito: el progreso (racha, protectores, próximo repaso) y, ya cargada, la ronda siguiente.
  const atMilestone = step?.kind === 'summary';
  useEffect(() => {
    if (!atMilestone || offline) return;
    api.progress(courseId).then(setProgress).catch(() => undefined);
    if (!next) return;
    setUpcoming('loading');
    saving.current.then(() => next()).then((p) => setUpcoming(p)).catch(() => setUpcoming('error'));
  }, [atMilestone, courseId, offline]); // eslint-disable-line react-hooks/exhaustive-deps
  function nextRound() {
    if (!next || offline) { onAgain(); return; }
    if (upcoming === 'loading') return;
    if (upcoming === 'error' || upcoming === null) { onAgain(); return; }
    if (!upcoming.state.plan.steps.length) { onExit(); return; }
    setBatch(upcoming); setIndex(upcoming.state.index); setOutcomes(upcoming.state.outcomes);
    setTeaching(null); setUpcoming(null); setRoundXp(0); setRound((r) => r + 1);
  }

  const visible = plan.steps.filter((s) => !s.retry || failed.has(s.unitKey) || plan.steps.indexOf(s) < index);
  const position = Math.min(visible.length, visible.findIndex((s) => s.id === step?.id) + 1 || visible.length);
  const pct = Math.round((position / Math.max(1, visible.length)) * 100);

  let card: ReactNode = null;
  if (teaching && units[teaching.key]) card = <Teach key={`teach-${step?.id}`} unit={units[teaching.key]!} {...(teaching.note ? { note: teaching.note } : {})} courseId={courseId} onNext={() => { setTeaching(null); void advance({ correct: false, hint: 0 }); }} />;
  else if (!step || skip) card = null;
  else if (step.kind === 'reel' && unit) card = <Reel key={step.id} unit={unit} focus={step.focus} courseId={courseId} onNext={() => { for (const s of unit.skills) queue.current.push(event(unit, s.key, { kind: 'exposure' })); void advance(); }} />;
  else if (step.kind === 'quick' && unit) card = <Quick key={step.id} unit={unit} reverse={Boolean(step.reverse)} retry={Boolean(step.retry)} pool={pool(unit)} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#quick${step.reverse ? '-inv' : ''}`, 10)} />;
  else if (step.kind === 'judge' && unit) card = <Judge key={step.id} unit={unit} shown={units[step.statementOf ?? unit.key] ?? unit} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#judge`, 8)} />;
  else if (step.kind === 'challenge' && unit && step.typed) card = <Complete key={step.id} unit={unit} step={step} onResult={(ok, ms, format, note) => answered(unit, ok, ms, `${unit.key}#level-${step.exercise ?? 0}`, 30, step.skillKey, format, 0, note)} />;
  else if (step.kind === 'challenge' && unit) card = <Boss key={step.id} unit={unit} step={step} onResult={(ok, ms, format, note) => answered(unit, ok, ms, `${unit.key}#boss-${step.exercise ?? 0}`, 25, step.skillKey, format, 0, note)} />;
  else if (step.kind === 'review' && unit) card = <Write key={step.id} unit={unit} levelUp={Boolean(step.levelUp)} onResult={(ok, ms, hint, format) => answered(unit, ok, ms, `${unit.key}#write`, 20, step.skillKey, format, hint)} />;
  else if (step.kind === 'summary') {
    const asked = plan.steps.filter((s) => ['quick', 'judge', 'challenge', 'review'].includes(s.kind) && outcomes[s.id]);
    const right = asked.filter((s) => outcomes[s.id]!.correct).length;
    const newOnes = plan.steps.filter((s) => s.kind === 'reel' && !s.focus).length;
    const soon = progress?.skills.map((s) => s.dueAt).filter((d): d is number => Boolean(d) && d! > Date.now());
    const when = soon?.length ? whenLabel(Math.min(...soon)) : null;
    const shields = progress?.shields ?? 0;
    const ready = upcoming !== 'loading';
    card = (
      <Slide tone={45} className="end" onNext={nextRound}>
        <p className="tag">🏁 RONDA {round} COMPLETADA</p>
        <div className="end-xp">+{roundXp} XP</div>
        <div className="end-stats">
          <div><b>{progress?.streak ?? '—'}</b><span>{progress?.streak === 1 ? 'día de racha' : 'días de racha'} 🔥</span></div>
          <div><b>{right}/{asked.length}</b><span>aciertos</span></div>
          <div><b>{best}</b><span>mejor combo</span></div>
          <div><b>{newOnes}</b><span>nuevos en tu memoria</span></div>
        </div>
        {shields > 0 && <p className="end-next">🛡️ {shields === 1 ? 'Tienes 1 protector' : `Tienes ${shields} protectores`}: si un día no puedes estudiar, tu racha no se rompe.</p>}
        {when && <p className="end-next">Tu próximo repaso: {when}, justo antes de que se te olvide.</p>}
        {!offline && <PushOptIn />}
        <p className="end-next">{offline ? 'Sin conexión: la siguiente ronda llegará al volver la red.' : ready ? 'La siguiente ronda está lista.' : 'Preparando la siguiente ronda…'}</p>
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

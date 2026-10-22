// Modo Flujo (D-068, D-072, D-077): aprender deslizando, como en una red social. Pantalla completa, una tarjeta cada
// vez y sin botones de avance: se desliza hacia arriba para seguir y, al acertar, pasa sola. Asociación → relámpago /
// ¿verdad o mentira? → pregunta jefe. Se enseña en el error y lo fallado vuelve unas tarjetas después. Infinito: cada
// ronda acaba en un hito y la siguiente ya está cargada. Puntos, racha con protector, combos, vibración y sonido.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HintLevel } from '@memora/core';
import type { ConceptPayload, Mirror, PatternPayload } from '@memora/content';
import {
  buildTiles,
  burstOptions,
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
import { api, ApiError, type Mission, type Progress, type SessionPayload } from './api';
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
  return (kind: 'ok' | 'ko' | 'party' | 'pop' | 'whoosh' | 'boing') => {
    if (!on()) return;
    try {
      ctx ??= new AudioContext();
      const notes = kind === 'ok' ? [660, 880] : kind === 'pop' ? [988, 1319] : kind === 'whoosh' ? [1047, 784, 587] : kind === 'boing' ? [392, 784, 523] : kind === 'party' ? [523, 659, 784, 1047] : [220, 165];
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
    // Un deslizar puede empezar encima de un botón (🔊, «Explícame más»): si el dedo se mueve, el navegador no lo cuenta
    // como toque y el botón no se pulsa. Solo se excluyen los campos de texto.
    start.current = onNext && !(target as HTMLElement | null)?.closest?.('input, textarea') && atEnd() ? { x, y } : null;
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

/**
 * Truco de gramática (D-079): el método Espejo. Arriba, cada pieza en inglés; debajo, su espejo en español (el sujeto
 * que en español se omite, el auxiliar que se mantiene). Después, la regla en una línea, ejemplos con 🔊 y el «ojo».
 */
function PatternFace({ unit }: { unit: SessionUnit }) {
  const p = unit.payload as PatternPayload;
  // D-082: el espejo en movimiento con su primera frase (si la tiene), en la misma tarjeta del truco.
  const first = (p.examples as Array<{ text: string; mirror?: Mirror }>).find((e) => e.mirror);
  const voice = audioEnabled();
  const say = (text: string) => (voice ? <button type="button" className="say" aria-label={`Escuchar «${text}»`} onClick={(e) => { e.stopPropagation(); speak(text, unit.language); }}>🔊</button> : null);
  return (
    <div className="concept-face pattern-face">
      <div className="face-emoji small" aria-hidden="true">{unit.association?.emoji ?? '🪞'}</div>
      <h2 className="pattern-goal">{p.goal}</h2>
      {unit.association?.text && <p className="face-story"><Marked text={unit.association.text} /></p>}
      {first ? <MirrorAnim unit={unit} m={first.mirror!} text={first.text} /> : (
      <div className="mirror" role="list" aria-label="Pieza a pieza">
        {p.pieces.map((x, i) => (
          <span key={i} role="listitem" className={`piece ${x.role}`}>
            <b lang={unit.language}>{x.text}</b>
            {x.hint && <small>{x.hint}</small>}
          </span>
        ))}
      </div>)}
      <p className="pattern-rule">{p.rule}</p>
      <div className="face-learn">
        <p className="learn-label">{p.examples.length > 1 ? 'EJEMPLOS' : 'EJEMPLO'}</p>
        {p.examples.slice(0, 4).map((ex, i) => (
          <div key={i} className="learn-example">
            <p className="learn-text" lang={unit.language}>{ex.text} {say(ex.text)}</p>
            {ex.translation && <p className="learn-note">{ex.translation}</p>}
          </div>
        ))}
        {p.pitfalls?.length ? <><p className="learn-label">OJO</p>{p.pitfalls.map((t, i) => <p key={i} className="learn-contrast">{t}</p>)}</> : null}
      </div>
    </div>
  );
}

// ─── Tarjetas ─────────────────────────────────────────────────────────────────────────────────────────────

const FOCUS_TAG = { errors: 'TUS ERRORES · RECUÉRDALO', practice: 'REFUERZO · LO QUE MÁS TE CUESTA' } as const;

function Reel({ unit, focus, courseId, onNext }: { unit: SessionUnit; focus?: AssocStep['focus']; courseId: string; onNext: () => void }) {
  const isPattern = unit.type === 'pattern';
  useEffect(() => {
    if (!audioEnabled()) return;
    const first = isPattern ? (unit.payload as PatternPayload).examples[0]?.text : unitText(unit);
    if (first) speak(first, unit.language);
  }, [unit, isPattern]);
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className={`reel ${isPattern ? 'grammar' : ''}`}>
      <p className={`tag ${focus === 'errors' ? 'ko' : ''}`}>{focus ? FOCUS_TAG[focus] : isPattern ? '🪞 TRUCO DE GRAMÁTICA' : 'NUEVO PARA TU MEMORIA'}</p>
      {isPattern ? <PatternFace unit={unit} /> : <Concept unit={unit} courseId={courseId} step="reel" />}
    </Slide>
  );
}

/** Aviso al fallar: la asociación completa (se enseña en el error). */
function Teach({ unit, note, courseId, onNext }: { unit: SessionUnit; note?: string; courseId: string; onNext: () => void }) {
  // D-082: al fallar una palabra cuya frase tiene espejo, se ve cómo se construye (en el momento en que más sirve).
  const mirrored = unit.type === 'term' ? (unit.payload as { examples?: Array<{ text: string; mirror?: Mirror }> }).examples?.find((e) => e.mirror) : undefined;
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className="teach">
      <p className="tag ko">RECUÉRDALO ASÍ · VUELVE EN UN MOMENTO</p>
      {note && <p className="teach-note">{note}</p>}
      {mirrored && <MirrorAnim unit={unit} m={mirrored.mirror!} text={mirrored.text} compact />}
      {unit.type === 'pattern' ? <PatternFace unit={unit} /> : <Concept unit={unit} courseId={courseId} step="teach" />}
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

/** Escucha (D-079): oyes la palabra (sin verla) y eliges qué significa. Practica la habilidad «escuchar». */
function Listen({ unit, pool, onResult }: { unit: SessionUnit; pool: SessionUnit[]; onResult: (ok: boolean, ms: number) => void }) {
  const choices = useMemo(() => choicesFor(unitMeaning(unit), pool.map(unitMeaning), `${unit.key}-listen`, 3), [unit, pool]);
  const [picked, setPicked] = useState<number | null>(null);
  const t0 = useRef(performance.now());
  const play = () => speak(unitText(unit), unit.language, 0.8);
  useEffect(() => { play(); }, [unit]); // eslint-disable-line react-hooks/exhaustive-deps
  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i]!.correct;
    setTimeout(() => onResult(ok, Math.round(performance.now() - t0.current)), ok ? 700 : 1200);
  }
  return (
    <Slide tone={hue(unit.key)} className={picked === null ? '' : choices[picked]!.correct ? 'right' : 'wrong'}>
      <p className="tag">👂 ESCUCHA</p>
      <button type="button" className="listen-play" aria-label="Escuchar otra vez" onClick={play}>🔊</button>
      <h3 className="ask">{picked === null ? '¿Qué has oído?' : <><b lang={unit.language}>{unitText(unit).toUpperCase()}</b> = {unitMeaning(unit)}</>}</h3>
      <div className="options">
        {choices.map((c, i) => <button type="button" key={c.label} className={`option ${picked !== null && c.correct ? 'is-right' : ''} ${picked === i && !c.correct ? 'is-wrong' : ''}`} onClick={() => pick(i)}>{c.label}</button>)}
      </div>
    </Slide>
  );
}

/** Orden estable que nunca deja la frase ya resuelta (si se puede). */
function scramble(words: string[], seed: string): string[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out = words.map((w, i) => ({ w, k: ((h ^ (i * 2654435761)) >>> 0) % 1000 })).sort((a, b) => a.k - b.k).map((x) => x.w);
  return out.join(' ') === words.join(' ') && words.length > 1 ? [...out.slice(1), out[0]!] : out;
}
const plain = (x: string) => x.toLowerCase().replace(/[.,!?¡¿;:"«»]/g, '').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();

/**
 * Construye la frase (D-079): ves la frase en español y ordenas las palabras en inglés tocándolas. Usar la palabra en
 * una frase real es lo que la fija; practica la habilidad «producir» (con las piezas a la vista: pista 1).
 */
function Build({ unit, example, onResult }: { unit: SessionUnit; example: number; onResult: (ok: boolean, ms: number, note: string, hint: number) => void }) {
  const ex = (unit.payload as { examples: Array<{ text: string; translation?: string; mirror?: Mirror }> }).examples[example]!;
  // D-082: si la frase tiene su tren, se puede pedir ver cómo se construye (cuenta como ayuda: pista 2).
  const [help, setHelp] = useState(false);
  const words = useMemo(() => buildTiles(ex.text), [ex.text]);
  const bank = useMemo(() => scramble(words, `${unit.key}-${example}`).map((w, i) => ({ w, i })), [words, unit.key, example]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [done, setDone] = useState<boolean | null>(null);
  const t0 = useRef(performance.now());
  useEffect(() => {
    if (done !== null || chosen.length !== words.length) return;
    const answer = chosen.map((i) => bank[i]!.w).join(' ');
    const ok = plain(answer) === plain(words.join(' '));
    setDone(ok);
    if (ok && audioEnabled()) speak(ex.text, unit.language);
    setTimeout(() => onResult(ok, Math.round(performance.now() - t0.current), `Es «${ex.text}» (${ex.translation}).`, help ? 2 : 1), ok ? 1100 : 1500);
  }, [chosen]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (i: number) => { if (done !== null) return; setChosen((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i])); };
  return (
    <Slide tone={hue(unit.key)} className={`build ${done === null ? '' : done ? 'right' : 'wrong'}`}>
      <p className="tag">🧩 CONSTRUYE LA FRASE</p>
      <h3 className="ask build-es">«{ex.translation}»</h3>
      {ex.mirror && done === null && (help
        ? <MirrorAnim unit={unit} m={ex.mirror} text={ex.text} compact />
        : <button type="button" className="train-help" onClick={() => setHelp(true)}>🪞 ¿Cómo se construye?</button>)}
      <div className="build-line" aria-label="Tu frase" lang={unit.language}>
        {chosen.length ? chosen.map((i) => <button type="button" key={i} className="tile on" onClick={() => toggle(i)}>{bank[i]!.w}</button>) : <span className="build-empty">Toca las palabras en orden</span>}
      </div>
      <div className="build-bank" lang={unit.language}>
        {bank.map((b, i) => <button type="button" key={i} className="tile" disabled={chosen.includes(i)} onClick={() => toggle(i)}>{b.w}</button>)}
      </div>
      {done === false && <p className="judge-truth">Es <b>{ex.text}</b></p>}
    </Slide>
  );
}

/** Confeti al acertar en la Ráfaga: piezas de colores que saltan y caen (solo CSS). */
function Confetti({ burst }: { burst: number }) {
  if (!burst) return null;
  const colors = ['#ffd76a', '#43d68b', '#ff6b5b', '#6bc7ff', '#c88bff'];
  return (
    <div className="confetti" key={burst} aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--x': `${((i * 37) % 100) - 50}vw`, '--r': `${(i * 53) % 360}deg`, background: colors[i % colors.length], animationDelay: `${(i % 6) * 25}ms` } as React.CSSProperties} />)}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { who: 'quién', helper: 'ayudante', verb: 'acción', word: 'lo que dices', signal: 'semáforo' };
type TrainStage = 'say' | 'ghost' | 'swap' | 'flip' | 'jump' | 'done';

/**
 * El tren de la frase (D-082): cómo se construye una frase desde el español, para que nadie se quede en «no lo sé».
 * Lo que dices («¿Tienes hambre?») → tu frase completa en español: despiertas al pronombre que el español esconde
 * (👻 TÚ) y cambias la ficha que en inglés es otra («tienes» → «estás»: el hambre se siente) → le das la vuelta pieza
 * a pieza al inglés → y, en las preguntas, el ayudante SALTA delante. Cada papel tiene siempre su color (quién azul,
 * ayudante naranja, acción verde, semáforo rojo), en toda la app. Lo hace el alumno con el dedo, paso a paso.
 */
/** Tiempos de la animación del espejo (ms): lo que dices → en español completo → en inglés → el salto. */
const MORPH_MS = [1000, 1700, 1500, 1300];

/**
 * El espejo en movimiento (D-082). UNA fila de fichas que se transforma sola, sin toques:
 * 1) lo que dices («¿Tienes hambre?»); 2) la misma frase completa en español: el 👻 TÚ entra volando y la ficha
 * cambiada lleva lo que se dice tachado encima (tienes → estás); 3) cada ficha GIRA en 3D y por detrás está su pareja
 * inglesa, con el español pequeño debajo para no perder la relación; 4) si el orden cambia, las fichas se MUEVEN de
 * verdad: el ayudante sale de su sitio y pasa por encima del quién en un arco. Al final, la frase con su voz y las
 * fichas iluminándose una a una. Un toque salta al final o lo repite. Sonidos cortos en cada paso.
 */
function MirrorAnim({ unit, m, text, compact = false }: { unit: SessionUnit; m: Mirror; text: string; compact?: boolean }) {
  const order = useMemo(() => m.order ?? m.pieces.map((_, i) => i), [m]);
  const jumps = order.some((v, i) => v !== i);
  const last = jumps ? 3 : 2;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState(reduced ? last + 1 : 0);
  const [run, setRun] = useState(0);
  const [lit, setLit] = useState(-1);
  const done = phase > last;
  const chips = useRef<Record<number, HTMLElement | null>>({});
  const rects = useRef<Record<number, DOMRect>>({});

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setPhase((p) => p + 1), MORPH_MS[phase]);
    return () => clearTimeout(t);
  }, [phase, done, run]);
  useEffect(() => {
    if (reduced) return;
    if (phase === 1 && m.pieces.some((p) => p.ghost)) sfx('pop');
    if (phase === 2) sfx('whoosh');
    if (phase === 3 && jumps) sfx('boing');
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // Al terminar: la voz y las fichas iluminándose en el orden inglés, como un karaoke.
  useEffect(() => {
    if (!done) { setLit(-1); return; }
    if (audioEnabled()) speak(text, unit.language);
    let i = 0;
    const t = setInterval(() => { setLit(i); i += 1; if (i > order.length) clearInterval(t); }, 330);
    return () => clearInterval(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  // Movimiento real (FLIP): solo cuando cambia el orden (fase 3), cada ficha sale de donde estaba y el ayudante que
  // salta va en arco por encima. En el resto de cambios solo se apunta dónde está cada ficha.
  const lastPhase = useRef(phase);
  useLayoutEffect(() => {
    const reorder = lastPhase.current === 2 && phase === 3;
    lastPhase.current = phase;
    for (const [k, el] of Object.entries(chips.current)) {
      if (!el) continue;
      const now = el.getBoundingClientRect();
      const before = rects.current[Number(k)];
      rects.current[Number(k)] = now;
      if (!before || reduced || !reorder) continue;
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
      const leaps = m.pieces[Number(k)]!.role === 'helper' || dx > 0;
      el.animate(leaps
        ? [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: `translate(${dx / 2}px, ${dy / 2 - 46}px) rotate(-8deg)`, offset: 0.5 }, { transform: 'none' }]
        : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 750, easing: 'cubic-bezier(.3, 1.2, .5, 1)' });
    }
  });

  const english = phase >= 2;
  const shown = phase >= 3 ? order : m.pieces.map((_, i) => i);
  const question = m.say.trim().startsWith('¿');
  const spanishFull = m.pieces.filter((p) => p.role !== 'signal').map((p) => p.es).join(' ');
  const helperJumps = jumps && order.findIndex((i) => m.pieces[i]!.role === 'helper') < order.findIndex((i) => m.pieces[i]!.role === 'who');
  const swaps = m.pieces.filter((p) => p.from);
  const caption = phase === 0 ? 'Lo que dices…'
    : phase === 1 ? <>Dilo completo: <b>{question ? `¿${spanishFull}?` : spanishFull}</b></>
    : phase === 2 ? 'Cada pieza, al inglés'
    : phase === 3 ? (helperJumps ? '¡El ayudante salta delante!' : '¡En inglés, la pieza salta!')
    : null;
  const tap = () => { if (done) { rects.current = {}; setPhase(0); setRun((r) => r + 1); } else setPhase(last + 1); };
  return (
    <div className={`morph ${compact ? 'compact' : ''}`} onClick={tap} role="button" tabIndex={0} aria-label={done ? 'Verlo otra vez' : 'Saltar al final'}>
      {phase === 0 ? <p className="morph-say">{m.say}</p> : (
        <div className="morph-row" lang={english ? unit.language : 'es'}>
          {shown.map((i, pos) => {
            const p = m.pieces[i]!;
            if (p.role === 'signal' && !english) return null;
            return (
              <span key={`p${i}-${run}`} ref={(el) => { chips.current[i] = el; }} className={`mchip role-${p.role} ${p.ghost && !english ? 'ghost-in' : ''} ${p.role === 'signal' ? 'grow' : ''} ${done && order[lit] === i ? 'lit' : ''}`}>
                {!english && p.from && <s className="was">{p.from}</s>}
                <span className={`mface ${english ? 'flipped' : ''}`} style={{ transitionDelay: `${pos * 110}ms` }}>
                  <span className="front">{p.ghost && <i className="ghost-tag" aria-hidden="true">👻</i>}<b>{p.role === 'signal' ? '🚦' : p.es}</b></span>
                  <span className="back"><b>{p.role === 'signal' ? `🚦 ${p.en}` : p.en}</b><small>{p.role === 'signal' ? 'semáforo' : p.es}</small></span>
                </span>
              </span>
            );
          })}
        </div>
      )}
      {caption && <p className="morph-cap">{caption}</p>}
      {phase === 1 && swaps.some((p) => p.why) && <p className="why">⚡ {swaps.map((p) => `${p.from} → ${p.es}`).join(', ')}: {swaps.find((p) => p.why)!.why}</p>}
      {done && (
        <div className="morph-end">
          <p className="train-final" lang={unit.language}>{text}</p>
          {audioEnabled() && <button type="button" className="say" aria-label="Escuchar" onClick={(e) => { e.stopPropagation(); speak(text, unit.language); }}>🔊</button>}
          <span className="morph-again" aria-hidden="true">↻</span>
        </div>
      )}
    </div>
  );
}

/** Sesiones guardadas con la tarjeta antigua del tren: se muestra la animación en un paso. */
function Train({ unit, example, onNext }: { unit: SessionUnit; example: number; onNext: () => void }) {
  const ex = (unit.payload as { examples: Array<{ text: string; mirror?: Mirror }> }).examples[example]!;
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className="train">
      <p className="tag">🪞 CÓMO SE CONSTRUYE</p>
      <MirrorAnim unit={unit} m={ex.mirror!} text={ex.text} />
    </Slide>
  );
}

/** Tiempo de cada pregunta de la Ráfaga hasta que la tarjeta «toca el suelo». */
const BURST_MS = 4000;

/**
 * Ráfaga (D-081): los juegos de los pilares. Las preguntas de un concepto-juego caen una tras otra y se responden
 * rápido: con dos respuestas, deslizando la tarjeta (← izquierda, derecha →) o con sus dos botones; con tres o cuatro,
 * golpeando botones gigantes de colores (DO · DID · WILL). Acierto = confeti y «pop»; fallo = sonido y la respuesta.
 * Si la tarjeta toca el suelo, «¡Tarde!»: vuelve al final una vez (la rapidez da puntos; no se castiga, ESTANDAR §2).
 */
function Burst({ unit, onResult }: { unit: SessionUnit; onResult: (ok: boolean, ms: number, points: number, note: string) => void }) {
  const options = useMemo(() => burstOptions(unit) ?? [], [unit]);
  const items = useMemo(() => exercisesOf(unit), [unit]);
  const [queue, setQueue] = useState<number[]>(() => items.map((_, i) => i).sort((a, b) => ((a * 7919 + unit.key.length) % 13) - ((b * 7919 + unit.key.length) % 13)));
  const [late, setLate] = useState<number[]>([]);
  const [ok, setOk] = useState(0);
  const [done, setDone] = useState(0);
  const [fb, setFb] = useState<{ ok: boolean; late?: boolean } | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const t0 = useRef(performance.now());
  const current = queue[0];
  const ex = current === undefined ? undefined : items[current];
  const two = options.length === 2;

  function next(after: number) {
    setTimeout(() => {
      setFb(null); setDx(0);
      setQueue((q) => q.slice(1));
    }, after);
  }
  useEffect(() => {
    if (current !== undefined || !items.length) return;
    const ratio = ok / Math.max(1, done);
    onResult(ratio >= 0.8, Math.round(performance.now() - t0.current), 4 * ok, `Has acertado ${ok} de ${done}. Repasa la regla y vuelve a intentarlo.`);
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (current === undefined || fb) return;
    const timer = setTimeout(() => {
      if (!late.includes(current)) { setLate((l) => [...l, current]); setFb({ ok: false, late: true }); sfx('ko'); setTimeout(() => { setFb(null); setQueue((q) => [...q.slice(1), current]); }, 700); return; }
      answer(null);
    }, BURST_MS);
    return () => clearTimeout(timer);
  }, [current, fb]); // eslint-disable-line react-hooks/exhaustive-deps

  function answer(choice: string | null) {
    if (!ex || fb) return;
    const right = choice === ex.answer;
    setDone((d) => d + 1);
    if (right) { setOk((n) => n + 1); setConfetti((c) => c + 1); sfx('pop'); buzz(12); } else { sfx('ko'); buzz([30, 30, 30]); }
    setFb({ ok: right });
    next(right ? 550 : 1500);
  }
  if (!ex) return <Slide tone={hue(unit.key)} className="burst"><p className="tag">🎮 {unitText(unit).toUpperCase()}</p><h3 className="ask">{ok}/{done}</h3></Slide>;
  return (
    <Slide tone={hue(unit.key)} className={`burst ${fb ? (fb.ok ? 'right' : 'wrong') : ''}`}>
      <p className="tag">🎮 {unitText(unit).toUpperCase()} · {Math.min(done + 1, items.length + late.length)}/{items.length}</p>
      <p className="burst-score">✅ {ok} {done - ok > 0 ? `· ❌ ${done - ok}` : ''}</p>
      <div className="burst-sky">
        <div key={`${current}-${late.includes(current!) ? 'b' : 'a'}`} className={`burst-card ${fb ? 'stop' : ''}`} style={{ animationDuration: `${BURST_MS}ms`, transform: dx ? `translateX(${dx}px) rotate(${dx / 14}deg)` : undefined }}
          onPointerDown={(e) => { if (two) start.current = e.clientX; }}
          onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
          onPointerUp={() => { if (start.current !== null && Math.abs(dx) > 70) answer(dx < 0 ? options[0]! : options[1]!); else setDx(0); start.current = null; }}
          onPointerCancel={() => { start.current = null; setDx(0); }}>
          <span className="burst-prompt">{ex.prompt}</span>
          {fb && <span className="burst-fb">{fb.late ? '⏰ ¡Tarde! Vuelve al final' : fb.ok ? '¡Sí! 🎉' : <>Es <b>{ex.answer}</b>{ex.explanation ? <small>{ex.explanation}</small> : null}</>}</span>}
        </div>
        <div className="burst-floor" />
      </div>
      {two && <p className="burst-hint">← desliza a un lado o toca →</p>}
      <div className={`burst-buttons n${options.length}`}>
        {options.map((o, i) => <button type="button" key={o} className={`burst-btn c${i}`} onClick={() => answer(o)}>{two ? (i === 0 ? `← ${o}` : `${o} →`) : o}</button>)}
      </div>
      <Confetti burst={confetti} />
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
  const [map, setMap] = useState<{ missions: Mission[]; current: string | null } | null>(null);
  const queue = useRef<ClientEvent[]>([]);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const step = plan.steps[index];
  const unit = step?.unitKey ? units[step.unitKey] : undefined;
  const sessionUnits = useMemo(() => [...new Set(plan.steps.map((s) => s.unitKey).filter(Boolean))].map((k) => units[k]!).filter(Boolean), [plan, units]);
  const pool = (u: SessionUnit) => {
    const same = sessionUnits.filter((x) => x.type === u.type);
    return same.length >= 4 ? same : [...same, ...Object.values(units).filter((x) => x.type === u.type && !same.includes(x)).slice(0, 6)];
  };

  // Pendiente de repesca: lo que se falló y aún no se ha vuelto a acertar en la sesión. En cuanto se acierta, las demás
  // repescas de esa unidad se saltan (antes salían dos «Otra vez» seguidas de la misma palabra).
  const failed = useMemo(() => {
    const f = new Set<string>();
    plan.steps.slice(0, index).forEach((s) => {
      const o = outcomes[s.id];
      if (!s.unitKey || !o) return;
      if (o.correct === false) f.add(s.unitKey); else if (s.retry) f.delete(s.unitKey);
    });
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
    // El progreso y el mapa se piden cuando ya se han guardado las respuestas de la ronda (si no, saldría el de antes).
    saving.current.then(() => Promise.all([api.progress(courseId).then(setProgress), api.missions(courseId).then(setMap)])).catch(() => undefined);
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
  else if (step.kind === 'train' && unit && step.example !== undefined) card = <Train key={step.id} unit={unit} example={step.example} onNext={() => void advance()} />;
  else if (step.kind === 'burst' && unit) card = <Burst key={step.id} unit={unit} onResult={(ok, ms, points, note) => answered(unit, ok, ms, `${unit.key}#burst`, points, step.skillKey, 'recognition_choice', 0, note)} />;
  else if (step.kind === 'listen' && unit) card = <Listen key={step.id} unit={unit} pool={pool(unit)} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#listen`, 12, step.skillKey, 'recognition_listening')} />;
  else if (step.kind === 'build' && unit && step.example !== undefined) card = <Build key={step.id} unit={unit} example={step.example} onResult={(ok, ms, note, hint) => answered(unit, ok, ms, `${unit.key}#build-${step.example}`, hint > 1 ? 12 : 20, step.skillKey, 'production', hint, note)} />;
  else if (step.kind === 'judge' && unit) card = <Judge key={step.id} unit={unit} shown={units[step.statementOf ?? unit.key] ?? unit} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#judge`, 8)} />;
  else if (step.kind === 'challenge' && unit && step.typed) card = <Complete key={step.id} unit={unit} step={step} onResult={(ok, ms, format, note) => answered(unit, ok, ms, `${unit.key}#level-${step.exercise ?? 0}`, 30, step.skillKey, format, 0, note)} />;
  else if (step.kind === 'challenge' && unit) card = <Boss key={step.id} unit={unit} step={step} onResult={(ok, ms, format, note) => answered(unit, ok, ms, `${unit.key}#boss-${step.exercise ?? 0}`, 25, step.skillKey, format, 0, note)} />;
  else if (step.kind === 'review' && unit) card = <Write key={step.id} unit={unit} levelUp={Boolean(step.levelUp)} onResult={(ok, ms, hint, format) => answered(unit, ok, ms, `${unit.key}#write`, 20, step.skillKey, format, hint)} />;
  else if (step.kind === 'summary') {
    const asked = plan.steps.filter((s) => ['quick', 'judge', 'challenge', 'review', 'listen', 'build', 'burst'].includes(s.kind) && outcomes[s.id]);
    const right = asked.filter((s) => outcomes[s.id]!.correct).length;
    const newOnes = plan.steps.filter((s) => s.kind === 'reel' && !s.focus).length;
    const soon = progress?.skills.map((s) => s.dueAt).filter((d): d is number => Boolean(d) && d! > Date.now());
    const when = soon?.length ? whenLabel(Math.min(...soon)) : null;
    const shields = progress?.shields ?? 0;
    // D-079: el avance que se nota. Lo que ya está en tu memoria (aprendido o más) y lo trabajado, y en qué misión vas.
    const inMemory = progress?.units.filter((u) => u.level !== 'none').length ?? 0;
    const workedUnits = progress ? new Set(progress.skills.filter((sk) => !['new', 'presented'].includes(sk.status)).map((sk) => sk.unit)).size : 0;
    const current = map?.missions.find((m) => m.key === map.current);
    const doneMissions = map?.missions.filter((m) => m.status === 'done').length ?? 0;
    const ready = upcoming !== 'loading';
    card = (
      <Slide tone={45} className="end" onNext={nextRound}>
        <p className="tag">{batch.state.focus === 'fallos' ? '🧹 RONDA DE FALLOS COMPLETADA' : `🏁 RONDA ${round} COMPLETADA`}</p>
        <div className="end-xp">+{roundXp} XP</div>
        <div className="end-stats">
          <div><b>{progress?.streak ?? '—'}</b><span>{progress?.streak === 1 ? 'día de racha' : 'días de racha'} 🔥</span></div>
          <div><b>{right}/{asked.length}</b><span>aciertos</span></div>
          <div><b>{best}</b><span>mejor combo</span></div>
          <div><b>{newOnes}</b><span>nuevos en tu memoria</span></div>
        </div>
        {progress?.today && (
          <div className={`end-goal ${progress.today.newUnits >= progress.today.goal ? 'done' : ''}`}>
            <div className="row"><span>{progress.today.newUnits >= progress.today.goal ? '🎯 ¡Meta de hoy cumplida!' : '🎯 Meta de hoy'}</span><b>{progress.today.newUnits}/{progress.today.goal} nuevas</b></div>
            <i><i style={{ width: `${Math.min(100, Math.round((progress.today.newUnits / Math.max(1, progress.today.goal)) * 100))}%` }} /></i>
          </div>
        )}
        {progress?.failures !== undefined && (progress.failures > 0
          ? <p className="end-fails">❌ Te {progress.failures === 1 ? 'queda 1 fallo' : `quedan ${progress.failures} fallos`} por acertar. Vacíalos desde Inicio.</p>
          : batch.state.focus === 'fallos' && <p className="end-fails clean">🧹 ¡Fallos vaciados! No te queda ninguno.</p>)}
        {progress && <p className="end-memory">🧠 <b>{workedUnits}</b> trabajadas · <b>{inMemory}</b> ya en tu memoria a largo plazo</p>}
        {current && (
          <div className="end-mission">
            <div className="row"><span>🗺️ Misión {current.index} · {current.title.replace(/^Misión \d+ · /, '')}</span><b>{current.worked}/{current.total}</b></div>
            <i><i style={{ width: `${Math.round((current.worked / Math.max(1, current.total)) * 100)}%` }} /></i>
            {doneMissions > 0 && <small>{doneMissions} {doneMissions === 1 ? 'misión completada' : 'misiones completadas'} de {map!.missions.length}</small>}
          </div>
        )}
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

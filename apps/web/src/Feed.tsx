// Modo Flujo (D-068, D-072, D-077): aprender deslizando, como en una red social. Pantalla completa, una tarjeta cada
// vez y sin botones de avance: se desliza hacia arriba para seguir y, al acertar, pasa sola. Asociación → relámpago /
// ¿verdad o mentira? → pregunta jefe. Se enseña en el error y lo fallado vuelve unas tarjetas después. Infinito: cada
// ronda acaba en un hito y la siguiente ya está cargada. Puntos, racha con protector, combos, vibración y sonido.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { HintLevel } from '@memora/core';
import type { ConceptPayload, Mirror, PatternPayload, StageActor, TimelineMark, Widget } from '@memora/content';
import {
  buildTiles,
  burstOptions,
  challengeChoices,
  chantOf,
  choicesFor,
  drillsOf,
  maskName,
  movedPieces,
  sentencesOf,
  orderRule,
  orderSwap,
  spanishOrderCalque,
  exercisesOf,
  gradeChallenge,
  gradeReview,
  reviewHints,
  stagedExamples,
  unitMeaning,
  unitText,
  type AssocPlan,
  type AssocStep,
  type ClientEvent,
  type SessionUnit,
  type WorkshopItem,
} from '@memora/experiences';
import { api, ApiError, type Mission, type Progress, type ReportReason, type SessionPayload } from './api';
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
export function hue(key: string) {
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

/** La ficha que enseña una unidad (la misma del Flujo): para el modelo de examen guiado, antes de cada pregunta. */
export function UnitFicha({ unit, courseId }: { unit: SessionUnit; courseId: string }) {
  return unit.type === 'pattern' ? <PatternFace unit={unit} /> : <Concept unit={unit} courseId={courseId} step="exam" />;
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
      {first ? <FlipMirror unit={unit} m={first.mirror!} text={first.text} /> : (
      <div className="mirror" role="list" aria-label="Pieza a pieza">
        {p.pieces.map((x, i) => (
          <span key={i} role="listitem" className={`piece ${x.role}`}>
            <b lang={unit.language}>{x.text}</b>
            {x.hint && <small>{x.hint}</small>}
          </span>
        ))}
      </div>)}
      <p className="pattern-rule">{p.rule}</p>
      {p.timeline?.length ? <TimeLine marks={p.timeline} {...(p.tense ? { title: p.tense } : {})} /> : p.tense ? <p className="tense-chip">🕰️ {p.tense}</p> : null}
      {p.signals?.length ? <p className="tense-signals" lang={unit.language}><span>🔎 PISTAS</span>{p.signals.map((t) => <b key={t}>{t}</b>)}</p> : null}
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

/**
 * La línea del tiempo (D-089): antes · AHORA · después, con las marcas del tiempo verbal. Un punto pasó una vez, una
 * barra duraba, los puntitos se repiten, la línea discontinua es un momento de referencia, el arco une algo pasado con
 * hoy y el círculo discontinuo es imaginado. Las etiquetas se apilan para no pisarse.
 */
export function TimeLine({ marks, title, small = false }: { marks: TimelineMark[]; title?: string; small?: boolean }) {
  const labeled = marks.filter((m) => m.label);
  const axis = 30 + labeled.length * 16;
  const height = axis + 24;
  const x = (at: number) => 160 + at * 46;
  const mid = (m: TimelineMark) => (m.to === undefined ? x(m.at) : (x(m.at) + x(m.to)) / 2);
  const said = marks.map((m) => m.label).filter(Boolean).join(' · ');
  return (
    <figure className={`timeline ${small ? 'small' : ''}`}>
      {title && <figcaption>🕰️ {title}</figcaption>}
      <svg viewBox={`0 0 320 ${height}`} role="img" aria-label={`Línea del tiempo${said ? `: ${said}` : ''}`}>
        <line className="tl-axis" x1="8" x2="306" y1={axis} y2={axis} />
        <polygon className="tl-arrow" points={`306,${axis - 5} 316,${axis} 306,${axis + 5}`} />
        <line className="tl-now" x1="160" x2="160" y1={axis - 12} y2={axis + 12} />
        <circle className="tl-now-dot" cx="160" cy={axis} r="4" />
        <text className="tl-zone" x="34" y={height - 4}>ANTES</text>
        <text className="tl-zone now" x="160" y={height - 4}>AHORA</text>
        <text className="tl-zone" x="286" y={height - 4}>DESPUÉS</text>
        {marks.map((m, i) => {
          const to = m.to ?? m.at;
          if (m.kind === 'action') return <rect key={i} className="tl-action" x={x(m.at)} y={axis - 6} width={Math.max(8, x(to) - x(m.at))} height="12" rx="6" />;
          if (m.kind === 'habit') {
            const n = Math.max(2, Math.floor((x(to) - x(m.at)) / 20) + 1);
            return <g key={i} className="tl-habit">{Array.from({ length: n }, (_, k) => <circle key={k} cx={x(m.at) + ((x(to) - x(m.at)) * k) / (n - 1)} cy={axis} r="4" style={{ animationDelay: `${k * 30}ms` }} />)}</g>;
          }
          if (m.kind === 'ref') return <line key={i} className="tl-ref" x1={x(m.at)} x2={x(m.at)} y1={axis - 16} y2={axis + 12} />;
          if (m.kind === 'link') return <path key={i} className="tl-link" d={`M ${x(m.at)} ${axis - 7} Q ${(x(m.at) + x(to)) / 2} ${axis - 30} ${x(to)} ${axis - 7}`} />;
          if (m.kind === 'unreal') return <g key={i} className="tl-unreal"><circle cx={x(m.at)} cy={axis} r="9" /><text x={x(m.at)} y={axis + 4}>?</text></g>;
          return <circle key={i} className="tl-event" cx={x(m.at)} cy={axis} r="7" />;
        })}
        {labeled.map((m, i) => {
          const y = axis - 18 - (labeled.length - 1 - i) * 16;
          return <text key={i} className={`tl-label ${m.kind}`} x={Math.min(262, Math.max(58, mid(m)))} y={y}>{m.label}</text>;
        })}
      </svg>
    </figure>
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
function Teach({ unit, note, scene, courseId, onNext }: { unit: SessionUnit; note?: string; scene?: number; courseId: string; onNext: () => void }) {
  // D-082: al fallar una palabra cuya frase tiene espejo, se ve cómo se construye (en el momento en que más sirve).
  // D-084: al fallar en una escena, se ve la escena correcta con su frase.
  const shown = scene === undefined ? undefined : stagedOf(unit)[scene];
  const mirrored = unit.type === 'term' ? (unit.payload as { examples?: Array<{ text: string; mirror?: Mirror }> }).examples?.find((e) => e.mirror) : undefined;
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className="teach">
      <p className="tag ko">RECUÉRDALO ASÍ · VUELVE EN UN MOMENTO</p>
      {note && <p className="teach-note">{note}</p>}
      {mirrored && <MirrorAnim unit={unit} m={mirrored.mirror!} text={mirrored.text} compact />}
      {shown && (
        <div className="teach-scene">
          <Stage actors={shown.stage!} size="small" label={shown.text} />
          <p><b lang={unit.language}>{shown.text}</b><br /><span>{shown.translation}</span></p>
        </div>
      )}
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

type StagedExample = { text: string; translation?: string; stage?: StageActor[] };
const stagedOf = (unit: SessionUnit) => (unit.payload as { examples: StagedExample[] }).examples;

/**
 * Escenario (D-084): emojis colocados en un cuadro de 100 × 100. Cada actor conserva su identidad entre escenas (mismo
 * emoji, misma aparición), así que al cambiar de escena se DESPLAZA en vez de aparecer de golpe: se ve el movimiento.
 */
function Stage({ actors, size = 'big', label }: { actors: StageActor[]; size?: 'big' | 'small'; label?: string }) {
  const seen: Record<string, number> = {};
  return (
    <div className={`scene-box scene-box-${size}`} role="img" aria-label={label ?? 'Escena'}>
      {actors.map((a) => {
        const n = (seen[a.e] = (seen[a.e] ?? 0) + 1);
        return <span key={`${a.e}-${n}`} className="actor" aria-hidden="true" style={{ left: `${a.x}%`, top: `${a.y}%`, zIndex: 10 + (a.z ?? 0), transform: `translate(-50%, -50%) scale(${a.s ?? 1})` }}>{a.e}</span>;
      })}
    </div>
  );
}

/** Mira (D-084): la escena cambia sola, frase a frase, con su voz. Primero se enseña; después se juega. */
function Watch({ unit, onNext }: { unit: SessionUnit; onNext: () => void }) {
  const examples = stagedOf(unit);
  const order = useMemo(() => stagedExamples(unit), [unit]);
  const [at, setAt] = useState(0);
  const [round, setRound] = useState(0);
  const ex = examples[order[at]!]!;
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      void Promise.all([speak(ex.text, unit.language, 0.85), wait(2200)]).then(() => {
        if (alive && at < order.length - 1) setAt(at + 1);
      });
    }, at === 0 ? 450 : 250);
    return () => { alive = false; window.clearTimeout(t); };
  }, [at, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = at === order.length - 1;
  return (
    <Slide tone={hue(unit.key)} onNext={onNext}>
      <p className="tag">👀 MIRA CÓMO CAMBIA</p>
      <Stage actors={ex.stage!} label={ex.text} />
      <p className="stage-say" lang={unit.language} aria-live="polite"><b>{ex.text}</b></p>
      {ex.translation && <p className="stage-es">{ex.translation}</p>}
      <div className="stage-dots" aria-hidden="true">{order.map((n, i) => <span key={n} className={i === at ? 'on' : i < at ? 'past' : ''} />)}</div>
      {done && <button type="button" className="option ghost stage-again" onClick={() => { setAt(0); setRound((r) => r + 1); }}>↻ Otra vez</button>}
    </Slide>
  );
}

/**
 * ¿Dónde está? (D-084): oyes la frase y tocas su escena entre tres (reconocer al escuchar) o, al revés, ves la escena y
 * eliges la frase (reconocer). Practica «recordar» con poco peso: elegir no es producir (regla 9).
 */
function Spot({ unit, example, reverse, onResult }: { unit: SessionUnit; example: number; reverse: boolean; onResult: (ok: boolean, ms: number) => void }) {
  const examples = stagedOf(unit);
  const ex = examples[example]!;
  const options = useMemo(() => {
    const others = stagedExamples(unit).filter((n) => n !== example);
    const picked = choicesFor(String(example), others.map(String), `${unit.key}-spot-${example}-${reverse}`, 3);
    return picked.map((c) => ({ n: Number(c.label), correct: c.correct }));
  }, [unit, example, reverse]);
  const [picked, setPicked] = useState<number | null>(null);
  const t0 = useRef(performance.now());
  const play = () => speak(ex.text, unit.language, 0.85);
  useEffect(() => { if (!reverse) void play(); }, [unit, example]); // eslint-disable-line react-hooks/exhaustive-deps
  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = options[i]!.correct;
    const ms = Math.round(performance.now() - t0.current);
    const voice = ok && audioEnabled() ? speak(ex.text, unit.language, 0.85) : Promise.resolve();
    void Promise.all([voice, wait(ok ? 900 : 1300)]).then(() => onResult(ok, ms));
  }
  const state = (i: number) => (picked === null ? '' : options[i]!.correct ? 'is-right' : picked === i ? 'is-wrong' : 'is-off');
  return (
    <Slide tone={hue(unit.key)} className={picked === null ? '' : options[picked]!.correct ? 'right' : 'wrong'}>
      <p className="tag">{reverse ? '🔎 ¿QUÉ PASA AQUÍ?' : '👂 ¿DÓNDE ESTÁ?'}</p>
      {reverse ? (
        <>
          <Stage actors={ex.stage!} label="Escena" />
          <div className="options">
            {options.map((o, i) => <button type="button" key={o.n} data-n={o.n} lang={unit.language} className={`option long ${state(i)}`} onClick={() => pick(i)}>{examples[o.n]!.text}</button>)}
          </div>
        </>
      ) : (
        <>
          <button type="button" className="listen-play" aria-label="Escuchar otra vez" onClick={() => void play()}>🔊</button>
          <h3 className="ask" lang={unit.language}>{picked === null ? 'Toca la escena que oyes' : <b>{ex.text}</b>}</h3>
          <div className="stage-options">
            {options.map((o, i) => (
              <button type="button" key={o.n} data-n={o.n} className={`stage-option ${state(i)}`} aria-label={`Escena ${i + 1}`} onClick={() => pick(i)}>
                <Stage actors={examples[o.n]!.stage!} size="small" />
              </button>
            ))}
          </div>
        </>
      )}
    </Slide>
  );
}

/** Versos que se oyen antes de que contestes tú en «La cadena». */
const CHANT_SHOWN = 2;

/**
 * La cadena (D-085): pregunta y respuesta con ritmo, cambiando solo el emoji (Is this a cat? No, it isn't. It's a dog).
 * Los primeros versos se oyen enteros; en los demás suena la pregunta y eliges la respuesta. Un fallo no corta la
 * canción: se ve la buena y sigue. Al terminar cuenta como acierto solo si no ha fallado ningún eslabón.
 */
function Chant({ unit, onResult }: { unit: SessionUnit; onResult: (ok: boolean, ms: number) => void }) {
  const verses = useMemo(() => chantOf(unit), [unit]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<'q' | 'a' | 'pick' | 'end'>('q');
  const [picked, setPicked] = useState<number | null>(null);
  const [marks, setMarks] = useState<Array<'ok' | 'ko' | 'seen'>>([]);
  const t0 = useRef(performance.now());
  const v = verses[Math.min(at, verses.length - 1)]!;
  const yours = at >= CHANT_SHOWN;
  const options = useMemo(() => choicesFor(v.a, verses.map((x) => x.a), `${unit.key}-chant-${at}`, 3), [unit, at]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = (mark: 'ok' | 'ko' | 'seen') => {
    const all = [...marks, mark];
    setMarks(all); setPicked(null);
    if (at + 1 < verses.length) { setAt(at + 1); setPhase('q'); return; }
    setPhase('end');
    const ok = !all.includes('ko');
    const ms = Math.round(performance.now() - t0.current);
    void wait(ok ? 1100 : 1400).then(() => onResult(ok, ms));
  };
  useEffect(() => {
    let alive = true;
    if (phase === 'q') {
      void Promise.all([speak(v.q, unit.language, 0.9), wait(yours ? 700 : 1100)]).then(() => { if (alive) setPhase(yours ? 'pick' : 'a'); });
    } else if (phase === 'a') {
      void Promise.all([speak(v.a, unit.language, 0.9), wait(1200)]).then(() => { if (alive) next('seen'); });
    }
    return () => { alive = false; };
  }, [at, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  function pick(i: number) {
    if (picked !== null || phase !== 'pick') return;
    setPicked(i);
    const ok = options[i]!.correct;
    void Promise.all([speak(v.a, unit.language, 0.9), wait(ok ? 900 : 1500)]).then(() => next(ok ? 'ok' : 'ko'));
  }
  const state = (i: number) => (picked === null ? '' : options[i]!.correct ? 'is-right' : picked === i ? 'is-wrong' : 'is-off');
  const done = phase === 'end';
  const clean = done && !marks.includes('ko');
  return (
    <Slide tone={hue(unit.key)} className={done ? (clean ? 'right' : 'wrong') : ''}>
      <p className="tag">🎵 LA CADENA{yours ? ' · TE TOCA' : ' · ESCUCHA'}</p>
      <div className="chant-links" aria-label={`Eslabón ${Math.min(at + 1, verses.length)} de ${verses.length}`}>
        {verses.map((_, i) => <span key={i} className={marks[i] ?? (i === at && !done ? 'now' : '')}>{i < CHANT_SHOWN ? '♪' : '🔗'}</span>)}
      </div>
      {done ? (
        <h3 className="chant-done">{clean ? '¡Cadena completa! 🎉' : `${marks.filter((m) => m === 'ok').length} de ${verses.length - CHANT_SHOWN} eslabones`}</h3>
      ) : (
        <>
          <div key={at} className="chant-emoji" aria-hidden="true">{v.e}</div>
          <h3 className="chant-q" lang={unit.language}>{v.q}</h3>
          {phase === 'a' && <p className="chant-a" lang={unit.language}>{v.a}</p>}
          {(phase === 'a' || picked !== null) && v.es && <p className="stage-es">{v.es}</p>}
          {phase === 'pick' && (
            <div className="options">
              {options.map((o, i) => <button type="button" key={o.label} data-ok={o.correct ? '1' : '0'} lang={unit.language} className={`option long ${state(i)}`} onClick={() => pick(i)}>{o.label}</button>)}
            </div>
          )}
        </>
      )}
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

const wait = (ms: number) => new Promise<void>((r) => { window.setTimeout(r, ms); });

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
  const ex = (sentencesOf(unit) as Array<{ text: string; translation?: string; mirror?: Mirror }>)[example]!;
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
    const ms = Math.round(performance.now() - t0.current);
    spent.current = ms;
    // Acierto: suena la frase y pasa sola. Fallo (D-086): la tarjeta se queda quieta y explica en qué te has equivocado;
    // se sigue deslizando, y después llega la ficha para repasar.
    if (!ok) return;
    const voice = audioEnabled() ? speak(ex.text, unit.language) : Promise.resolve();
    void Promise.all([voice, wait(1100)]).then(() => onResult(true, ms, '', help ? 2 : 1));
  }, [chosen]); // eslint-disable-line react-hooks/exhaustive-deps
  const spent = useRef(0);
  const answer = chosen.map((i) => bank[i]!.w);
  const mistake = done === false ? buildMistake(answer, words, ex.mirror, ex.text) : null;
  // D-088: la regla de orden que se ha roto (lo que describe va delante…) y, en los trucos, su regla.
  const rule = mistake?.rule ?? (unit.type === 'pattern' ? (unit.payload as PatternPayload).rule : undefined);
  const failNext = () => onResult(false, spent.current, `Tu frase: «${answer.join(' ')}». Así es: «${ex.text}» (${ex.translation}).${mistake?.rule ? ` ${mistake.rule}` : ''}`, help ? 2 : 1);
  const toggle = (i: number) => { if (done !== null) return; setChosen((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i])); };

  // Arrastre tipo imán: se arrastra una pieza con el dedo y, sobre la frase, se abre un hueco donde caerá (las demás se
  // apartan). Soltar fuera de la frase la devuelve. Un toque sin mover sigue funcionando como siempre.
  const line = useRef<HTMLDivElement>(null);
  const lineTiles = useRef<Record<number, HTMLElement | null>>({});
  const [drag, setDrag] = useState<{ tile: number; from: 'bank' | 'line'; x: number; y: number; moved: boolean } | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const slotAt = (x: number, y: number, dragged: number): number | null => {
    const box = line.current?.getBoundingClientRect();
    if (!box || x < box.left - 24 || x > box.right + 24 || y < box.top - 36 || y > box.bottom + 36) return null;
    const others = chosen.filter((i) => i !== dragged);
    for (const [n, i] of others.entries()) {
      const r = lineTiles.current[i]?.getBoundingClientRect();
      if (!r) continue;
      if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return n;
    }
    return others.length;
  };
  const down = (tile: number, from: 'bank' | 'line') => (e: React.PointerEvent) => {
    if (done !== null) return;
    // Cada toque nuevo empieza limpio: si el arrastre anterior no generó «click», no hay que tragarse este.
    skipClick.current = false;
    origin.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ tile, from, x: e.clientX, y: e.clientY, moved: false });
  };
  const moveTile = (e: React.PointerEvent) => {
    if (!drag || !origin.current) return;
    const moved = drag.moved || Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 8;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
    if (moved) { const g = slotAt(e.clientX, e.clientY, drag.tile); if (g !== gap) { setGap(g); if (g !== null) buzz(6); } }
  };
  const up = (e: { clientX: number; clientY: number }) => {
    if (!drag) return;
    if (drag.moved) {
      skipClick.current = true;
      const g = slotAt(e.clientX, e.clientY, drag.tile);
      setChosen((c) => {
        const rest = c.filter((i) => i !== drag.tile);
        if (g === null) return drag.from === 'line' ? rest : c;
        sfx('pop');
        return [...rest.slice(0, g), drag.tile, ...rest.slice(g)];
      });
    }
    setDrag(null); setGap(null); origin.current = null;
  };
  // Red de seguridad: si el dedo se levanta fuera de la pieza (o el navegador pierde la captura), el arrastre acaba igual.
  useEffect(() => {
    if (!drag) return;
    const end = (e: PointerEvent) => up(e);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (i: number) => () => { if (skipClick.current) { skipClick.current = false; return; } toggle(i); };
  const dragging = drag?.moved ? drag : null;
  // La pieza arrastrada desde la frase se queda en su sitio, apagada (si se quitara del DOM, el dedo perdería la pieza);
  // el hueco se abre delante de la pieza donde caerá.
  const others = chosen.filter((i) => !(dragging && dragging.tile === i));
  const gapBefore = gap === null || !dragging ? null : gap < others.length ? others[gap]! : 'end';
  const shown: Array<number | 'gap'> = chosen.flatMap((i) => (gapBefore === i ? ['gap' as const, i] : [i]));
  if (gapBefore === 'end') shown.push('gap');
  const handlers = (i: number, from: 'bank' | 'line') => ({ onPointerDown: down(i, from), onPointerMove: moveTile, onClick: tap(i) });
  return (
    <Slide tone={hue(unit.key)} className={`build ${done === null ? '' : done ? 'right' : 'wrong'}`} {...(done === false ? { onNext: failNext } : {})}>
      <p className="tag">🧩 CONSTRUYE LA FRASE</p>
      <h3 className="ask build-es">«{ex.translation}»</h3>
      {ex.mirror && done === null && (help
        ? <MirrorAnim unit={unit} m={ex.mirror} text={ex.text} compact />
        : <button type="button" className="train-help" onClick={() => setHelp(true)}>🪞 ¿Cómo se construye?</button>)}
      {mistake ? (
        <div className="build-why" lang={unit.language}>
          <p className="learn-label">TU FRASE</p>
          <div className="build-cmp" aria-label="Tu frase">{answer.map((w, i) => <span key={i} className={`tile cmp ${mistake.wrong.includes(i) ? 'ko' : 'ok'}`}>{w}</span>)}</div>
          <p className="learn-label">ASÍ ES</p>
          <div className="build-cmp" aria-label="La frase correcta">{words.map((w, i) => <span key={i} className={`tile cmp ${mistake.wrong.includes(i) ? 'fix' : ''}`}>{w}</span>)}</div>
          <p className="build-reason" lang="es">{mistake.reason}</p>
          {rule && <p className="build-rule" lang="es">📏 {rule}</p>}
        </div>
      ) : <>
      <div ref={line} className={`build-line ${dragging && gap !== null ? 'magnet' : ''}`} aria-label="Tu frase" lang={unit.language}>
        {shown.length
          ? shown.map((i) => (i === 'gap'
            ? <span key="gap" className="tile-gap" aria-hidden="true" />
            : <button type="button" key={i} ref={(el) => { lineTiles.current[i] = el; }} className={`tile on ${dragging?.tile === i ? 'lifted' : ''}`} {...handlers(i, 'line')}>{bank[i]!.w}</button>))
          : <span className="build-empty">Toca o arrastra las palabras en orden</span>}
      </div>
      <div className="build-bank" lang={unit.language}>
        {bank.map((b, i) => <button type="button" key={i} className={`tile ${dragging?.tile === i ? 'lifted' : ''}`} disabled={chosen.includes(i)} {...handlers(i, 'bank')}>{b.w}</button>)}
      </div>
      {/* La pieza que sigue al dedo va fuera de la tarjeta: dentro rompería el centrado (:last-child) y movería la frase. */}
      {dragging && createPortal(<span className="tile tile-ghost" style={{ left: dragging.x, top: dragging.y }} aria-hidden="true">{bank[dragging.tile]!.w}</span>, document.body)}
      </>}
    </Slide>
  );
}

/**
 * En qué te has equivocado al construir la frase (D-086): qué posiciones están mal y una explicación corta. Las
 * fichas son las palabras de la frase, así que el fallo siempre es de orden: se dice qué pieza va antes.
 */
export function buildMistake(answer: string[], words: string[], mirror?: Mirror, text = ''): { wrong: number[]; reason: string; rule?: string } {
  const same = (a?: string, b?: string) => plain(a ?? '') === plain(b ?? '');
  const wrong = words.flatMap((w, i) => (same(answer[i], w) ? [] : [i]));
  const i = wrong[0];
  if (i === undefined) return { wrong, reason: '' };
  const put = answer[i]!;
  const should = words[i]!;
  const later = words.findIndex((w, j) => j > i && same(w, put));
  let reason = later > i
    ? `Tienes las palabras bien, pero no el orden: «${should}» va antes que «${put}».`
    : `En ese hueco va «${should}», no «${put}».`;
  // D-088: si has puesto el inglés en el orden del español, se dice tal cual, con el trozo que cambia y su regla.
  const rule = mirror ? orderRule(mirror, text)?.text : undefined;
  const swap = mirror ? orderSwap(mirror) : null;
  if (mirror && swap && same(answer.join(' '), spanishOrderCalque(mirror))) reason = `Has seguido el orden del español («${swap.es}»). En inglés va así: «${swap.en}».`;
  return { wrong, reason, ...(rule ? { rule } : {}) };
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
  // Con «Reducir movimiento» (muy común en iPhone) antes se saltaba al final y había que pulsar ↻ para verlo: ahora la
  // secuencia se ve igual, paso a paso, solo que sin saltos ni arcos (usuario, 29-oct-2026).
  const [phase, setPhase] = useState(0);
  const [run, setRun] = useState(0);
  const [lit, setLit] = useState(-1);
  const done = phase > last;
  const chips = useRef<Record<number, HTMLElement | null>>({});
  const rects = useRef<Record<number, DOMRect>>({});
  // El ejemplo empieza solo cuando se VE (en pantalla y con la app delante): antes arrancaba al montarse la tarjeta y,
  // mientras leías el título o con la tarjeta más abajo, acababa sin que lo vieras y había que pulsar ↻ (usuario, 29-oct).
  const box = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e && e.isIntersecting && e.intersectionRatio >= 0.55) && document.visibilityState === 'visible'), { threshold: 0.6 });
    io.observe(el);
    const vis = () => { if (document.visibilityState !== 'visible') setInView(false); else { io.unobserve(el); io.observe(el); } };
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  useEffect(() => {
    if (done || !inView) return;
    const t = setTimeout(() => setPhase((p) => p + 1), MORPH_MS[phase]);
    return () => clearTimeout(t);
  }, [phase, done, run, inView]);
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
    : phase === 3 ? (helperJumps ? '¡El ayudante salta delante!' : jumps ? '¡En inglés, la pieza salta!' : '¡Ya lo dices en inglés!')
    : null;
  const tap = () => { if (done) { rects.current = {}; setPhase(0); setRun((r) => r + 1); } else setPhase(last + 1); };
  return (
    <div ref={box} className={`morph ${compact ? 'compact' : ''}`} onClick={tap} role="button" tabIndex={0} aria-label={done ? 'Verlo otra vez' : 'Saltar al final'}>
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

/**
 * «Gira las piezas» (D-092): el ejemplo del truco se descubre TÚ. La frase en español sale partida en piezas; piensas
 * cómo se dice cada una y la giras (suena el inglés). Con todas giradas, las piezas se colocan en el orden del inglés
 * (si cambia, la que salta lo hace en arco) y aparece la regla. Enseña: no puntúa.
 */
/** ¿Se ve este elemento (al menos un 55 % en pantalla y con la app delante)? */
function useSeen(box: RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => setSeen(Boolean(e && e.isIntersecting && e.intersectionRatio >= 0.55) && document.visibilityState === 'visible'), { threshold: 0.6 });
    io.observe(el);
    const vis = () => { if (document.visibilityState !== 'visible') setSeen(false); else { io.unobserve(el); io.observe(el); } };
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, [box]);
  return seen;
}

/** Si no tocas, el ejemplo se gira solo: la primera pieza a los FLIP_FIRST_MS (para pensarla) y las demás cada
 * FLIP_IDLE_MS. Nunca hace falta un botón para verlo. */
const FLIP_FIRST_MS = 2200;
const FLIP_IDLE_MS = 1300;

function FlipMirror({ unit, m, text }: { unit: SessionUnit; m: Mirror; text: string }) {
  const order = useMemo(() => m.order ?? m.pieces.map((_, i) => i), [m]);
  const jumps = order.some((v, i) => v !== i);
  const flippable = useMemo(() => m.pieces.flatMap((p, i) => (p.role === 'signal' ? [] : [i])), [m]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [stage, setStage] = useState<'flip' | 'move' | 'done'>('flip');
  const [run, setRun] = useState(0);
  const chips = useRef<Record<number, HTMLElement | null>>({});
  const rects = useRef<Record<number, DOMRect>>({});
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const all = flippable.every((i) => flipped.includes(i));
  // Empieza solo (usuario, 29-oct: «todo debería iniciar con el ejemplo sin darle al botón»): si al verlo no tocas,
  // las piezas se giran solas una a una; tocar cualquiera adelanta. Mientras no se ve, espera.
  const box = useRef<HTMLDivElement>(null);
  const seen = useSeen(box);
  useEffect(() => {
    if (stage !== 'flip' || all || !seen) return;
    const t = setTimeout(() => { const next = flippable.find((i) => !flipped.includes(i)); if (next !== undefined) flip(next); }, flipped.length ? FLIP_IDLE_MS : FLIP_FIRST_MS);
    return () => clearTimeout(t);
  }, [flipped, stage, seen, run]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stage !== 'flip' || !all) return;
    const t = setTimeout(() => { setStage('move'); sfx(jumps ? 'boing' : 'whoosh'); }, 650);
    return () => clearTimeout(t);
  }, [all, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stage !== 'move') return;
    const t = setTimeout(() => { setStage('done'); if (audioEnabled()) speak(text, unit.language); }, jumps ? 950 : 350);
    return () => clearTimeout(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = useRef(stage);
  useLayoutEffect(() => {
    const moving = last.current === 'flip' && stage === 'move';
    last.current = stage;
    for (const [k, el] of Object.entries(chips.current)) {
      if (!el) continue;
      const now = el.getBoundingClientRect();
      const before = rects.current[Number(k)];
      rects.current[Number(k)] = now;
      if (!before || !moving || reduced) continue;
      const dx = before.left - now.left; const dy = before.top - now.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
      el.animate(dx > 0 ? [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: `translate(${dx / 2}px, ${dy / 2 - 50}px) rotate(-8deg) scale(1.1)`, offset: 0.5 }, { transform: 'none' }]
        : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 800, easing: 'cubic-bezier(.3, 1.2, .5, 1)' });
    }
  });
  function flip(i: number) {
    if (stage !== 'flip' || flipped.includes(i)) return;
    setFlipped((f) => [...f, i]);
    sfx('pop');
    if (audioEnabled()) speak(m.pieces[i]!.en, unit.language);
  }
  const again = () => { rects.current = {}; setFlipped([]); setStage('flip'); setRun((r) => r + 1); };
  const english = stage !== 'flip';
  const shown = english ? order : flippable;
  const own = m.pieces.find((p) => p.why);
  const rule = own?.why ?? orderRule(m, text)?.text;
  return (
    <div className="morph flipm" key={run} ref={box}>
      <p className="flip-say">{m.say}</p>
      <p className="morph-cap" aria-live="polite">{stage === 'flip' ? <>🤔 Piensa cómo se dice cada pieza y <b>gírala</b> ({flipped.length}/{flippable.length})</> : jumps ? <>¡En inglés el <b>orden cambia</b>!</> : <>Mismo orden que en español 👍</>}</p>
      <div className="morph-row" lang={english ? unit.language : 'es'}>
        {shown.map((i) => {
          const p = m.pieces[i]!;
          const isFlipped = english || flipped.includes(i);
          return (
            <button type="button" key={`f${i}`} ref={(el) => { chips.current[i] = el; }} className={`mchip flipchip role-${p.role} ${p.role === 'signal' ? 'grow' : ''} ${!isFlipped ? 'todo' : ''}`} onClick={(e) => { e.stopPropagation(); flip(i); }} aria-label={isFlipped ? p.en : `Girar «${p.es}»`}>
              <span className={`mface ${isFlipped ? 'flipped' : ''}`}>
                <span className="front">{p.ghost && <i className="ghost-tag" aria-hidden="true">👻</i>}<b>{p.es}</b><small>toca ↻</small></span>
                <span className="back"><b>{p.role === 'signal' ? `🚦 ${p.en}` : p.en}</b><small>{p.role === 'signal' ? 'semáforo' : p.es}</small></span>
              </span>
            </button>
          );
        })}
      </div>
      {stage === 'flip' && <button type="button" className="link flip-all" onClick={(e) => { e.stopPropagation(); setFlipped(flippable); }}>Girar todas</button>}
      {stage === 'done' && (
        <>
          {jumps && rule && <p className="why">📏 {rule}</p>}
          <div className="morph-end">
            <p className="train-final" lang={unit.language}>{text}</p>
            {audioEnabled() && <button type="button" className="say" aria-label="Escuchar" onClick={(e) => { e.stopPropagation(); speak(text, unit.language); }}>🔊</button>}
            <button type="button" className="morph-again" aria-label="Otra vez" onClick={(e) => { e.stopPropagation(); again(); }}>↻</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Orden estable que no deja las fichas ya ordenadas (si no, no habría nada que hacer). */
function scrambled<T>(items: T[], seed: string): T[] {
  const out = [...items].sort((a, b) => hue(`${seed}${String(a)}`) - hue(`${seed}${String(b)}`));
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

/**
 * «Las piezas» (D-092): practicar una frase por trozos antes de construirla palabra a palabra. Primero, si el inglés
 * cambia el orden, «¿Qué pieza se adelanta?» (fijarse en lo que salta); si no, «¿Cuál falta?». Después, ordenar las
 * piezas en inglés. Al fallar, se ve el orden bueno y la regla; si has seguido el orden del español, se dice.
 */
function Pieces({ unit, all, example, seed, onResult }: { unit: SessionUnit; all: Record<string, SessionUnit>; example: number; seed: string; onResult: (ok: boolean, ms: number, note: string) => void }) {
  const ex = (sentencesOf(unit) as Array<{ text: string; translation?: string; mirror?: Mirror }>)[example]!;
  const m = ex.mirror!;
  const isPractice = example >= ((unit.payload as { examples?: unknown[] }).examples ?? []).length;
  const order = useMemo(() => m.order ?? m.pieces.map((_, i) => i), [m]);
  const moved = movedPieces(m);
  const jumper = order.find((i) => moved.includes(i));
  const canJump = jumper !== undefined && m.pieces[jumper]!.role !== 'signal';
  // ¿Cuál falta?: una pieza con contenido, y dos falsas del mismo papel sacadas de otras frases.
  const gap = useMemo(() => {
    if (canJump) return null;
    const candidates = m.pieces.flatMap((p, i) => (!p.ghost && (p.role === 'word' || p.role === 'verb') ? [i] : []));
    const hidden = candidates.length ? candidates[hue(seed) % candidates.length]! : undefined;
    if (hidden === undefined) return null;
    const want = m.pieces[hidden]!;
    const pool = new Set<string>();
    for (const u of Object.values(all)) for (const e of (sentencesOf(u) as Array<{ mirror?: Mirror }>)) for (const p of e.mirror?.pieces ?? []) if (p.role === want.role && p.en.toLowerCase() !== want.en.toLowerCase() && p.en.split(' ').length === want.en.split(' ').length) pool.add(p.en);
    const wrong = [...pool].sort((a, b) => hue(`${seed}${a}`) - hue(`${seed}${b}`)).slice(0, 2);
    return wrong.length === 2 ? { hidden, options: scrambled([want.en, ...wrong], seed) } : null;
  }, [m, all, seed, canJump]);
  const first: 'jump' | 'gap' | 'order' = canJump ? 'jump' : gap ? 'gap' : 'order';
  const [phase, setPhase] = useState<'jump' | 'gap' | 'order'>(first);
  const [pickA, setPickA] = useState<string | null>(null);
  const [okA, setOkA] = useState(true);
  const tiles = useMemo(() => scrambled(order, `${seed}-t`), [order, seed]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [confetti, setConfetti] = useState(0);
  const t0 = useRef(performance.now());
  const rule = m.pieces.find((p) => p.why && moved.includes(m.pieces.indexOf(p)))?.why ?? orderRule(m, ex.text)?.text;
  function answerA(choice: string, good: boolean) {
    if (pickA !== null) return;
    setPickA(choice); setOkA(good);
    if (good) { sfx('ok'); setConfetti((c) => c + 1); } else sfx('ko');
  }
  function place(i: number) {
    if (checked !== null) return;
    const next = [...placed, i];
    setPlaced(next);
    sfx('pop');
    if (next.length === order.length) {
      const good = next.every((x, k) => m.pieces[x]!.en === m.pieces[order[k]!]!.en);
      setChecked(good);
      if (good) { setConfetti((c) => c + 1); sfx('party'); if (audioEnabled()) speak(ex.text, unit.language); } else sfx('ko');
    }
  }
  const spanishOrder = placed.length === order.length && placed.every((x, k) => x === k) && order.some((v, k) => v !== k);
  const finish = () => {
    const ok = okA && Boolean(checked);
    onResult(ok, Math.round(performance.now() - t0.current), ok ? '' : `${spanishOrder ? 'Has seguido el orden del español. ' : ''}En inglés: «${ex.text}».${rule ? ` ${rule}` : ''}`);
  };
  const chip = (i: number, extra = '') => {
    const p = m.pieces[i]!;
    return <><b lang={unit.language}>{p.role === 'signal' ? `🚦 ${p.en}` : p.en}</b><small>{p.role === 'signal' ? 'semáforo' : p.es}{extra}</small></>;
  };
  return (
    <Slide tone={hue(unit.key)} className={`pieces ${checked === null ? '' : checked && okA ? 'right' : checked === false ? 'wrong' : ''}`} {...(checked !== null ? { onNext: finish } : {})}>
      <div className="pieces-body">
      <p className="tag">🧩 LAS PIEZAS · {phase === 'order' ? 'ORDÉNALAS' : phase === 'jump' ? '¿QUÉ PIEZA SE ADELANTA?' : '¿CUÁL FALTA?'}</p>
      <div className="pieces-head">
        <div className="face-emoji small" aria-hidden="true">{unit.association?.emoji ?? '🧩'}</div>
        <p className="pieces-goal">{unit.type === 'pattern' ? (unit.payload as PatternPayload).goal : `${unitText(unit)} · ${(unit.payload as { meaning?: string }).meaning ?? ''}`}</p>
      </div>
      <p className="pieces-new">{isPractice ? '✨ Frase nueva' : 'Frase de la ficha'}</p>
      <h3 className="ask pieces-es">{m.say}</h3>
      {phase === 'jump' && (
        <>
          <p className="pieces-q">En inglés, <b>una pieza se adelanta</b>. ¿Cuál?</p>
          <div className="pieces-row">
            {m.pieces.map((p, i) => (p.role === 'signal' ? null : (
              <button type="button" key={i} className={`ptile role-${p.role} ${pickA === null ? '' : i === jumper ? 'is-right' : pickA === String(i) ? 'is-wrong' : 'is-off'}`} onClick={() => answerA(String(i), i === jumper)}><b>{p.es}</b></button>
            )))}
          </div>
          {pickA !== null && (
            <div className="pieces-after">
              <p className={`tense-verdict ${okA ? 'ok' : 'ko'}`}>{okA ? '¡Eso es! 🎉' : <>Era <b>{m.pieces[jumper!]!.es}</b></>}</p>
              <p className="pieces-jump"><b>{m.pieces[jumper!]!.es}</b> → <b lang={unit.language}>{m.pieces[jumper!]!.en}</b> va antes</p>
              {rule && <p className="why">📏 {rule}</p>}
              <button type="button" className="primary arcade-go" onClick={() => setPhase('order')}>Ahora ordénalas →</button>
            </div>
          )}
        </>
      )}
      {phase === 'gap' && gap && (
        <>
          <p className="pieces-q">¿Qué pieza falta en inglés?</p>
          <div className="pieces-row" lang={unit.language}>
            {order.map((i) => <span key={i} className={`ptile static role-${m.pieces[i]!.role} ${i === gap.hidden ? 'hole' : ''}`}>{i === gap.hidden ? <b>{pickA ?? '＿＿'}</b> : chip(i)}</span>)}
          </div>
          {pickA === null ? (
            <div className="burst-buttons tense-options">{gap.options.map((o, k) => <button type="button" key={o} className={`burst-btn c${k}`} lang={unit.language} onClick={() => answerA(o, o === m.pieces[gap.hidden]!.en)}>{o}</button>)}</div>
          ) : (
            <div className="pieces-after">
              <p className={`tense-verdict ${okA ? 'ok' : 'ko'}`}>{okA ? '¡Eso es! 🎉' : <>Era <b lang={unit.language}>{m.pieces[gap.hidden]!.en}</b> ({m.pieces[gap.hidden]!.es})</>}</p>
              <button type="button" className="primary arcade-go" onClick={() => setPhase('order')}>Ahora ordénalas →</button>
            </div>
          )}
        </>
      )}
      {phase === 'order' && (
        <>
          <p className="pieces-q">Toca las piezas en el orden del <b>inglés</b>.</p>
          <div className={`pieces-slots ${checked === null ? '' : checked ? 'ok' : 'ko'}`} lang={unit.language} aria-label="Tu frase">
            {order.map((_, k) => {
              const i = placed[k];
              return i === undefined ? <span key={k} className="pslot" /> : <button type="button" key={k} className={`ptile role-${m.pieces[i]!.role}`} onClick={() => { if (checked === null) setPlaced((pl) => pl.filter((_, j) => j !== k)); }}>{chip(i)}</button>;
            })}
          </div>
          {checked === null ? (
            <div className="pieces-row">{tiles.map((i) => <button type="button" key={i} className={`ptile role-${m.pieces[i]!.role} ${placed.includes(i) ? 'used' : ''}`} disabled={placed.includes(i)} onClick={() => place(i)}>{chip(i)}</button>)}</div>
          ) : (
            <div className="pieces-after">
              <p className={`tense-verdict ${checked ? 'ok' : 'ko'}`}>{checked ? '¡Perfecto! 🎉' : spanishOrder ? 'Has seguido el orden del español' : 'Casi…'}</p>
              {!checked && <div className="pieces-row good" lang={unit.language}>{order.map((i) => <span key={i} className={`ptile static role-${m.pieces[i]!.role} ${moved.includes(i) ? 'jumped' : ''}`}>{chip(i)}</span>)}</div>}
              <p className="train-final" lang={unit.language}>{ex.text}</p>
              {ex.translation && <p className="tense-es">{ex.translation}</p>}
              {rule && order.some((v, k) => v !== k) && <p className="why">📏 {rule}</p>}
              <button type="button" className="primary arcade-go" onClick={finish}>Seguir →</button>
            </div>
          )}
        </>
      )}
      </div>
      <Confetti burst={confetti} />
    </Slide>
  );
}

/** Sesiones guardadas con la tarjeta antigua del tren: se muestra la animación en un paso. */
function Train({ unit, example, onNext }: { unit: SessionUnit; example: number; onNext: () => void }) {
  const ex = (sentencesOf(unit) as Array<{ text: string; mirror?: Mirror }>)[example]!;
  return (
    <Slide tone={hue(unit.key)} onNext={onNext} className="train">
      <p className="tag">🪞 CÓMO SE CONSTRUYE</p>
      <FlipMirror unit={unit} m={ex.mirror!} text={ex.text} />
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

/** Pasado este tiempo preparando la siguiente ronda, se ofrece reintentar. */
const NEXT_SLOW_MS = 10000;

/** Segundos por pregunta del Arcade sorpresa (D-087). */
const ARCADE_MS = 5000;

/**
 * Arcade sorpresa (D-087): una ráfaga contrarreloj de lo YA aprendido, en mitad del Flujo, para romper la monotonía.
 * 5 s por pregunta con la cuenta atrás bien visible, combo, puntos y confeti. Un fallo no corta el juego ni manda a la
 * ficha: se ve la respuesta buena y sigue; vuelve en su repaso.
 */
type ArcadeQ = { kind: 'word'; unit: SessionUnit; inverse: boolean } | { kind: 'judge'; unit: SessionUnit; text: string; right: string; wrong: boolean; rule?: string };

/** Las preguntas del Arcade: palabras y, intercaladas, frases «¿Está bien dicho?» (D-088). */
function arcadeQuestions(units: SessionUnit[], grammar: Array<{ unitKey: string; example: number; wrong: boolean }>, all: Record<string, SessionUnit>): ArcadeQ[] {
  const words: ArcadeQ[] = units.map((u, i) => ({ kind: 'word', unit: u, inverse: i % 2 === 1 }));
  const judges: ArcadeQ[] = grammar.flatMap((g) => {
    const u = all[g.unitKey];
    const ex = (u?.payload as { examples?: Array<{ text: string; mirror?: Mirror }> } | undefined)?.examples?.[g.example];
    if (!u || !ex?.mirror) return [];
    const end = /[?!]$/.test(ex.text.trim()) ? ex.text.trim().slice(-1) : '.';
    const calque = spanishOrderCalque(ex.mirror);
    const text = g.wrong ? `${calque.charAt(0).toUpperCase()}${calque.slice(1)}${end}` : ex.text;
    const rule = orderRule(ex.mirror, ex.text)?.text;
    return [{ kind: 'judge' as const, unit: u, text, right: ex.text, wrong: g.wrong, ...(rule ? { rule } : {}) }];
  });
  const out: ArcadeQ[] = [];
  while (words.length || judges.length) { if (words.length) out.push(words.shift()!); if (judges.length) out.push(judges.shift()!); }
  return out;
}

function FlowArcade({ units, grammar = [], all, seed, onAnswer, onDone }: { units: SessionUnit[]; grammar?: Array<{ unitKey: string; example: number; wrong: boolean }>; all: Record<string, SessionUnit>; seed: string; onAnswer: (u: SessionUnit, ok: boolean, ms: number, context: string) => void; onDone: () => void }) {
  const questions = useMemo(() => arcadeQuestions(units, grammar, all), [units, grammar, all]);
  const [i, setI] = useState(-1);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(ARCADE_MS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [right, setRight] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const t0 = useRef(performance.now());
  const q = i >= 0 ? questions[i] : undefined;
  const label = (x: SessionUnit, inverse: boolean) => (inverse ? unitText(x).toUpperCase() : unitMeaning(x));
  const choices = useMemo(() => {
    if (!q) return [];
    if (q.kind === 'judge') return [{ label: '✅ Bien dicho', correct: !q.wrong }, { label: '❌ Mal dicho', correct: q.wrong }];
    return choicesFor(label(q.unit, q.inverse), units.map((x) => label(x, q.inverse)), `${seed}-arcade-${i}`, 3);
  }, [q, i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!q || picked !== null) return;
    t0.current = performance.now();
    setLeft(ARCADE_MS);
    const tick = window.setInterval(() => setLeft(Math.max(0, ARCADE_MS - (performance.now() - t0.current))), 100);
    return () => window.clearInterval(tick);
  }, [i, picked]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (q && picked === null && left <= 0) pick(-1); });
  function pick(k: number) {
    if (!q || picked !== null) return;
    const ok = k >= 0 && choices[k]!.correct;
    setPicked(k);
    onAnswer(q.unit, ok, Math.round(performance.now() - t0.current), q.kind === 'judge' ? 'judge' : 'arcade');
    if (ok) {
      const c = combo + 1;
      setCombo(c); setBest((b) => Math.max(b, c)); setRight((r) => r + 1); setConfetti((n) => n + 1);
      setScore((sc) => sc + Math.round((100 + (left / 1000) * 20) * Math.min(3, 1 + (c - 1) * 0.5)));
    } else setCombo(0);
    // En las frases se deja leer la regla; el reloj se repone ANTES de pasar (si no, la siguiente nacía a 0 s).
    const hold = q.kind === 'judge' ? (ok ? 1800 : 3200) : ok ? 600 : 1500;
    window.setTimeout(() => { setLeft(ARCADE_MS); setPicked(null); setI((n) => n + 1); }, hold);
  }
  if (i < 0) {
    return (
      <Slide tone={45} className="arcade-intro" onNext={() => setI(0)}>
        <p className="tag">⚡ ARCADE SORPRESA</p>
        <div className="arcade-big" aria-hidden="true">🕹️</div>
        <h2 className="ask">¡Ráfaga de lo que ya sabes!</h2>
        <p className="arcade-rules">{questions.length} preguntas · 5 segundos cada una · encadena aciertos para multiplicar{grammar.length ? ' · y frases: ¿bien o mal dicho?' : ''}</p>
        <button type="button" className="primary arcade-go" onClick={() => setI(0)}>¡Jugar! ⚡</button>
      </Slide>
    );
  }
  if (!q) {
    return (
      <Slide tone={45} className="arcade-end" onNext={onDone}>
        <p className="tag">⚡ FIN DEL ARCADE</p>
        <div className="arcade-score">{score}</div>
        <p className="arcade-rules">puntos · {right}/{questions.length} aciertos{best > 1 ? ` · mejor combo ×${best}` : ''}</p>
        <p className="arcade-rules muted">{right === questions.length ? '¡Perfecto! 🏆' : 'Lo que fallaste vuelve en tu repaso.'}</p>
        <Confetti burst={right === questions.length ? 99 : 0} />
      </Slide>
    );
  }
  const secs = Math.ceil(left / 1000);
  const state = (k: number) => (picked === null ? '' : choices[k]!.correct ? 'is-right' : picked === k ? 'is-wrong' : 'is-off');
  return (
    <Slide tone={45} className={`arcade-play ${picked === null ? '' : picked >= 0 && choices[picked]!.correct ? 'right' : 'wrong'}`}>
      <div className="arcade-head">
        <p className="tag">⚡ ARCADE · {i + 1}/{questions.length}</p>
        <span className="arcade-pts">{score} pts{combo > 1 ? <b> · 🔥 ×{Math.min(3, 1 + (combo - 1) * 0.5)}</b> : null}</span>
      </div>
      <div className={`arcade-clock ${secs <= 2 ? 'hurry' : ''}`} role="timer" aria-label={`Quedan ${secs} segundos`}>
        <span className="arcade-secs">{secs}</span>
        <div className="arcade-bar"><i style={{ width: `${(left / ARCADE_MS) * 100}%` }} /></div>
      </div>
      {q.kind === 'judge' && <p className="arcade-kind">🧩 ¿Está bien dicho?</p>}
      <h3 className="ask arcade-prompt" lang={q.kind === 'word' && q.inverse ? undefined : q.unit.language}>{q.kind === 'judge' ? q.text : q.inverse ? unitMeaning(q.unit) : unitText(q.unit)}</h3>
      <div className={`options ${q.kind === 'judge' ? 'arcade-judge' : ''}`}>
        {choices.map((c, k) => <button type="button" key={c.label} data-ok={c.correct ? '1' : '0'} className={`option ${state(k)}`} onClick={() => pick(k)} lang={q.kind === 'word' && q.inverse ? q.unit.language : undefined}>{c.label}</button>)}
      </div>
      <div className="arcade-after" aria-live="polite">
        {picked === -1 && <p className="arcade-late">⏰ ¡Se acabó el tiempo!</p>}
        {picked !== null && q.kind === 'judge' && (
          <div className="arcade-why">
            {q.wrong && <p>Así se dice: <b lang={q.unit.language}>{q.right}</b></p>}
            {q.rule && <p className="arcade-rule">📏 {q.rule}</p>}
          </div>
        )}
      </div>
      <Confetti burst={confetti} />
    </Slide>
  );
}

/** La frase del juego con su hueco: el verbo base entre paréntesis, apagado, y la pista resaltada si toca. */
function DrillText({ text, signal, show, fill, lang }: { text: string; signal?: string; show: boolean; fill: string | null; lang: string }) {
  const mark = (part: string, k: string): ReactNode[] => {
    const pieces: ReactNode[] = [];
    const lower = part.toLowerCase();
    const at = show && signal ? lower.indexOf(signal.toLowerCase()) : -1;
    const chunks = at < 0 ? [part] : [part.slice(0, at), part.slice(at, at + signal!.length), part.slice(at + signal!.length)];
    chunks.forEach((c, j) => {
      if (at >= 0 && j === 1) { pieces.push(<mark key={`${k}s`} className="drill-signal">{c}</mark>); return; }
      c.split(/(\([^)]*\))/).forEach((t, n) => { if (t && !(fill && /^\(/.test(t))) pieces.push(/^\(/.test(t) ? <small key={`${k}${j}${n}`} className="drill-verb">{t}</small> : <Fragment key={`${k}${j}${n}`}>{t}</Fragment>); });
    });
    return pieces;
  };
  const [before = '', after = ''] = text.split('___');
  return <h3 className="ask drill-text" lang={lang}>{mark(before, 'a')}<span className={`drill-gap ${fill ? 'filled' : ''}`}>{fill ?? '＿＿＿'}</span>{mark(after, 'b')}</h3>;
}

/** Orden estable de las opciones (la misma partida, el mismo orden al reanudar). */
const stableOrder = (items: string[], seed: string) => [...items].sort((a, b) => hue(`${seed}${a}`) - hue(`${seed}${b}`));

/**
 * «¿Qué tiempo pide?» (D-089): ya enseñado el tiempo, frases con un hueco y su PISTA (yesterday, now, since…). Se elige
 * la forma del verbo entre las de otros tiempos. Sin reloj: aquí se piensa. «🔎 Pista» resalta la palabra clave (da
 * menos puntos). Al responder se ve la pista, el tiempo y su línea; al final, estrellas y tu ruta de los tiempos.
 * Si fallas alguna, la ficha de ese tiempo se enseña otra vez antes de seguir.
 */
function TenseGame({ unit, all, drills, route, seed, onAnswer, onDone }: {
  unit: SessionUnit; all: Record<string, SessionUnit>; drills: Array<{ unitKey: string; drill: number }>; route: string[]; seed: string;
  onAnswer: (u: SessionUnit, ok: boolean, ms: number, drill: number, clue: boolean) => void; onDone: (failed: string | null) => void;
}) {
  const items = useMemo(() => drills.flatMap((d) => { const u = all[d.unitKey]; const x = u ? drillsOf(u)[d.drill] : undefined; return u && x ? [{ u, x, n: d.drill }] : []; }), [drills, all]);
  const tenseOf = (u: SessionUnit) => (u.payload as PatternPayload).tense ?? (u.payload as PatternPayload).goal;
  const total = useMemo(() => Object.values(all).filter((u) => drillsOf(u).length).length, [all]);
  const [i, setI] = useState(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const [clue, setClue] = useState(false);
  const [right, setRight] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const failed = useRef<string[]>([]);
  const t0 = useRef(performance.now());
  const q = i >= 0 ? items[i] : undefined;
  const options = useMemo(() => (q ? stableOrder([q.x.answer, ...q.x.wrong], `${seed}-${i}`) : []), [q, i, seed]);
  useEffect(() => { t0.current = performance.now(); }, [i]);
  function pick(o: string) {
    if (!q || picked !== null) return;
    const ok = o === q.x.answer;
    setPicked(o);
    if (ok) { setRight((r) => r + 1); setConfetti((c) => c + 1); } else failed.current.push(q.u.key);
    onAnswer(q.u, ok, Math.round(performance.now() - t0.current), q.n, clue);
  }
  function next() { setPicked(null); setClue(false); setI((n) => n + 1); }
  const finish = () => onDone(failed.current.includes(unit.key) ? unit.key : failed.current[0] ?? null);
  const routeChips = (
    <div className="tense-route">
      <p>🛤️ Tu ruta de los tiempos: <b>{route.length}</b> de {total}</p>
      <div>{route.map((k) => all[k]).filter((u): u is SessionUnit => Boolean(u)).map((u) => <span key={u.key} className={u.key === unit.key ? 'new' : ''}>{tenseOf(u)}</span>)}</div>
    </div>
  );
  if (i < 0) {
    return (
      <Slide tone={hue(unit.key)} className="tense-intro" onNext={() => setI(0)}>
        <p className="tag">🕰️ ¿QUÉ TIEMPO PIDE?</p>
        <div className="arcade-big" aria-hidden="true">🕵️</div>
        <h2 className="ask">Sé detective: busca la pista</h2>
        <p className="arcade-rules">{items.length} frases · cada una tiene una PISTA (yesterday, now, since…) que te dice qué tiempo pide el verbo.</p>
        {routeChips}
        <button type="button" className="primary arcade-go" onClick={() => setI(0)}>¡Vamos! 🔎</button>
      </Slide>
    );
  }
  if (!q) {
    const stars = right === items.length ? 3 : right >= items.length * 0.66 ? 2 : right > 0 ? 1 : 0;
    return (
      <Slide tone={hue(unit.key)} className="tense-end" onNext={finish}>
        <p className="tag">🕰️ CASO CERRADO</p>
        <div className="tense-stars" aria-label={`${stars} de 3 estrellas`}>{[0, 1, 2].map((k) => <span key={k} className={k < stars ? 'on' : ''}>★</span>)}</div>
        <p className="arcade-rules">{right}/{items.length} frases resueltas{right === items.length ? ' · ¡detective de los tiempos! 🏆' : ''}</p>
        {routeChips}
        {failed.current.length > 0 && <p className="arcade-rules muted">Ahora repasas el tiempo que se te resistió.</p>}
        <button type="button" className="primary arcade-go" onClick={finish}>Seguir →</button>
        <Confetti burst={stars === 3 ? 99 : 0} />
      </Slide>
    );
  }
  const ok = picked === q.x.answer;
  const p = q.u.payload as PatternPayload;
  return (
    <Slide tone={hue(unit.key)} className={`tense-play ${picked === null ? '' : ok ? 'right' : 'wrong'}`} {...(picked !== null ? { onNext: next } : {})}>
      <div className="arcade-head">
        <p className="tag">🕰️ ¿QUÉ TIEMPO PIDE? · {i + 1}/{items.length}</p>
        <span className="arcade-pts">✅ {right}</span>
      </div>
      <DrillText text={q.x.text} {...(q.x.signal ? { signal: q.x.signal } : {})} show={clue || picked !== null} fill={picked === null ? null : q.x.answer} lang={q.u.language} />
      {picked === null ? (
        <>
          <div className={`burst-buttons n${options.length} tense-options`}>
            {options.map((o, k) => <button type="button" key={o} className={`burst-btn c${k}`} lang={q.u.language} onClick={() => pick(o)}>{o}</button>)}
          </div>
          {q.x.signal && !clue && <button type="button" className="tense-clue" onClick={() => setClue(true)}>🔎 Ver la pista</button>}
        </>
      ) : (
        <div className="tense-after" aria-live="polite">
          <p className={`tense-verdict ${ok ? 'ok' : 'ko'}`}>{ok ? '¡Sí! 🎉' : <>Era <b lang={q.u.language}>{q.x.answer}</b> (elegiste «{picked}»)</>}</p>
          {q.x.signal && <p className="tense-why">📍 <b lang={q.u.language}>«{q.x.signal}»</b> → {tenseOf(q.u)}</p>}
          {p.timeline?.length ? <TimeLine marks={p.timeline} small /> : null}
          {q.x.es && <p className="tense-es">{q.x.es}</p>}
          <button type="button" className="primary arcade-go" onClick={next}>{i + 1 < items.length ? 'Siguiente →' : 'Ver resultado →'}</button>
        </div>
      )}
      <Confetti burst={confetti} />
    </Slide>
  );
}

/** Parece código (para pintarlo en monoespaciada), sea cual sea el idioma del curso. */
const looksCode = (text: string) => /\n|[;{}=<>[\]]|\w\(|\w+\.\w+\(/.test(text);

/**
 * «Interfaces en vivo» (D-090): el componente dibujado como se ve en una ventana de escritorio, para reconocerlo. Los
 * contenedores (HBox, VBox, BorderPane…) se dibujan con sus zonas marcadas, que es lo que los distingue.
 */
export function WidgetMock({ kind }: { kind: Widget }) {
  const box = (n: number, cls = '') => <span className={`wm-cell ${cls}`}>{n}</span>;
  const body = ((): ReactNode => {
    switch (kind) {
      case 'button': return <><span className="wm-btn primary">Aceptar</span><span className="wm-btn">Cancelar</span></>;
      case 'label': return <span className="wm-label">Usuario:</span>;
      case 'textfield': return <span className="wm-field">Ana García<i className="wm-caret" /></span>;
      case 'passwordfield': return <span className="wm-field">●●●●●●●<i className="wm-caret" /></span>;
      case 'textarea': return <span className="wm-area">Querida Ana:<br />Te escribo para contarte<br />que el proyecto ya está…<i className="wm-scroll" /></span>;
      case 'checkbox': return <span className="wm-col"><span className="wm-check on">Recordarme</span><span className="wm-check">Recibir novedades</span></span>;
      case 'radiobutton': return <span className="wm-col"><span className="wm-radio on">Tarjeta</span><span className="wm-radio">Efectivo</span><span className="wm-radio">Bizum</span></span>;
      case 'togglebutton': return <span className="wm-row"><span className="wm-btn pressed"><b>N</b></span><span className="wm-btn"><i>K</i></span><span className="wm-btn"><u>S</u></span></span>;
      case 'combobox': return <span className="wm-col"><span className="wm-field wm-combo">España<b>▾</b></span><span className="wm-drop"><span className="sel">España</span><span>Francia</span><span>Italia</span></span></span>;
      case 'listview': return <span className="wm-list"><span>Ana</span><span className="sel">Luis</span><span>Marta</span><span>Pedro</span></span>;
      case 'tableview': return <span className="wm-table"><span className="h">Nombre</span><span className="h">Edad</span><span>Ana</span><span>31</span><span className="sel">Luis</span><span className="sel">28</span><span>Marta</span><span>45</span></span>;
      case 'treeview': return <span className="wm-tree"><span>▾ 📁 proyecto</span><span className="i1">▾ 📁 src</span><span className="i2">📄 Main.java</span><span className="i1">▸ 📁 test</span></span>;
      case 'slider': return <span className="wm-slider"><i className="track"><i className="fill" /><i className="thumb" /></i><span className="ticks"><b>0</b><b>50</b><b>100</b></span></span>;
      case 'progressbar': return <span className="wm-progress"><i /><b>60 %</b></span>;
      case 'spinner': return <span className="wm-field wm-spin">3<span className="arrows"><b>▲</b><b>▼</b></span></span>;
      case 'datepicker': return <span className="wm-col"><span className="wm-field wm-combo">29/10/2026<b>📅</b></span><span className="wm-cal">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <b key={d}>{d}</b>)}{Array.from({ length: 14 }, (_, n) => <span key={n} className={n === 10 ? 'sel' : ''}>{n + 19 > 31 ? n - 12 : n + 19}</span>)}</span></span>;
      case 'colorpicker': return <span className="wm-col"><span className="wm-field wm-combo"><i className="wm-swatch" style={{ background: '#3b82f6' }} />#3B82F6<b>▾</b></span><span className="wm-colors">{['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#111', '#fff', '#ec4899'].map((c) => <i key={c} style={{ background: c }} />)}</span></span>;
      case 'menubar': return <span className="wm-col wide"><span className="wm-menubar"><b className="open">Archivo</b><b>Editar</b><b>Ver</b><b>Ayuda</b></span><span className="wm-drop menu"><span>Nuevo</span><span>Abrir…</span><span className="sel">Guardar</span><span>Salir</span></span></span>;
      case 'toolbar': return <span className="wm-toolbar"><b>📄</b><b>📂</b><b>💾</b><i /><b>✂️</b><b>📋</b><i /><b>↩️</b></span>;
      case 'tabpane': return <span className="wm-col wide"><span className="wm-tabs"><b className="on">General</b><b>Avanzado</b><b>Ayuda</b></span><span className="wm-tabbody">Idioma: Español</span></span>;
      case 'hyperlink': return <span className="wm-link">¿Has olvidado la contraseña?</span>;
      case 'alert': return <span className="wm-alert"><b>⚠️ Confirmación</b><span>¿Seguro que quieres borrar el archivo?</span><span className="wm-row end"><span className="wm-btn primary">Aceptar</span><span className="wm-btn">Cancelar</span></span></span>;
      case 'hbox': return <span className="wm-pane wm-hbox">{box(1)}{box(2)}{box(3)}</span>;
      case 'vbox': return <span className="wm-pane wm-vbox">{box(1)}{box(2)}{box(3)}</span>;
      case 'borderpane': return <span className="wm-pane wm-border"><span className="wm-cell t">top</span><span className="wm-cell l">left</span><span className="wm-cell c">center</span><span className="wm-cell r">right</span><span className="wm-cell b">bottom</span></span>;
      case 'gridpane': return <span className="wm-pane wm-grid">{['0,0', '1,0', '2,0', '0,1', '1,1', '2,1'].map((t) => <span key={t} className="wm-cell">{t}</span>)}</span>;
      case 'stackpane': return <span className="wm-pane wm-stack"><span className="wm-cell s1">1</span><span className="wm-cell s2">2</span><span className="wm-cell s3">3</span></span>;
      case 'flowpane': return <span className="wm-pane wm-flow">{[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n} className="wm-cell">{n}</span>)}</span>;
    }
  })();
  return (
    <figure className="wm" aria-label="Una ventana con un componente de interfaz">
      <span className="wm-bar"><i /><i /><i /></span>
      <span className="wm-body">{body}</span>
    </figure>
  );
}

const WORKSHOP_TAG = { whatis: '🕵️ ¿QUÉ ES ESTO?', fill_gap: '🧩 COMPLETA EL CÓDIGO', predict_output: '▶️ ¿QUÉ IMPRIME?', find_bug: '🐛 CAZA EL BUG', widget: '🖥️ ¿QUÉ COMPONENTE ES?' } as const;

/**
 * El Taller (D-090): saber USAR lo aprendido. Retos mezclados de conceptos ya enseñados: reconocer un ejemplo o un
 * caso, completar código con fichas, predecir lo que imprime, tocar la línea del bug y reconocer componentes dibujados.
 * Sin reloj; cada respuesta se explica y, si fallas alguno, se vuelve a enseñar ese concepto.
 */
function Workshop({ items, all, seed, onAnswer, onDone }: {
  items: WorkshopItem[]; all: Record<string, SessionUnit>; seed: string;
  onAnswer: (u: SessionUnit, ok: boolean, ms: number, item: WorkshopItem) => void; onDone: (failed: string | null) => void;
}) {
  const list = useMemo(() => items.filter((it) => all[it.unitKey] && (it.kind !== 'code' || exercisesOf(all[it.unitKey]!)[it.exercise])), [items, all]);
  const [i, setI] = useState(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const failed = useRef<string[]>([]);
  const t0 = useRef(performance.now());
  useEffect(() => { t0.current = performance.now(); }, [i]);
  const it = i >= 0 ? list[i] : undefined;
  const u = it ? all[it.unitKey]! : undefined;
  const ex = it?.kind === 'code' && u ? exercisesOf(u)[it.exercise]! : undefined;
  const kind = !it ? null : it.kind === 'code' ? (ex!.kind as 'fill_gap' | 'predict_output' | 'find_bug') : it.kind;
  const tapLine = kind === 'find_bug' && ex?.bugLine !== undefined;
  const options = useMemo(() => {
    if (!it || !u) return [];
    if (it.kind === 'code') return stableOrder([ex!.answer!, ...(ex!.distractors ?? [])], `${seed}-${i}`);
    return it.options.map((k) => unitText(all[k]!));
  }, [it, u, ex, i, seed, all]);
  const answer = !it || !u ? '' : it.kind === 'code' ? (tapLine ? String(ex!.bugLine) : ex!.answer!) : unitText(u);
  const ok = picked !== null && (it?.kind === 'code' && !tapLine ? gradeChallenge(ex!, picked, false).correct : picked === answer);
  function pick(o: string) {
    if (!it || !u || picked !== null) return;
    const good = it.kind === 'code' && !tapLine ? gradeChallenge(ex!, o, false).correct : o === answer;
    setPicked(o);
    if (good) { setRight((r) => r + 1); setConfetti((c) => c + 1); } else failed.current.push(u.key);
    onAnswer(u, good, Math.round(performance.now() - t0.current), it);
  }
  const next = () => { setPicked(null); setI((n) => n + 1); };
  const finish = () => onDone(failed.current[0] ?? null);
  if (i < 0) {
    const kinds = [...new Set(list.map((x) => (x.kind === 'code' ? exercisesOf(all[x.unitKey]!)[x.exercise]!.kind : x.kind)))] as Array<keyof typeof WORKSHOP_TAG>;
    return (
      <Slide tone={200} className="shop-intro" onNext={() => setI(0)}>
        <p className="tag">🛠️ TALLER</p>
        <div className="arcade-big" aria-hidden="true">🧰</div>
        <h2 className="ask">Recordarlo está bien. Ahora, ¡a usarlo!</h2>
        <p className="arcade-rules">{list.length} retos con lo que ya has visto:</p>
        <div className="shop-kinds">{kinds.map((k) => <span key={k}>{WORKSHOP_TAG[k]}</span>)}</div>
        <button type="button" className="primary arcade-go" onClick={() => setI(0)}>¡Al taller! 🔧</button>
      </Slide>
    );
  }
  if (!it || !u) {
    const stars = right === list.length ? 3 : right >= list.length * 0.6 ? 2 : right > 0 ? 1 : 0;
    return (
      <Slide tone={200} className="shop-end" onNext={finish}>
        <p className="tag">🛠️ TALLER TERMINADO</p>
        <div className="tense-stars" aria-label={`${stars} de 3 estrellas`}>{[0, 1, 2].map((k) => <span key={k} className={k < stars ? 'on' : ''}>★</span>)}</div>
        <p className="arcade-rules">{right}/{list.length} retos resueltos{right === list.length ? ' · ¡manos de experto! 🏆' : ''}</p>
        {failed.current.length > 0 && <p className="arcade-rules muted">Ahora repasas lo que se te resistió.</p>}
        <button type="button" className="primary arcade-go" onClick={finish}>Seguir →</button>
        <Confetti burst={stars === 3 ? 99 : 0} />
      </Slide>
    );
  }
  const p = u.payload as ConceptPayload;
  const shownText = it.kind === 'whatis' ? maskName((it.source === 'case' ? p.cases! : p.examples)[it.index]!.text, u) : '';
  const shownNote = it.kind === 'whatis' ? (it.source === 'case' ? p.cases! : p.examples)[it.index]!.explanation : undefined;
  const lines = ex?.code?.split('\n') ?? [];
  const state = (o: string) => (picked === null ? '' : o === answer || (it.kind === 'code' && !tapLine && gradeChallenge(ex!, o, false).correct) ? 'is-right' : picked === o ? 'is-wrong' : 'is-off');
  return (
    <Slide tone={hue(u.key)} className={`shop-play ${kind} ${picked === null ? '' : ok ? 'right' : 'wrong'}`} {...(picked !== null ? { onNext: next } : {})}>
      <div className="arcade-head">
        <p className="tag">{WORKSHOP_TAG[kind!]} · {i + 1}/{list.length}</p>
        <span className="arcade-pts">✅ {right}</span>
      </div>
      {it.kind === 'whatis' && <>
        <h3 className="ask shop-ask">¿Qué concepto ves aquí?</h3>
        {looksCode(shownText) ? <pre className="learn-code shop-code"><code>{shownText}</code></pre> : <blockquote className="reading shop-case">{shownText}</blockquote>}
      </>}
      {it.kind === 'widget' && <><h3 className="ask shop-ask">¿Qué componente es?</h3><WidgetMock kind={(p.widget ?? 'button') as Widget} /></>}
      {ex && <>
        <h3 className="ask shop-ask">{ex.prompt}</h3>
        {kind === 'fill_gap' && (
          <pre className="learn-code shop-code"><code>{ex.code!.split('___').map((part, n, arr) => <Fragment key={n}>{part}{n < arr.length - 1 && <span className={`shop-slot ${picked !== null ? (ok ? 'ok' : 'ko') : ''}`}>{picked === null ? '   ' : picked}</span>}</Fragment>)}</code></pre>
        )}
        {kind === 'predict_output' && (
          <div className="shop-term"><span className="shop-term-bar">▶ terminal</span><pre><code>{ex.code}</code></pre>{picked !== null && <pre className="shop-out"><code>{'> '}{ex.answer}</code></pre>}</div>
        )}
        {kind === 'find_bug' && (tapLine
          ? <div className="shop-lines" role="list">{lines.map((l, n) => <button type="button" key={n} role="listitem" className={`shop-line ${picked === null ? '' : n === ex.bugLine ? 'bug' : String(n) === picked ? 'miss' : ''}`} onClick={() => pick(String(n))}><b>{n + 1}</b><code>{l || ' '}</code></button>)}</div>
          : <pre className="learn-code shop-code"><code>{ex.code}</code></pre>)}
      </>}
      {picked === null ? (
        tapLine ? <p className="shop-hint">👆 Toca la línea donde está el error</p>
          : kind === 'fill_gap' ? <div className="shop-tiles">{options.map((o) => <button type="button" key={o} className="shop-tile" onClick={() => pick(o)}>{o}</button>)}</div>
          : <div className="options">{options.map((o) => <button type="button" key={o} className={`option ${o.length > 24 ? 'long' : ''}`} onClick={() => pick(o)}>{o}</button>)}</div>
      ) : (
        <div className="tense-after" aria-live="polite">
          {it.kind !== 'code' && !tapLine && <div className="options shop-done">{options.map((o) => <span key={o} className={`option ${state(o)}`}>{o}</span>)}</div>}
          <p className={`tense-verdict ${ok ? 'ok' : 'ko'}`}>{ok ? '¡Bien visto! 🎉' : tapLine ? <>El error está en la línea {ex!.bugLine! + 1}</> : <>Era <b>{it.kind === 'code' ? ex!.answer : unitText(u)}</b></>}</p>
          {it.kind !== 'code' && <p className="tense-why"><b>{unitText(u)}</b>: {p.gist}</p>}
          {tapLine && <p className="tense-why">Arreglo: <code>{ex!.answer}</code></p>}
          {(ex?.explanation || shownNote) && <p className="tense-es">{ex?.explanation ?? shownNote}</p>}
          <button type="button" className="primary arcade-go" onClick={next}>{i + 1 < list.length ? 'Siguiente →' : 'Ver resultado →'}</button>
        </div>
      )}
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

/** Tarjetas donde se puede marcar «No estoy seguro» antes de responder (la Ráfaga es un juego de velocidad: no). */
const UNSURE_STEPS = ['quick', 'judge', 'listen', 'review', 'challenge', 'build'];

const REPORT_OPTIONS: Array<{ id: ReportReason; text: string; audio?: boolean }> = [
  { id: 'asociacion', text: '🧠 La asociación o la historia no ayuda' },
  { id: 'significado', text: '🔤 El significado o la traducción está mal' },
  { id: 'respuesta', text: '✅ La respuesta correcta está mal' },
  { id: 'audio', text: '🔊 El audio suena mal', audio: true },
  { id: 'otro', text: '💬 Otra cosa' },
];

/** «Reportar un error» (idea de benrios.dev): un toque elige el motivo y se envía; «Otra cosa» deja escribir. */
function ReportSheet({ unit, audio, onClose, onSend }: { unit: SessionUnit; audio: boolean; onClose: () => void; onSend: (reason: ReportReason, note?: string) => void }) {
  const [other, setOther] = useState(false);
  const [note, setNote] = useState('');
  const word = String((unit.payload as { text?: string; title?: string }).text ?? (unit.payload as { title?: string }).title ?? unit.key);
  return (
    <div className="report-veil" role="dialog" aria-modal="true" aria-label="Reportar un error" onClick={onClose}>
      <div className="report-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="tag">⚑ REPORTAR UN ERROR</p>
        <h3>¿Qué está mal en «{word}»?</h3>
        {!other ? (
          <div className="report-options">
            {REPORT_OPTIONS.filter((o) => !o.audio || audio).map((o) => (
              <button key={o.id} type="button" onClick={() => (o.id === 'otro' ? setOther(true) : onSend(o.id))}>{o.text}</button>
            ))}
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); onSend('otro', note.trim() || undefined); }}>
            <textarea autoFocus maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cuéntalo en una frase" aria-label="Qué está mal" />
            <button type="submit" className="primary">Enviar</button>
          </form>
        )}
        <button type="button" className="link report-cancel" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

export function Feed({ payload, courseId, offline = false, onExit, onAgain, next }: Props) {
  // Infinito (D-077): la ronda actual vive aquí; al llegar al hito se carga la siguiente y se encadena sin cortes.
  const [batch, setBatch] = useState(payload);
  const [upcoming, setUpcoming] = useState<SessionPayload | 'loading' | 'error' | null>(null);
  const [round, setRound] = useState(1);
  const plan = batch.state.plan as unknown as AssocPlan;
  const units = batch.units;
  const [index, setIndex] = useState(batch.state.index);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(batch.state.outcomes);
  const [teaching, setTeaching] = useState<{ key: string; note?: string; scene?: number } | null>(null);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [roundXp, setRoundXp] = useState(0);
  const [party, setParty] = useState<string | null>(null);
  const [floater, setFloater] = useState<{ id: number; text: string } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [map, setMap] = useState<{ missions: Mission[]; current: string | null } | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  // «No estoy seguro» (idea de benrios.dev): se marca ANTES de responder; un acierto así cuenta poco (regla 9).
  const [unsure, setUnsure] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(t); }, [toast]);
  const queue = useRef<ClientEvent[]>([]);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const step = plan.steps[index];
  const unit = step?.unitKey ? units[step.unitKey] : undefined;
  useEffect(() => setUnsure(false), [step?.id, teaching]);
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
    if (skillKey) queue.current.push(event(u, skillKey, { format, correct: ok, hint: hint as HintLevel, timeMs: ms, contextId, ...(unsure ? { doubt: true } : {}) }));
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
  // Si deslizas mientras se prepara, la ronda se abre sola en cuanto esté; si tarda, se ofrece reintentar.
  const [wantNext, setWantNext] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (upcoming !== 'loading') { setSlow(false); return; }
    const t = window.setTimeout(() => setSlow(true), NEXT_SLOW_MS);
    return () => window.clearTimeout(t);
  }, [upcoming]);
  useEffect(() => { if (wantNext && upcoming !== 'loading') { setWantNext(false); nextRound(); } }, [wantNext, upcoming]); // eslint-disable-line react-hooks/exhaustive-deps
  function nextRound() {
    if (!next || offline) { onAgain(); return; }
    if (upcoming === 'loading') { setWantNext(true); return; }
    if (upcoming === 'error' || upcoming === null) { onAgain(); return; }
    if (!upcoming.state.plan.steps.length) { onExit(); return; }
    setBatch(upcoming); setIndex(upcoming.state.index); setOutcomes(upcoming.state.outcomes);
    setTeaching(null); setUpcoming(null); setRoundXp(0); setRound((r) => r + 1);
  }

  const visible = plan.steps.filter((s) => !s.retry || failed.has(s.unitKey) || plan.steps.indexOf(s) < index);
  const position = Math.min(visible.length, visible.findIndex((s) => s.id === step?.id) + 1 || visible.length);
  const pct = Math.round((position / Math.max(1, visible.length)) * 100);

  let card: ReactNode = null;
  if (teaching && units[teaching.key]) card = <Teach key={`teach-${step?.id}`} unit={units[teaching.key]!} {...(teaching.note ? { note: teaching.note } : {})} {...(teaching.scene !== undefined ? { scene: teaching.scene } : {})} courseId={courseId} onNext={() => { setTeaching(null); void advance({ correct: false, hint: 0 }); }} />;
  else if (!step || skip) card = null;
  else if (step.kind === 'reel' && unit) card = <Reel key={step.id} unit={unit} focus={step.focus} courseId={courseId} onNext={() => { for (const s of unit.skills) queue.current.push(event(unit, s.key, { kind: 'exposure' })); void advance(); }} />;
  else if (step.kind === 'quick' && unit) card = <Quick key={step.id} unit={unit} reverse={Boolean(step.reverse)} retry={Boolean(step.retry)} pool={pool(unit)} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#quick${step.reverse ? '-inv' : ''}`, 10)} />;
  else if (step.kind === 'train' && unit && step.example !== undefined) card = <Train key={step.id} unit={unit} example={step.example} onNext={() => void advance()} />;
  else if (step.kind === 'burst' && unit) card = <Burst key={step.id} unit={unit} onResult={(ok, ms, points, note) => answered(unit, ok, ms, `${unit.key}#burst`, points, step.skillKey, 'recognition_choice', 0, note)} />;
  else if (step.kind === 'listen' && unit) card = <Listen key={step.id} unit={unit} pool={pool(unit)} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#listen`, 12, step.skillKey, 'recognition_listening')} />;
  else if (step.kind === 'watch' && unit) card = <Watch key={step.id} unit={unit} onNext={() => void advance()} />;
  else if (step.kind === 'arcade' && step.arcadeUnits?.length) card = <FlowArcade key={step.id} seed={step.id} all={units} units={step.arcadeUnits.map((k) => units[k]).filter((x): x is SessionUnit => Boolean(x))} {...(step.arcadeGrammar ? { grammar: step.arcadeGrammar } : {})}
    onAnswer={(u, ok, ms, context) => { const k = recallKey(u); if (k) queue.current.push(event(u, k, { format: 'recognition_choice', correct: ok, hint: 0, timeMs: ms, contextId: `${u.key}#${context}` })); scored(ok, 6); }} onDone={() => void advance()} />;
  else if (step.kind === 'tense' && unit && step.tenseDrills?.length) card = <TenseGame key={step.id} seed={step.id} unit={unit} all={units} drills={step.tenseDrills} route={step.tenseRoute ?? [unit.key]}
    onAnswer={(u, ok, ms, n, clue) => { const k = recallKey(u); if (k) queue.current.push(event(u, k, { format: 'recognition_choice', correct: ok, hint: (clue ? 1 : 0) as HintLevel, timeMs: ms, contextId: `${u.key}#tense-${n}` })); scored(ok, clue ? 5 : 10); }}
    onDone={(failed) => { if (failed) setTeaching({ key: failed, note: 'Mira otra vez su línea del tiempo y sus pistas: son las que deciden la forma del verbo.' }); else void advance({ correct: true, hint: 0 }); }} />;
  else if (step.kind === 'workshop' && step.workshop?.length) card = <Workshop key={step.id} seed={step.id} items={step.workshop} all={units}
    onAnswer={(u, ok, ms, it) => { const k = (it.kind === 'code' ? u.skills.find((x) => x.kind === 'apply')?.key : undefined) ?? recallKey(u); if (k) queue.current.push(event(u, k, { format: 'recognition_choice', correct: ok, hint: 0, timeMs: ms, contextId: `${u.key}#taller-${it.kind}${it.kind === 'code' ? `-${it.exercise}` : ''}` })); scored(ok, 12); }}
    onDone={(failed) => { if (failed) setTeaching({ key: failed, note: 'Mira otra vez su ficha y sus ejemplos: así lo reconocerás y lo usarás la próxima vez.' }); else void advance({ correct: true, hint: 0 }); }} />;
  else if (step.kind === 'pieces' && unit && step.example !== undefined) card = <Pieces key={step.id} unit={unit} all={units} example={step.example} seed={step.id} onResult={(ok, ms, note) => answered(unit, ok, ms, `${unit.key}#piezas-${step.example}`, 15, step.skillKey, 'recognition_choice', 0, note || undefined)} />;
  else if (step.kind === 'chant' && unit) card = <Chant key={step.id} unit={unit} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#chant`, 12, step.skillKey, 'recognition_listening')} />;
  else if (step.kind === 'spot' && unit && step.example !== undefined) card = <Spot key={step.id} unit={unit} example={step.example} reverse={Boolean(step.reverse)} onResult={(ok, ms) => { answered(unit, ok, ms, `${unit.key}#spot-${step.example}${step.reverse ? '-inv' : ''}`, 12, step.skillKey, step.reverse ? 'recognition_choice' : 'recognition_listening'); if (!ok) setTeaching({ key: unit.key, scene: step.example! }); }} />;
  else if (step.kind === 'build' && unit && step.example !== undefined) card = <Build key={step.id} unit={unit} example={step.example} onResult={(ok, ms, note, hint) => answered(unit, ok, ms, `${unit.key}#build-${step.example}`, hint > 1 ? 12 : 20, step.skillKey, 'production', hint, note)} />;
  else if (step.kind === 'judge' && unit) card = <Judge key={step.id} unit={unit} shown={units[step.statementOf ?? unit.key] ?? unit} onResult={(ok, ms) => answered(unit, ok, ms, `${unit.key}#judge`, 8)} />;
  else if (step.kind === 'challenge' && unit && step.typed) card = <Complete key={step.id} unit={unit} step={step} onResult={(ok, ms, format, note) => answered(unit, ok, ms, `${unit.key}#level-${step.exercise ?? 0}`, 30, step.skillKey, format, 0, note)} />;
  else if (step.kind === 'challenge' && unit) card = <Boss key={step.id} unit={unit} step={step} onResult={(ok, ms, format, note) => answered(unit, ok, ms, `${unit.key}#boss-${step.exercise ?? 0}`, 25, step.skillKey, format, 0, note)} />;
  else if (step.kind === 'review' && unit) card = <Write key={step.id} unit={unit} levelUp={Boolean(step.levelUp)} onResult={(ok, ms, hint, format) => answered(unit, ok, ms, `${unit.key}#write`, 20, step.skillKey, format, hint)} />;
  else if (step.kind === 'summary') {
    const asked = plan.steps.filter((s) => ['quick', 'judge', 'challenge', 'review', 'listen', 'build', 'burst', 'tense', 'workshop', 'pieces'].includes(s.kind) && outcomes[s.id]);
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
        {offline ? <p className="end-next">Sin conexión: la siguiente ronda llegará al volver la red.</p>
          : upcoming === 'error' ? <p className="end-next">No se pudo preparar la siguiente ronda. Desliza para intentarlo otra vez.</p>
          : ready ? <p className="end-next ready">✅ La siguiente ronda está lista.</p>
          : (
            <div className="end-loading" role="status">
              <div className="end-loading-bar"><i /></div>
              <p className="end-next">{wantNext ? 'Preparando la siguiente ronda… se abrirá sola en cuanto esté.' : 'Preparando la siguiente ronda…'}</p>
              {slow && <button type="button" className="end-retry" onClick={onAgain}>Está tardando más de lo normal · ↻ Reintentar</button>}
            </div>
          )}
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
        {!offline && unit && <button type="button" className="feed-flag" aria-label="Reportar un error en esta tarjeta" onClick={() => setReporting(unit.key)}>⚑</button>}
      </header>
      <main className="feed-stage">{card}</main>
      {floater && <span key={floater.id} className="floater">{floater.text}</span>}
      {party && <div className="party" role="status">{party}</div>}
      {reporting && units[reporting] && <ReportSheet unit={units[reporting]!} audio={audioEnabled()} onClose={() => setReporting(null)}
        onSend={(reason, note) => { setReporting(null); api.report(courseId, reporting, reason, note).then(() => setToast('✓ Gracias. Lo revisamos y lo corregimos.')).catch(() => setToast('No se ha podido enviar. Prueba otra vez.')); }} />}
      {toast && <p className="report-toast" role="status">{toast}</p>}
      {!teaching && step && UNSURE_STEPS.includes(step.kind) && (
        <button type="button" className={`unsure ${unsure ? 'on' : ''}`} aria-pressed={unsure} onClick={() => setUnsure((v) => !v)}>
          🤔 {unsure ? 'Marcado: si aciertas, volverá pronto' : 'No estoy seguro'}
        </button>
      )}
    </div>
  );
}

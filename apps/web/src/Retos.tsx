// Retos de memoria (D-056): lista → recordar → historia absurda → recordar otra vez → comparar (y al revés).
// Cada intento se envía como evento de aprendizaje: el progreso queda en la cuenta y el reto vuelve con la curva del olvido.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MemoryChallengePayload } from '@memora/content';
import { scoreRecall, seeded, shuffle, type ClientEvent, type RecallScore } from '@memora/experiences';
import { api, type Reto } from './api';
import { deviceId, nextSeq } from './device';
import { enqueue, isNetworkError } from './offline';

type Phase = 'intro' | 'study' | 'recall1' | 'story' | 'recall2' | 'result' | 'reverse' | 'done';

export function RetosHome({ courseId, onExit }: { courseId: string; onExit?: () => void }) {
  const [list, setList] = useState<Reto[] | null>(null);
  const [playing, setPlaying] = useState<Reto | null>(null);
  const load = () => api.retos(courseId).then((r) => setList(r.retos)).catch(() => setList([]));
  useEffect(() => void load(), [courseId]);
  // El juego ocupa toda la pantalla, como una sesión (sin la portada detrás).
  if (playing) return createPortal(<div className="reto-full"><div className="app"><RetoGame reto={playing} courseId={courseId} onExit={() => { setPlaying(null); void load(); }} /></div></div>, document.body);
  const now = Date.now();
  return (
    <section className="retos" aria-label="Retos de memoria">
      <p className="eyebrow">RETOS DE MEMORIA</p>
      <h2 className="h2">Elige un reto</h2>
      <p className="muted">Un minuto para leer la lista, recuerdas, escuchas la historia absurda y vuelves a recordar. Compara el antes y el después.</p>
      {list === null && <p className="muted" role="status">Cargando retos…</p>}
      <ol className="reto-grid">
        {(list ?? []).map((r, i) => {
          const p = r.payload;
          const due = r.dueAt && r.dueAt <= now;
          return (
            <li key={r.key}>
              <button type="button" className={`reto-card ${r.best ? 'played' : ''} ${due ? 'due' : ''}`} onClick={() => setPlaying(r)}>
                <span className="reto-n">{i + 1}</span>
                <b>{p.title}</b>
                <span className="reto-emojis" aria-hidden="true">{(p.emojis ?? []).slice(0, 5).join('')}</span>
                <small>{r.best ? `antes ${r.best.before} → después ${r.best.after} de ${p.words.length}${due ? ' · ¡toca repasar!' : ''}` : `${p.words.length} palabras · sin jugar`}</small>
              </button>
            </li>
          );
        })}
      </ol>
      {onExit && <button type="button" className="link" onClick={onExit}>Volver</button>}
    </section>
  );
}

function RetoGame({ reto, courseId, onExit }: { reto: Reto; courseId: string; onExit: () => void }) {
  const p = reto.payload as MemoryChallengePayload;
  const [phase, setPhase] = useState<Phase>('intro');
  const [scores, setScores] = useState<{ before?: RecallScore; after?: RecallScore; reverse?: RecallScore }>({});
  const [scene, setScene] = useState(0);
  const t0 = useRef(Date.now());

  function send(kind: 'before' | 'after' | 'reverse', s: RecallScore) {
    if (!reto.skillKey) return;
    const ev: ClientEvent = { id: crypto.randomUUID(), at: Date.now(), deviceId: deviceId(), seq: nextSeq(), courseId, unitKey: reto.key, skillKey: reto.skillKey, kind: 'attempt',
      format: 'recall_unaided', correct: s.inOrder === s.total, hint: 0, timeMs: Date.now() - t0.current, contextId: `reto:${kind}:${s.inOrder}/${s.total}` } as ClientEvent;
    api.events(courseId, [ev]).catch((e) => { if (isNetworkError(e)) enqueue(courseId, [ev]); });
  }
  const done = (kind: 'before' | 'after' | 'reverse') => (answer: string[]) => {
    const s = scoreRecall(p.words, answer, kind === 'reverse');
    setScores((x) => ({ ...x, [kind]: s }));
    send(kind, s);
    setPhase(kind === 'before' ? 'story' : kind === 'after' ? 'result' : 'done');
  };

  return (
    <main className="stage reto">
      <div className="top"><button type="button" className="link back" onClick={onExit}>← Retos</button><span className="eyebrow">{p.title.toUpperCase()}</span><span className="pill">{{ intro: '1/5', study: '1/5', recall1: '2/5', story: '3/5', recall2: '4/5', result: '5/5', reverse: 'EXTRA', done: 'FIN' }[phase]}</span></div>
      <div className="card reto-card-main">
        {phase === 'intro' && (
          <>
            <p className="eyebrow">FASE 1 · MEMORIA BRUTA</p>
            <h2>{p.words.length} palabras, {p.seconds ?? 60} segundos</h2>
            <p>Lee la lista sin trucos. Después tendrás que decir <b>cuántas recuerdas</b> y <b>en qué orden</b>. A la mayoría le cuesta a partir de la cuarta.</p>
            <button type="button" className="primary" onClick={() => setPhase('study')}>Empezar</button>
          </>
        )}
        {phase === 'study' && <Study p={p} onDone={() => setPhase('recall1')} />}
        {phase === 'recall1' && <Recall p={p} title="FASE 2 · ¿QUÉ RECUERDAS?" hint="Toca las palabras en el orden en que estaban." onDone={done('before')} seed={`${reto.key}-1`} />}
        {phase === 'story' && (
          <>
            <p className="eyebrow">FASE 3 · LA PELÍCULA ABSURDA · {scene + 1}/{p.scenes.length}</p>
            {scene === 0 && <p className="muted">No intentes memorizar: solo <b>imagina</b> la escena como una película de dibujos animados.</p>}
            <div className="reto-scene-art" aria-hidden="true">{p.scenes[scene]!.emoji ?? '🎬'}</div>
            <p className="reto-scene"><Highlight text={p.scenes[scene]!.text} words={p.words} /></p>
            <button type="button" className="primary" onClick={() => (scene + 1 < p.scenes.length ? setScene(scene + 1) : setPhase('recall2'))}>{scene + 1 < p.scenes.length ? 'Siguiente escena →' : 'Ahora, a recordar →'}</button>
          </>
        )}
        {phase === 'recall2' && <Recall p={p} title="FASE 4 · RECORRE LA PELÍCULA" hint="Ve la película en tu cabeza y toca cada palabra en orden." onDone={done('after')} seed={`${reto.key}-2`} />}
        {phase === 'result' && scores.before && scores.after && (
          <>
            <p className="eyebrow">RESULTADO</p>
            <div className="reto-compare">
              <div><small>Sin trucos</small><b>{scores.before.inOrder}</b><span>en orden · {scores.before.remembered} recordadas</span></div>
              <div className="arrow">→</div>
              <div className="after"><small>Con la historia</small><b>{scores.after.inOrder}</b><span>en orden · {scores.after.remembered} recordadas</span></div>
            </div>
            <p>{scores.after.inOrder > scores.before.inOrder ? `¡+${scores.after.inOrder - scores.before.inOrder} en orden gracias a la historia!` : 'Repite la película con más detalle: cuanto más exagerada, mejor.'} La memoria guarda lo visual, lo absurdo y lo que se mueve; cada imagen arrastra a la siguiente.</p>
            <button type="button" className="primary" onClick={() => setPhase('reverse')}>Desafío extra: al revés</button>
            <button type="button" className="link" onClick={onExit}>Terminar</button>
          </>
        )}
        {phase === 'reverse' && <Recall p={p} title="DESAFÍO · AL REVÉS" hint="Empieza por la última palabra y recorre la película hacia atrás." onDone={done('reverse')} seed={`${reto.key}-3`} />}
        {phase === 'done' && scores.reverse && (
          <>
            <p className="eyebrow">DESAFÍO AL REVÉS</p>
            <div className="reto-compare single"><div className="after"><small>Al revés</small><b>{scores.reverse.inOrder}</b><span>de {scores.reverse.total} en orden</span></div></div>
            <p>Mañana, sin avisar, intenta decirla otra vez: el reto volverá a tu lista de repasos.</p>
            <button type="button" className="primary" onClick={onExit}>Terminar</button>
          </>
        )}
      </div>
    </main>
  );
}

function Study({ p, onDone }: { p: MemoryChallengePayload; onDone: () => void }) {
  const [left, setLeft] = useState(p.seconds ?? 60);
  useEffect(() => {
    if (left <= 0) { onDone(); return; }
    const t = window.setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left, onDone]);
  return (
    <>
      <div className="row"><p className="eyebrow">LEE LA LISTA</p><span className={`pill ${left <= 10 ? 'hot' : ''}`}>{left} s</span></div>
      <ol className="reto-words">{p.words.map((w, i) => <li key={w}><span>{i + 1}</span>{p.emojis?.[i] && <i aria-hidden="true">{p.emojis[i]}</i>}<b className={w.length > 10 ? 'long' : ''}>{w}</b></li>)}</ol>
      <button type="button" className="link" onClick={onDone}>Ya me la sé →</button>
    </>
  );
}

function Recall({ p, title, hint, seed, onDone }: { p: MemoryChallengePayload; title: string; hint: string; seed: string; onDone: (answer: string[]) => void }) {
  const pool = useMemo(() => shuffle([...p.words, ...p.decoys], seeded(seed)), [p, seed]);
  const [answer, setAnswer] = useState<string[]>([]);
  return (
    <>
      <p className="eyebrow">{title}</p>
      <p className="muted">{hint}</p>
      <ol className="reto-answer" aria-label="Tu orden">{answer.map((w, i) => <li key={w}><span>{i + 1}</span>{w}</li>)}{!answer.length && <li className="muted">Aún nada…</li>}</ol>
      <div className="reto-pool">{pool.map((w) => <button type="button" key={w} className="chip" disabled={answer.includes(w)} onClick={() => setAnswer((a) => [...a, w])}>{w}</button>)}</div>
      <div className="row reto-actions">
        <button type="button" className="link" disabled={!answer.length} onClick={() => setAnswer((a) => a.slice(0, -1))}>↶ Deshacer</button>
        <button type="button" className="primary" onClick={() => onDone(answer)}>{answer.length ? `Terminar (${answer.length})` : 'No recuerdo ninguna'}</button>
      </div>
    </>
  );
}

const plain = (t: string) => t.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Resalta en la escena las palabras de la lista (sin importar tildes ni mayúsculas). */
function Highlight({ text, words }: { text: string; words: string[] }) {
  const targets = words.map(plain);
  return <>{text.split(/(\p{L}+)/u).map((part, i) => (targets.includes(plain(part)) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}</>;
}

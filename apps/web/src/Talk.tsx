// Conversación con IA (D-107): una sola pantalla de chat, manos libres. Eliges una situación (o charla libre), la IA
// abre y te habla; tú contestas en voz alta sin tocar nada (detecta cuándo te callas) y ella sigue el hilo. No te corta
// para corregir: reformula de pasada y, debajo de tu burbuja, una etiqueta verde si te corregiste tú solo (logro) o
// ámbar si se quedó un error. Al terminar, el resumen: autocorrecciones, los errores que más importan (vuelven a tus
// repasos) y si cumpliste el objetivo.
import { useEffect, useRef, useState } from 'react';
import type { ClientEvent } from '@memora/experiences';
import { api, ApiError, type Course, type Scenario, type TalkInfo, type TalkLine, type TalkReply } from './api';
import { deviceId, nextSeq } from './device';
import { enqueue, isNetworkError } from './offline';
import { canRecord, listenTurn, openMic, toWavBase64, type Turn } from './recorder';
import { speak } from './speech';

type Msg = { who: 'ai' | 'me'; text: string; info?: Pick<TalkReply, 'selfCorrections' | 'mistakes' | 'recast'> };
type Status = 'idle' | 'speaking' | 'listening' | 'hearing' | 'thinking' | 'paused';
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const STATUS: Record<Status, string> = { idle: 'Toca para hablar', speaking: 'Te está hablando…', listening: 'Te escucho: habla cuando quieras', hearing: 'Escuchando… (toca para enviar)', thinking: 'Pensando…', paused: 'En pausa · toca para seguir' };

export function Talk({ course, onExit, onWarmup }: { course: Course; onExit: () => void; onWarmup: () => void }) {
  const [info, setInfo] = useState<TalkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sc, setSc] = useState<Scenario | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [spent, setSpent] = useState(0);
  const [goal, setGoal] = useState(false);
  const [ended, setEnded] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const turn = useRef<Turn | null>(null);
  const alive = useRef(true);
  const msgsRef = useRef<Msg[]>([]);
  const reviewed = useRef(new Set<string>());
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    api.talk(course.id).then((r) => { setInfo(r); setSpent(r.spentEur); }).catch((e) => setError(e instanceof ApiError ? e.message : 'No se ha podido preparar la conversación.'));
    return () => { alive.current = false; turn.current?.cancel(); stream.current?.getTracks().forEach((t) => t.stop()); window.speechSynthesis?.cancel(); };
  }, [course.id]);
  useEffect(() => { msgsRef.current = msgs; list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [msgs, status]);

  async function start(s: Scenario) {
    setError(null);
    try {
      stream.current = await openMic();
    } catch (e) {
      setError((e as Error)?.name === 'NotAllowedError' ? 'Necesito permiso para usar el micrófono. Actívalo en los ajustes del navegador.' : 'No se ha podido abrir el micrófono.');
      return;
    }
    setSc(s);
    const first: Msg[] = [{ who: 'ai', text: s.opening }];
    setMsgs(first);
    msgsRef.current = first;
    await say(s.opening);
    void listen(s);
  }

  async function say(text: string) {
    if (!alive.current) return;
    setStatus('speaking');
    await speak(text, info?.language ?? course.content_language).catch(() => undefined);
  }

  async function listen(s: Scenario) {
    if (!alive.current || !stream.current) return;
    setStatus('listening');
    const t = listenTurn(stream.current, { onSpeech: () => setStatus('hearing') });
    turn.current = t;
    const blob = await t.done;
    turn.current = null;
    if (!alive.current) return;
    if (!blob) { setStatus('paused'); return; }
    setStatus('thinking');
    try {
      const wav = await toWavBase64(blob);
      const history: TalkLine[] = msgsRef.current.map(({ who, text }) => ({ who, text }));
      const r = await api.talkTurn(course.id, s.key, history, wav.base64);
      if (!alive.current) return;
      setSpent(r.spentEur);
      if (r.goalDone) setGoal(true);
      const next: Msg[] = [...msgsRef.current, ...(r.heard ? [{ who: 'me' as const, text: r.heard, info: { selfCorrections: r.selfCorrections, mistakes: r.mistakes, recast: r.recast } }] : []), { who: 'ai', text: r.reply }];
      setMsgs(next);
      msgsRef.current = next;
      review(r);
      await say(r.reply);
      if (r.spentEur >= r.capEur) { setError(`Has llegado al tope de ${eur(r.capEur)} de este mes.`); setEnded(true); return; }
      void listen(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se ha podido enviar. Toca para intentarlo otra vez.');
      setStatus('paused');
    }
  }

  /** Los errores que quedaron, con su unidad, vuelven a los repasos (una vez por conversación; nunca dominio). */
  function review(r: TalkReply) {
    const events: ClientEvent[] = r.mistakes.filter((m) => m.unitKey && m.skillKey && !reviewed.current.has(m.unitKey)).map((m) => {
      reviewed.current.add(m.unitKey!);
      return { id: crypto.randomUUID(), kind: 'attempt', at: Date.now(), deviceId: deviceId(), seq: nextSeq(), courseId: course.id, unitKey: m.unitKey!, skillKey: m.skillKey!, format: 'recall_cued', correct: false, hint: 2, timeMs: 5000, contextId: `${m.unitKey}#talk` };
    });
    if (events.length) api.events(course.id, events).catch((e) => { if (isNetworkError(e)) enqueue(course.id, events); });
  }

  function tapMain() {
    if (!sc) return;
    if (status === 'hearing' || status === 'listening') { turn.current?.stop(); return; }
    if (status === 'paused' || status === 'idle') { setError(null); void listen(sc); return; }
    if (status === 'speaking') { window.speechSynthesis?.cancel(); }
  }

  function finish() {
    alive.current = false;
    turn.current?.cancel();
    window.speechSynthesis?.cancel();
    stream.current?.getTracks().forEach((t) => t.stop());
    setStatus('idle');
    setEnded(true);
  }

  const head = (
    <header className="feed-top talk-top">
      <button type="button" className="feed-x" aria-label="Salir" onClick={() => { finish(); onExit(); }}>✕</button>
      <b className="talk-title">{sc ? `${sc.emoji} ${sc.title}` : '🎙️ Conversar'}</b>
      <span className="feed-xp" title="Gasto de IA este mes">{eur(spent)}</span>
    </header>
  );
  const frame = (body: React.ReactNode) => <div className="talk" role="application" aria-label="Conversación">{head}{body}</div>;

  if (error && !info) return frame(<div className="talk-pick"><p className="banner">{error}</p><button type="button" className="go wide" onClick={onExit}>Volver</button></div>);
  if (!info) return frame(<div className="talk-pick"><p role="status">Preparando…</p></div>);
  if (!info.available) {
    const why = info.reason === 'cap' ? `Has usado el tope de ${eur(info.capEur)} de este mes. Vuelve el día 1, o sube el tope.` : info.reason === 'off' ? 'La conversación aún no está activada en el servidor.' : 'La conversación es solo para idiomas.';
    return frame(<div className="talk-pick"><h2>Ahora no está disponible</h2><p>{why}</p><button type="button" className="go wide" onClick={onExit}>Volver</button></div>);
  }
  if (!canRecord()) return frame(<div className="talk-pick"><p className="banner">Este navegador no deja grabar con el micrófono. Prueba con Safari en el iPhone o Chrome en Android.</p><button type="button" className="go wide" onClick={onExit}>Volver</button></div>);

  if (!sc) return frame(
    <div className="talk-pick">
      <h2>¿De qué hablamos?</h2>
      <p className="talk-sub">Hablas tú, sin tocar nada: te escucho y te contesto. Si te equivocas, sigo la charla y al final te digo lo importante.</p>
      <div className="talk-scenarios">
        {info.scenarios.map((s) => (
          <button key={s.key} type="button" className="talk-sc" onClick={() => void start(s)}>
            <span aria-hidden="true">{s.emoji}</span><b>{s.title}</b><small>{s.goal}</small>
          </button>
        ))}
      </div>
      <button type="button" className="talk-warm" onClick={onWarmup}>🔁 Calentamiento: 5 frases sueltas</button>
      {error && <p className="banner" role="alert">{error}</p>}
    </div>);

  if (ended) {
    const mine = msgs.filter((m) => m.who === 'me');
    const selfs = mine.flatMap((m) => m.info?.selfCorrections ?? []);
    const counts = new Map<string, { m: TalkReply['mistakes'][number]; n: number }>();
    for (const m of mine.flatMap((x) => x.info?.mistakes ?? [])) { const k = m.correct.toLowerCase(); const c = counts.get(k); counts.set(k, { m, n: (c?.n ?? 0) + 1 }); }
    const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 3);
    return frame(
      <div className="talk-pick talk-end">
        <h2>{goal ? '🎯 ¡Objetivo cumplido!' : 'Conversación terminada'}</h2>
        <p className="talk-sub">{mine.length} {mine.length === 1 ? 'respuesta' : 'respuestas'} en inglés · {eur(spent)} de {eur(info.capEur)} este mes</p>
        {selfs.length > 0 && <section className="talk-box ok"><b>🔧 Te corregiste tú solo {selfs.length === 1 ? '1 vez' : `${selfs.length} veces`}</b>
          {selfs.map((x, i) => <p key={i}><s>{x.from}</s> → {x.to}</p>)}<small>Eso es lo que hace quien habla bien: darse cuenta y arreglarlo.</small></section>}
        {top.length > 0 ? <section className="talk-box ko"><b>Lo que más te conviene repasar</b>
          {top.map(({ m, n }, i) => <p key={i}><s>{m.said}</s> → <b>{m.correct}</b>{n > 1 ? ` · ${n} veces` : ''}<br /><small>{m.why}</small></p>)}<small>Vuelve en tus repasos.</small></section>
          : mine.length > 0 && <section className="talk-box ok"><b>Sin errores que importen. ¡Muy bien!</b></section>}
        <button type="button" className="go wide" onClick={() => { setSc(null); setMsgs([]); setEnded(false); setGoal(false); setStatus('idle'); alive.current = true; reviewed.current.clear(); }}>Otra conversación</button>
        <button type="button" className="option ghost" onClick={onExit}>Volver a Inicio</button>
      </div>);
  }

  return frame(<>
    <p className="talk-goal">🎯 {sc.goal}</p>
    <div className="talk-list" ref={list}>
      {msgs.map((m, i) => (
        <div key={i} className={`bubble ${m.who}`}>
          <p>{m.text}{m.who === 'ai' && <button type="button" className="say" aria-label="Escuchar otra vez" onClick={() => void speak(m.text, info.language)}>🔊</button>}</p>
          {m.info?.selfCorrections.map((x, j) => <span key={`s${j}`} className="talk-chip self">🔧 Te has corregido: <s>{x.from}</s> → {x.to} ✓</span>)}
          {m.info?.mistakes.map((x, j) => <span key={`m${j}`} className="talk-chip miss">✎ <s>{x.said}</s> → {x.correct}</span>)}
        </div>
      ))}
      {status === 'thinking' && <div className="bubble ai typing" aria-label="Pensando"><p>···</p></div>}
    </div>
    {error && <p className="banner talk-err" role="alert">{error}</p>}
    <div className="talk-bar">
      <button type="button" className={`talk-mic ${status}`} aria-label={STATUS[status]} disabled={status === 'thinking'} onClick={tapMain}>
        <span aria-hidden="true">{status === 'thinking' ? '⏳' : status === 'speaking' ? '🔊' : status === 'paused' ? '▶️' : '🎙️'}</span>
      </button>
      <small className="talk-status" role="status">{STATUS[status]}</small>
      <button type="button" className="talk-end-btn" onClick={finish}>Terminar</button>
    </div>
  </>);
}

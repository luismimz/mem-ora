// Conversación con IA (D-107): una sola pantalla de chat, manos libres. Eliges una situación (o charla libre), la IA
// abre y te habla; tú contestas en voz alta sin tocar nada (detecta cuándo te callas) y ella sigue el hilo. No te corta
// para corregir: reformula de pasada y, debajo de tu burbuja, una etiqueta verde si te corregiste tú solo (logro) o
// ámbar si se quedó un error. Al terminar, el resumen: autocorrecciones, los errores que más importan (vuelven a tus
// repasos) y si cumpliste el objetivo.
import { useEffect, useRef, useState } from 'react';
import type { ClientEvent } from '@memora/experiences';
import { api, ApiError, type Course, type Scenario, type TalkHelp, type TalkInfo, type TalkLine, type TalkReply } from './api';
import { deviceId, nextSeq } from './device';
import { enqueue, isNetworkError } from './offline';
import { canRecord, listenTurn, openMic, toWavBase64, type Turn } from './recorder';
import { speak } from './speech';
import { buzz, Confetti, sfx } from './Feed';

type Msg = { who: 'ai' | 'me' | 'cheer'; text: string; info?: Pick<TalkReply, 'selfCorrections' | 'mistakes' | 'recast'> };
type Status = 'idle' | 'speaking' | 'listening' | 'hearing' | 'thinking' | 'paused';
/** Frases salvavidas (D-109): para ganar tiempo o pedir ayuda sin bloquearte. Nunca cuentan como error. */
const LIFELINES = ['Let me think…', 'How do you say…?', 'Can you repeat, please?', 'Sorry, I don\'t understand.', 'I mean…'];
/** Si no hablas en estos ms, se abre sola la siguiente ayuda (como mucho hasta las palabras clave). */
const AUTO_HELP_MS = 6000;
type Mode = 'guiado' | 'libre';
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
  const [points, setPoints] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const [floater, setFloater] = useState<{ id: number; text: string } | null>(null);
  const [mode, setMode] = useState<Mode>('guiado');
  const [help, setHelp] = useState<TalkHelp | null>(null);
  const [level, setLevel] = useState(0);
  const [lifelines, setLifelines] = useState(false);
  const levelRef = useRef(0);
  const helpTimer = useRef(0);
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
  useEffect(() => { levelRef.current = level; }, [level]);
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
    newHelp(s.help);
    const first: Msg[] = [{ who: 'ai', text: s.opening }];
    setMsgs(first);
    msgsRef.current = first;
    await say(s.opening);
    void listen(s);
  }

  /** Ayuda nueva para la siguiente respuesta: en guiado se ve ya la idea en español (modo puente); en libre, nada. */
  function newHelp(h: TalkHelp | null) {
    setHelp(h);
    const l = h && mode === 'guiado' ? 1 : 0;
    setLevel(l); levelRef.current = l;
  }
  function more() { setLevel((l) => { const n = Math.min(4, l + 1); levelRef.current = n; return n; }); }

  async function say(text: string) {
    if (!alive.current) return;
    setStatus('speaking');
    await speak(text, info?.language ?? course.content_language).catch(() => undefined);
  }

  async function listen(s: Scenario) {
    if (!alive.current || !stream.current) return;
    setStatus('listening');
    window.clearTimeout(helpTimer.current);
    // Si te quedas en blanco, la ayuda se abre sola un escalón (hasta las palabras clave).
    helpTimer.current = window.setTimeout(() => { if (levelRef.current < 2) more(); }, AUTO_HELP_MS);
    const t = listenTurn(stream.current, { onSpeech: () => { window.clearTimeout(helpTimer.current); setStatus('hearing'); }, waitMs: 20_000 });
    turn.current = t;
    const blob = await t.done;
    window.clearTimeout(helpTimer.current);
    turn.current = null;
    if (!alive.current) return;
    if (!blob) { setStatus('paused'); return; }
    setStatus('thinking');
    try {
      const wav = await toWavBase64(blob);
      const history: TalkLine[] = msgsRef.current.flatMap((m) => (m.who === 'cheer' ? [] : [{ who: m.who, text: m.text }]));
      const r = await api.talkTurn(course.id, s.key, history, wav.base64);
      if (!alive.current) return;
      setSpent(r.spentEur);
      const cheers = celebrate(r, levelRef.current);
      if (r.howTo) cheers.push({ who: 'cheer', text: `📖 ${r.howTo.es} = ${r.howTo.en}` });
      const next: Msg[] = [...msgsRef.current, ...(r.heard ? [{ who: 'me' as const, text: r.heard, info: { selfCorrections: r.selfCorrections, mistakes: r.mistakes, recast: r.recast } }] : []), ...cheers, { who: 'ai', text: r.reply }];
      setMsgs(next);
      msgsRef.current = next;
      review(r);
      newHelp(r.help);
      await say(r.reply);
      if (r.spentEur >= r.capEur) { setError(`Has llegado al tope de ${eur(r.capEur)} de este mes.`); setEnded(true); return; }
      void listen(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se ha podido enviar. Toca para intentarlo otra vez.');
      setStatus('paused');
    }
  }

  /** Celebración como en el Arcade (D-108): puntos por cada turno, extra por corregirte tú solo y fiesta al cumplir el objetivo. */
  function celebrate(r: TalkReply, used: number): Msg[] {
    if (!r.heard) return [];
    const out: Msg[] = [];
    // Cuanta menos ayuda, más puntos (la idea en español del modo guiado no resta).
    let gain = 10 + Math.max(0, 4 - Math.max(used, 1)) * 3;
    if (r.selfCorrections.length) { gain += 15; out.push({ who: 'cheer', text: '🔧 ¡Bien visto! Te has corregido tú solo · +15' }); sfx('pop'); buzz(12); }
    else if (!r.mistakes.length) { gain += 5; sfx('ok'); buzz(12); }
    if (r.goalDone && !goal) { gain += 50; setGoal(true); out.push({ who: 'cheer', text: '🎯 ¡Objetivo cumplido! · +50' }); setConfetti((c) => c + 1); sfx('party'); buzz([20, 40, 20]); }
    setPoints((p) => p + gain);
    setFloater({ id: Date.now(), text: `+${gain}` });
    return out;
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
    sfx(goal ? 'party' : 'ok'); buzz(goal ? [20, 40, 20, 40, 60] : 20);
    if (goal) setConfetti(99);
  }

  const head = (
    <header className="feed-top talk-top">
      <button type="button" className="feed-x" aria-label="Salir" onClick={() => { finish(); onExit(); }}>✕</button>
      <b className="talk-title">{sc ? `${sc.emoji} ${sc.title}` : '🎙️ Conversar'}</b>
      <span className="feed-xp" title={`Gasto de IA este mes: ${eur(spent)}`}>⭐ {points}</span>
    </header>
  );
  const frame = (body: React.ReactNode) => <div className="talk" role="application" aria-label="Conversación">{head}{body}<Confetti burst={confetti} />{floater && <span key={floater.id} className="floater">{floater.text}</span>}</div>;

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
      <div className="talk-mode" role="radiogroup" aria-label="Nivel de ayuda">
        <button type="button" role="radio" aria-checked={mode === 'guiado'} className={mode === 'guiado' ? 'on' : ''} onClick={() => setMode('guiado')}><b>🧭 Guiado</b><small>Te digo en español qué decir y tú lo dices en inglés</small></button>
        <button type="button" role="radio" aria-checked={mode === 'libre'} className={mode === 'libre' ? 'on' : ''} onClick={() => setMode('libre')}><b>🕊️ Libre</b><small>Hablas tú; la ayuda 💡 solo si la pides</small></button>
      </div>
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
        <p className="talk-sub">⭐ {points} puntos · {mine.length} {mine.length === 1 ? 'respuesta' : 'respuestas'} en inglés · {eur(spent)} de {eur(info.capEur)} este mes</p>
        {selfs.length > 0 && <section className="talk-box ok"><b>🔧 Te corregiste tú solo {selfs.length === 1 ? '1 vez' : `${selfs.length} veces`}</b>
          {selfs.map((x, i) => <p key={i}><s>{x.from}</s> → {x.to}</p>)}<small>Eso es lo que hace quien habla bien: darse cuenta y arreglarlo.</small></section>}
        {top.length > 0 ? <section className="talk-box ko"><b>Lo que más te conviene repasar</b>
          {top.map(({ m, n }, i) => <p key={i}><s>{m.said}</s> → <b>{m.correct}</b>{n > 1 ? ` · ${n} veces` : ''}<br /><small>{m.why}</small></p>)}<small>Vuelve en tus repasos.</small></section>
          : mine.length > 0 && <section className="talk-box ok"><b>Sin errores que importen. ¡Muy bien!</b></section>}
        <button type="button" className="go wide" onClick={() => { setSc(null); setMsgs([]); setEnded(false); setGoal(false); setPoints(0); setStatus('idle'); alive.current = true; reviewed.current.clear(); }}>Otra conversación</button>
        <button type="button" className="option ghost" onClick={onExit}>Volver a Inicio</button>
      </div>);
  }

  return frame(<>
    <p className="talk-goal">🎯 {sc.goal}</p>
    <div className="talk-list" ref={list}>
      {msgs.map((m, i) => m.who === 'cheer' ? <p key={i} className="talk-cheer" role="status">{m.text}</p> : (
        <div key={i} className={`bubble ${m.who}`}>
          <p>{m.text}{m.who === 'ai' && <button type="button" className="say" aria-label="Escuchar otra vez" onClick={() => void speak(m.text, info.language)}>🔊</button>}</p>
          {m.info?.selfCorrections.map((x, j) => <span key={`s${j}`} className="talk-chip self">🔧 Te has corregido: <s>{x.from}</s> → {x.to} ✓</span>)}
          {m.info?.mistakes.map((x, j) => <span key={`m${j}`} className="talk-chip miss">✎ <s>{x.said}</s> → {x.correct}</span>)}
        </div>
      ))}
      {status === 'thinking' && <div className="bubble ai typing" aria-label="Pensando"><p>···</p></div>}
    </div>
    {error && <p className="banner talk-err" role="alert">{error}</p>}
    {help && status !== 'thinking' && (
      <section className={`talk-help l${level}`} aria-label="Ayuda para contestar">
        {level >= 1 && <p className="help-idea">🧭 {help.idea}</p>}
        {level >= 2 && help.keywords.length > 0 && <p className="help-keys">{help.keywords.map((k) => <button key={k} type="button" className="help-key" onClick={() => void speak(k, info.language)}>🔊 {k}</button>)}</p>}
        {level >= 3 && <p className="help-frame">{help.frame}</p>}
        {level >= 4 && <p className="help-model"><button type="button" className="say" aria-label="Escuchar la frase" onClick={() => void speak(help.model, info.language)}>🔊</button> {help.model}</p>}
        <div className="help-row">
          {level < 4 && <button type="button" className="help-more" onClick={more}>💡 {level === 0 ? '¿Qué puedo decir?' : level === 1 ? 'Palabras clave' : level === 2 ? 'Frase con huecos' : 'Ver la frase entera'}</button>}
          <button type="button" className={`help-life ${lifelines ? 'on' : ''}`} aria-expanded={lifelines} onClick={() => setLifelines((x) => !x)}>🛟 Salvavidas</button>
        </div>
        {lifelines && <p className="help-keys">{LIFELINES.map((l) => <button key={l} type="button" className="help-key life" onClick={() => void speak(l, info.language)}>🔊 {l}</button>)}<small className="help-note">También puedes preguntar en español: «¿cómo se dice…?»</small></p>}
      </section>
    )}
    <div className="talk-bar">
      <button type="button" className={`talk-mic ${status}`} aria-label={STATUS[status]} disabled={status === 'thinking'} onClick={tapMain}>
        <span aria-hidden="true">{status === 'thinking' ? '⏳' : status === 'speaking' ? '🔊' : status === 'paused' ? '▶️' : '🎙️'}</span>
      </button>
      <small className="talk-status" role="status">{STATUS[status]}</small>
      <button type="button" className="talk-end-btn" onClick={finish}>Terminar</button>
    </div>
  </>);
}

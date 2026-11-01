// Ronda de hablar (D-106): 5 frases que YA has trabajado. Ves la frase en español, mantienes pulsado el micrófono, la
// dices en inglés y sueltas. Una IA (en el servidor, vía OpenRouter) te dice qué ha entendido, la frase bien dicha y UNA
// corrección. Si fallas, repítela bien. Después, desliza para seguir (sin botones de «Siguiente»).
// Cuenta como práctica de recordar con pista (regla 9): refuerza el repaso, nunca marca «dominado».
import { useEffect, useRef, useState } from 'react';
import type { ClientEvent } from '@memora/experiences';
import { api, ApiError, type Course, type SpeakItem, type SpeakRound, type SpeakVerdict } from './api';
import { deviceId, nextSeq } from './device';
import { Slide } from './Feed';
import { enqueue, isNetworkError } from './offline';
import { canRecord, startRecording, toWavBase64, type Recording } from './recorder';
import { speak } from './speech';

const PREF = 'memora.speak';
/** Ajuste del alumno (en este dispositivo): la ronda de hablar está activada salvo que la apague en su perfil. */
export function speakEnabled(): boolean { try { return localStorage.getItem(PREF) !== 'off'; } catch { return true; } }
export function setSpeakEnabled(on: boolean): void { try { localStorage.setItem(PREF, on ? 'on' : 'off'); } catch { /* sin almacenamiento */ } }

type Phase = 'ask' | 'recording' | 'checking' | 'verdict';
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export function Speak({ course, onExit }: { course: Course; onExit: () => void }) {
  const [round, setRound] = useState<SpeakRound | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [verdict, setVerdict] = useState<SpeakVerdict | null>(null);
  const [retry, setRetry] = useState<SpeakVerdict | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [spent, setSpent] = useState(0);
  const rec = useRef<Recording | null>(null);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    api.speak(course.id).then((r) => { setRound(r); setSpent(r.spentEur); }).catch((e) => setError(e instanceof ApiError ? e.message : 'No se ha podido preparar la ronda.'));
    return () => rec.current?.cancel();
  }, [course.id]);

  const item: SpeakItem | undefined = round?.items[idx];
  const done = Boolean(round && idx >= round.items.length);

  async function begin() {
    if (phase !== 'ask' && phase !== 'verdict') return;
    setError(null);
    try {
      rec.current = await startRecording();
      setPhase('recording');
    } catch (e) {
      setError((e as Error)?.name === 'NotAllowedError' ? 'Necesito permiso para usar el micrófono. Actívalo en los ajustes del navegador.' : 'No se ha podido abrir el micrófono.');
    }
  }

  async function end() {
    const r = rec.current;
    if (!r || !item) return;
    rec.current = null;
    const isRetry = Boolean(verdict);
    setPhase('checking');
    try {
      const blob = await r.stop();
      const wav = blob ? await toWavBase64(blob) : null;
      if (!wav || wav.seconds < 0.4) { setError('No te he oído: mantén pulsado mientras hablas.'); setPhase(isRetry ? 'verdict' : 'ask'); return; }
      const v = await api.speakCheck(course.id, item.unitKey, item.reference, wav.base64);
      setSpent(v.spentEur);
      if (isRetry) { setRetry(v); setPhase('verdict'); return; }
      setVerdict(v);
      setPhase('verdict');
      setResults((x) => [...x, v.ok]);
      record(item, v.ok);
      void speak(v.corrected, round!.language);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se ha podido comprobar. Inténtalo otra vez.');
      setPhase(isRetry ? 'verdict' : 'ask');
    }
  }

  /** La primera respuesta de cada frase va a su repaso: recordar con pista (la frase en español). */
  function record(it: SpeakItem, ok: boolean) {
    if (!it.skillKey) return;
    const event: ClientEvent = {
      id: crypto.randomUUID(), kind: 'attempt', at: Date.now(), deviceId: deviceId(), seq: nextSeq(), courseId: course.id, unitKey: it.unitKey, skillKey: it.skillKey,
      format: 'recall_cued', correct: ok, hint: 2, timeMs: Date.now() - shownAt.current, contextId: `${it.unitKey}#speak`,
    };
    api.events(course.id, [event]).catch((e) => { if (isNetworkError(e)) enqueue(course.id, [event]); });
  }

  function next() {
    setIdx((i) => i + 1);
    setVerdict(null);
    setRetry(null);
    setPhase('ask');
    setError(null);
    shownAt.current = Date.now();
  }

  const mic = (label: string) => (
    <button type="button" className={`mic ${phase === 'recording' ? 'on' : ''}`} aria-label={label} disabled={phase === 'checking'}
      onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); void begin(); }}
      onPointerUp={() => void end()} onPointerCancel={() => void end()} onContextMenu={(e) => e.preventDefault()}>
      <span aria-hidden="true">{phase === 'checking' ? '…' : '🎙️'}</span>
      <small>{phase === 'recording' ? 'Suelta al terminar' : phase === 'checking' ? 'Escuchando…' : label}</small>
    </button>
  );

  const shell = (body: React.ReactNode, onNext?: () => void, tone = 280) => (
    <div className="feed speak" role="application" aria-label="Ronda de hablar">
      <header className="feed-top">
        <button type="button" className="feed-x" aria-label="Salir" onClick={onExit}>✕</button>
        <div className="feed-bar" aria-label="Progreso"><i style={{ width: `${round?.items.length ? (Math.min(idx, round.items.length) / round.items.length) * 100 : 0}%` }} /></div>
        <span className="feed-xp" title="Gasto de IA este mes">{eur(spent)}</span>
      </header>
      <main className="feed-stage"><Slide tone={tone} onNext={onNext}>{body}</Slide></main>
    </div>
  );

  if (error && !round) return shell(<><p className="tag ko">🎙️ RONDA DE HABLAR</p><p className="teach-note">{error}</p><button type="button" className="go wide" onClick={onExit}>Volver</button></>);
  if (!round) return shell(<p className="tag" role="status">Preparando tus frases…</p>);
  if (!round.available || !round.items.length) {
    const why = round.reason === 'cap' ? `Has usado el tope de ${eur(round.capEur)} de este mes. Vuelve el día 1, o sube el tope.`
      : round.reason === 'off' ? 'La ronda de hablar aún no está activada en el servidor.'
      : round.reason === 'not_language' ? 'La ronda de hablar es solo para idiomas.'
      : 'Todavía no has trabajado frases para decir. Haz unas rondas y vuelve.';
    return shell(<><p className="tag">🎙️ RONDA DE HABLAR</p><h3 className="ask">Ahora no está disponible</h3><p className="teach-note">{why}</p><button type="button" className="go wide" onClick={onExit}>Volver</button></>);
  }
  if (!canRecord()) return shell(<><p className="tag ko">🎙️ RONDA DE HABLAR</p><p className="teach-note">Este navegador no deja grabar con el micrófono. Prueba con Safari en el iPhone o Chrome en Android.</p><button type="button" className="go wide" onClick={onExit}>Volver</button></>);

  if (done) {
    const ok = results.filter(Boolean).length;
    return shell(
      <div className="speak-end">
        <p className="tag">🎙️ RONDA TERMINADA</p>
        <div className="end-xp">{ok}/{results.length}</div>
        <p className="end-next">{ok === results.length ? '¡Todas bien a la primera! Hablar es lo que más fija lo aprendido.' : 'Las que te han costado vuelven en tus repasos.'}</p>
        <p className="muted">Gasto de IA este mes: {eur(spent)} de {eur(round.capEur)}.</p>
        <button type="button" className="go wide" onClick={() => { setRound(null); setIdx(0); setResults([]); api.speak(course.id).then(setRound).catch(() => setError('No se ha podido preparar otra ronda.')); }}>Otra ronda</button>
        <button type="button" className="option ghost" onClick={onExit}>Volver a Inicio</button>
      </div>, undefined, 140);
  }

  return shell(
    <div className="speak-card">
      <p className="tag">🎙️ DILO EN INGLÉS · {idx + 1}/{round.items.length}</p>
      <h3 className="ask speak-prompt">{item!.prompt}</h3>
      {phase !== 'verdict' && <>{mic('Mantén pulsado y habla')}<p className="speak-help">Con lo que ya has aprendido. No pasa nada si dudas.</p></>}
      {phase === 'verdict' && verdict && (
        <div className={`speak-verdict ${verdict.ok ? 'ok' : 'ko'}`} role="status">
          <b>{verdict.ok ? '✓ ¡Se entiende y está bien!' : '✗ Casi'}</b>
          <p className="speak-heard">Te he entendido: <i>«{verdict.heard || '…'}»</i></p>
          <p className="speak-good">
            <button type="button" className="say" aria-label={`Escuchar «${verdict.corrected}»`} onClick={() => void speak(verdict.corrected, round.language)}>🔊</button>
            <span>{verdict.corrected}</span>
          </p>
          <p className="speak-tip">{verdict.tip}</p>
          {!verdict.ok && !retry && <>{mic('Repítela bien')}<p className="speak-help">Repetirla bien es lo que más ayuda a fijarla.</p></>}
          {retry && <p className={`speak-retry ${retry.ok ? 'ok' : 'ko'}`}>{retry.ok ? '✓ ¡Ahora sí!' : `Casi: ${retry.tip}`}</p>}
        </div>
      )}
      {error && <p className="banner" role="alert">{error}</p>}
    </div>, phase === 'verdict' ? next : undefined);
}

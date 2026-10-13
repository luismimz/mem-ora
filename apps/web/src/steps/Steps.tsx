// Un componente por tipo de paso. Solo muestran el ejercicio y recogen la respuesta: corregir y registrar lo hace la
// sesión con @memora/experiences.
import { useEffect, useRef, useState } from 'react';
import type { HintLevel } from '@memora/core';
import type { Exercise, SessionStep, StepAnswer } from '@memora/experiences';
import { t } from '../i18n';
import { speak } from '../speech';

type Props<K extends Exercise['kind']> = { exercise: Extract<Exercise, { kind: K }>; step: SessionStep; onSubmit: (answer: StepAnswer) => void; disabled: boolean };
type PresentProps<K extends Exercise['kind']> = { exercise: Extract<Exercise, { kind: K }>; onContinue: () => void };

/** Resalta en negrita las palabras en MAYÚSCULAS de una escena. */
export function Scene({ text }: { text: string }) {
  return <>{text.split(/(\p{Lu}{2,}(?:\s+\p{Lu}{2,})*)/u).map((part, i) => (/^\p{Lu}{2,}/u.test(part) ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))}</>;
}

function Voice({ text, language }: { text: string; language: string }) {
  return (
    <div className="voice">
      <button type="button" onClick={() => speak(text, language)}>🔊 {t('voice.play')}</button>
      <button type="button" className="secondary" onClick={() => speak(text, language, 0.7)}>{t('voice.slow')}</button>
      <p className="note">{t('voice.provisional')}</p>
    </div>
  );
}

const useTimer = () => {
  const start = useRef(performance.now());
  return () => Math.round(performance.now() - start.current);
};

export function ListenStep({ exercise, onContinue }: PresentProps<'listen'>) {
  const [shown, setShown] = useState(false);
  useEffect(() => speak(exercise.speak, exercise.language), [exercise.speak, exercise.language]);
  return (
    <section>
      <h2>{t('step.listen.title')}</h2>
      <Voice text={exercise.speak} language={exercise.language} />
      {shown ? (
        <div className="card">
          <p className="big" lang={exercise.language}>{exercise.text}</p>
          <p>{exercise.meaning}</p>
          <button type="button" onClick={onContinue}>{t('session.continue')}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setShown(true)}>{t('step.listen.reveal')}</button>
      )}
    </section>
  );
}

export function AssociateStep({ exercise, onContinue }: PresentProps<'associate'>) {
  return (
    <section>
      <h2>{t('step.associate.title')}</h2>
      <div className="card">
        <p className="big" lang={exercise.language}>{exercise.text}</p>
        <p className="meaning">{exercise.meaning}</p>
        {exercise.association ? <p className="scene"><Scene text={exercise.association.text} /></p> : <p className="note">{t('step.associate.noAssociation')}</p>}
        {exercise.example && <p className="example" lang={exercise.language}>{exercise.example.text} <span>· {exercise.example.translation}</span></p>}
      </div>
      <Voice text={exercise.speak} language={exercise.language} />
      <button type="button" onClick={onContinue}>{t('session.continue')}</button>
    </section>
  );
}

export function StructureStep({ exercise, onContinue }: PresentProps<'structure'>) {
  return (
    <section>
      <h2>{t('step.structure.title')}</h2>
      <div className="card">
        <p className="meaning">{exercise.goal}</p>
        <p className="pieces">{exercise.pieces.map((p, i) => <span key={i} className={`piece ${p.role}`}>{p.text}</span>)}</p>
        <ul className="examples">{exercise.examples.map((e, i) => <li key={i}><span lang="en">{e.text}</span> <span>· {e.translation}</span></li>)}</ul>
        <p><strong>{t('step.structure.rule')}:</strong> {exercise.rule}</p>
        {exercise.pitfalls.length > 0 && <p className="note"><strong>{t('step.structure.pitfalls')}:</strong> {exercise.pitfalls.join(' ')}</p>}
      </div>
      <button type="button" onClick={onContinue}>{t('session.continue')}</button>
    </section>
  );
}

export function RecallStep({ exercise, step, onSubmit, disabled }: Props<'recall'>) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState<HintLevel>(step.startHint);
  const elapsed = useTimer();
  const submit = (revealed = false) => onSubmit({ text, hintUsed: hint, revealed, timeMs: elapsed() });
  return (
    <section>
      <h2>{t('step.recall.title')}</h2>
      <p className="prompt">{exercise.mode === 'meaning' ? t('step.recall.meaning', { prompt: exercise.prompt }) : <>{t('step.recall.blank')}<br /><span className="big" lang="en">{exercise.prompt}</span></>}</p>
      {exercise.hints.slice(0, hint).map((h, i) => <p key={i} className="hint"><span>{t('step.recall.hintLevel', { level: i + 1 })}:</span> <Scene text={h} /></p>)}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label>{t('step.recall.answer')}<input autoFocus lang="en" autoCapitalize="off" autoComplete="off" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} /></label>
        <div className="row">
          <button type="submit" disabled={disabled || !text.trim()}>{t('session.check')}</button>
          <button type="button" className="secondary" disabled={disabled || hint >= 4} onClick={() => setHint((h) => Math.min(4, h + 1) as HintLevel)}>{t('step.recall.hint')}</button>
          <button type="button" className="ghost" disabled={disabled} onClick={() => submit(true)}>{t('step.recall.reveal')}</button>
        </div>
      </form>
    </section>
  );
}

export function OrderStep({ exercise, onSubmit, disabled }: Props<'order'>) {
  const [picked, setPicked] = useState<number[]>([]);
  const elapsed = useTimer();
  const tiles = exercise.tiles;
  return (
    <section>
      <h2>{t('step.order.title')}</h2>
      <p className="prompt">{exercise.translation}</p>
      <p className="answer-line" lang="en">{picked.map((i) => <button type="button" key={i} className="tile picked" disabled={disabled} onClick={() => setPicked((p) => p.filter((x) => x !== i))}>{tiles[i]}</button>)}</p>
      <p className="tiles" lang="en">{tiles.map((w, i) => (picked.includes(i) ? null : <button type="button" key={i} className="tile" disabled={disabled} onClick={() => setPicked((p) => [...p, i])}>{w}</button>))}</p>
      <div className="row">
        <button type="button" disabled={disabled || picked.length === 0} onClick={() => onSubmit({ order: picked.map((i) => tiles[i]!), timeMs: elapsed() })}>{t('session.check')}</button>
        <button type="button" className="secondary" disabled={disabled} onClick={() => setPicked([])}>{t('step.order.reset')}</button>
      </div>
    </section>
  );
}

export function ProduceStep({ exercise, onSubmit, disabled }: Props<'produce'>) {
  const [text, setText] = useState('');
  const elapsed = useTimer();
  return (
    <section>
      <h2>{t('step.produce.title')}</h2>
      <p className="prompt">{exercise.goal}</p>
      <p>{t('step.produce.prompt', { required: exercise.required.join(' + ') })}</p>
      <p className="example">{t('step.produce.model')} <span lang="en">{exercise.model.text}</span></p>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ text, timeMs: elapsed() }); }}>
        <textarea lang="en" rows={3} placeholder={t('step.produce.placeholder')} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} />
        <button type="submit" disabled={disabled || !text.trim()}>{t('session.check')}</button>
      </form>
    </section>
  );
}

export function DictationStep({ exercise, onSubmit, disabled }: Props<'dictation'>) {
  const [text, setText] = useState('');
  const elapsed = useTimer();
  useEffect(() => speak(exercise.speak, exercise.language), [exercise.speak, exercise.language]);
  return (
    <section>
      <h2>{t('step.dictation.title')}</h2>
      <Voice text={exercise.speak} language={exercise.language} />
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ text, timeMs: elapsed() }); }}>
        <input autoFocus lang="en" autoCapitalize="off" autoComplete="off" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} />
        <button type="submit" disabled={disabled || !text.trim()}>{t('session.check')}</button>
      </form>
    </section>
  );
}

// Recorre la sesión paso a paso. Tras cada paso: corrige, envía los eventos al servidor (que recalcula el estado) y
// guarda la posición, para poder cerrar y retomar en el mismo punto. En la vista previa no se guarda nada.
import { useEffect, useMemo, useRef, useState } from 'react';
import { eventsForStep, exerciseFor, gradeStep, type ClientEvent, type StepAnswer, type StepOutcome } from '@memora/experiences';
import { api, ApiError, type Progress, type SessionPayload, type SessionState } from './api';
import { deviceId, nextSeq } from './device';
import { t, type MessageKey } from './i18n';
import { AssociateStep, DictationStep, ListenStep, OrderStep, ProduceStep, RecallStep, Scene, StructureStep } from './steps/Steps';

interface Props {
  payload: SessionPayload;
  courseId: string;
  preview?: boolean;
  onExit: () => void;
  onReload: () => void;
}

export function SessionView({ payload, courseId, preview = false, onExit, onReload }: Props) {
  const [state, setState] = useState<SessionState>(payload.state);
  const [feedback, setFeedback] = useState<StepOutcome | null>(null);
  const [tries, setTries] = useState(0);
  const [warning, setWarning] = useState<MessageKey | null>(payload.resumed ? 'session.resumed' : null);
  const queue = useRef<ClientEvent[]>([]);
  const units = payload.units;
  const plan = state.plan;
  const step = plan.steps[state.index];
  const unit = step ? units[step.unitKey] : undefined;
  const others = useMemo(() => Object.values(units), [units]);
  const exercise = useMemo(() => (step ? exerciseFor(step, unit, others, plan.sessionId) : null), [step, unit, others, plan.sessionId]);

  async function flush() {
    if (preview || queue.current.length === 0) return;
    const batch = queue.current.splice(0, queue.current.length);
    try {
      await api.events(courseId, batch);
    } catch {
      queue.current.unshift(...batch);
      setWarning('session.saveError');
    }
  }

  async function saveIndex(index: number, outcomes: SessionState['outcomes']) {
    const finished = index >= plan.steps.length || plan.steps[index]?.kind === 'result';
    setState((s) => ({ ...s, index, outcomes, finished }));
    if (preview) return;
    try {
      await api.position(courseId, { sessionId: plan.sessionId, index, outcomes, finished, deviceId: deviceId() });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SESSION_CHANGED') {
        setWarning('session.changed');
        onReload();
      } else setWarning('session.saveError');
    }
  }

  function record(outcome: StepOutcome | null, answer: StepAnswer | null, firstTry: boolean) {
    if (!step || !exercise) return;
    const events = eventsForStep(plan, { ...step, exposeFirst: step.exposeFirst && firstTry }, exercise, outcome, answer, { at: Date.now(), deviceId: deviceId(), nextSeq, newId: () => crypto.randomUUID() });
    queue.current.push(...events);
  }

  async function next(outcome: StepOutcome | null) {
    const outcomes = outcome && step ? { ...state.outcomes, [step.id]: { correct: outcome.correct, hint: outcome.hint, ...(outcome.expected ? { expected: outcome.expected } : {}) } } : state.outcomes;
    setFeedback(null);
    setTries(0);
    await flush();
    await saveIndex(state.index + 1, outcomes);
  }

  function submit(answer: StepAnswer) {
    if (!step || !exercise) return;
    const outcome = gradeStep(step, exercise, answer);
    record(outcome, answer, tries === 0);
    setTries((n) => n + 1);
    setFeedback(outcome);
  }

  // Una frase propia con problemas admite un segundo intento (cada intento queda registrado).
  const canRetry = feedback && !feedback.correct && step?.kind === 'produce' && tries < 2;

  if (plan.steps.length === 0) {
    return <main className="session"><p>{t('session.empty')}</p><button type="button" onClick={onExit}>{t('session.back')}</button></main>;
  }

  return (
    <main className="session">
      {preview && <p className="banner">{t('preview.banner')} {payload.status && t('preview.status', { status: payload.status })}</p>}
      {warning && <p className="banner warn" role="status">{t(warning)}</p>}
      <p className="progress">{t('session.progress', { current: Math.min(state.index + 1, plan.steps.length), total: plan.steps.length })}</p>
      <progress max={plan.steps.length} value={state.index} />
      {!step || step.kind === 'result' || !exercise || exercise.kind === 'result' ? (
        <Result state={state} courseId={courseId} preview={preview} onExit={onExit} />
      ) : (
        <>
          {exercise.kind === 'listen' && <ListenStep exercise={exercise} onContinue={() => { record(null, null, true); void next(null); }} />}
          {exercise.kind === 'associate' && <AssociateStep exercise={exercise} onContinue={() => { record(null, null, true); void next(null); }} />}
          {exercise.kind === 'structure' && <StructureStep exercise={exercise} onContinue={() => { record(null, null, true); void next(null); }} />}
          {exercise.kind === 'recall' && <RecallStep key={step.id} exercise={exercise} step={step} onSubmit={submit} disabled={Boolean(feedback)} />}
          {exercise.kind === 'order' && <OrderStep key={step.id} exercise={exercise} step={step} onSubmit={submit} disabled={Boolean(feedback)} />}
          {exercise.kind === 'produce' && <ProduceStep key={`${step.id}-${tries}`} exercise={exercise} step={step} onSubmit={submit} disabled={Boolean(feedback) && !canRetry} />}
          {exercise.kind === 'dictation' && <DictationStep key={step.id} exercise={exercise} step={step} onSubmit={submit} disabled={Boolean(feedback)} />}
          {feedback && (
            <div className={`feedback ${feedback.correct ? 'ok' : 'ko'}`} role="status">
              <p><strong>{t(feedback.correct ? 'feedback.correct' : 'feedback.incorrect')}</strong></p>
              {!feedback.correct && feedback.problems?.map((p) => <p key={p}>{t(`step.produce.${p}` as MessageKey, { required: exercise.kind === 'produce' ? exercise.required.join(' + ') : '' })}</p>)}
              {!feedback.correct && feedback.expected && !feedback.problems?.length && <p>{t('feedback.expected', { expected: feedback.expected })}</p>}
              {exercise.kind === 'recall' && unit?.association && <p className="scene">{t('feedback.scene')} <Scene text={unit.association.text} /></p>}
              {!canRetry && <button type="button" autoFocus onClick={() => void next(feedback)}>{t('session.continue')}</button>}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Result({ state, courseId, preview, onExit }: { state: SessionState; courseId: string; preview: boolean; onExit: () => void }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    if (!preview) api.progress(courseId).then(setProgress).catch(() => setProgress(null));
  }, [courseId, preview]);
  const outcomes = Object.values(state.outcomes);
  const touched = new Set(state.plan.steps.map((s) => s.skillKey).filter(Boolean));
  const unitsTouched = new Set(state.plan.steps.map((s) => s.unitKey).filter(Boolean));
  const fmt = (ms: number) => new Date(ms).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <section>
      <h2>{t('result.title')}</h2>
      <p>{t('result.done', { attempts: outcomes.length, correct: outcomes.filter((o) => o.correct && o.hint === 0).length, helped: outcomes.filter((o) => o.correct && o.hint > 0).length })}</p>
      {progress && (
        <>
          <h3>{t('result.next')}</h3>
          <ul>
            {progress.units.filter((u) => unitsTouched.has(u.key)).map((u) => <li key={u.key}>{t('result.unit', { unit: u.key, level: t(`level.${u.level}` as MessageKey) })}</li>)}
            {progress.skills.filter((s) => touched.has(s.key) && s.dueAt).map((s) => <li key={s.key} className="note">{t('result.due', { skill: `${s.key} (${t(`status.${s.status}` as MessageKey)})`, when: fmt(s.dueAt!) })}</li>)}
          </ul>
        </>
      )}
      <button type="button" onClick={onExit}>{t('session.back')}</button>
    </section>
  );
}

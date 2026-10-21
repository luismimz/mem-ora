// Banco de pruebas del modo Flujo con datos fijos, sin servidor (modo sin conexión). Solo lo usa `e2e/flow-touch.mjs`.
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import { Feed } from '../src/Feed';
import type { SessionPayload } from '../src/api';

const example = (text: string) => ({ text, translation: 'Traducción de ejemplo, lo bastante larga para ocupar dos líneas en el móvil.' });
function term(key: string, text: string, meaning: string, long: boolean) {
  return {
    key, type: 'term', language: 'en', version: 1, skills: [{ key: `${key}:recall`, kind: 'recall' }],
    payload: {
      form: 'word', text, meaning,
      examples: long
        ? [example('I am looking for my keys in the kitchen right now'), example('She lost the key of the car yesterday evening'), example('Where is the key that opens the red door?'), example('The kiwi swallowed the key and ran away')]
        : [example(`A ${text}`)],
    },
    association: { emoji: '🔑', cue: 'KIWI', technique: 'phonetic', text: long ? 'Un KIWI enorme se traga una LLAVE dorada y sale rodando' : 'Un KIWI se traga una LLAVE' },
  };
}
const units = { a: term('a', 'key', 'llave', false), b: term('b', 'lock', 'cerradura', true), c: term('c', 'door', 'puerta', false), d: term('d', 'house', 'casa', false) };
const steps = [
  { id: 'r1', kind: 'reel', unitKey: 'a', scene: 0 },
  { id: 'r2', kind: 'reel', unitKey: 'b', scene: 0 },
  { id: 'q1', kind: 'quick', unitKey: 'a', scene: 0, reverse: false },
  { id: 'j1', kind: 'judge', unitKey: 'b', scene: 0, statementOf: 'b' },
  { id: 'end', kind: 'summary', unitKey: '', scene: 0 },
];
const payload = { state: { plan: { mode: 'flow', sessionId: 'e2e', courseId: 'e2e', day: 1, createdAt: 0, scenes: [], steps }, index: 0, outcomes: {}, finished: false }, units } as unknown as SessionPayload;

const log: string[] = [];
(window as unknown as { __flowLog: string[] }).__flowLog = log;
createRoot(document.getElementById('root')!).render(
  <Feed payload={payload} courseId="e2e" offline onExit={() => log.push('exit')} onAgain={() => log.push('again')} />,
);

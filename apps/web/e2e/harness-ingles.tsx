// Banco de pruebas del Flujo en inglés (D-079) con el planificador real: palabras con escucha y «Construye la frase» y
// un truco de gramática. Datos fijos y sin servidor. Solo lo usa `e2e/flow-touch.mjs`.
import { createRoot } from 'react-dom/client';
import { buildFlowSession, type SessionUnit } from '@memora/experiences';
import '../src/styles.css';
import { Feed } from '../src/Feed';
import type { SessionPayload } from '../src/api';

const word = (key: string, text: string, meaning: string, ex: string, tr: string, cue: string, scene: string): SessionUnit => ({
  key, type: 'term', language: 'en', version: 1,
  payload: { form: 'word', text, meaning, examples: [{ text: ex, translation: tr }] },
  skills: [{ key: `${key}.listen`, kind: 'listen' }, { key: `${key}.recall`, kind: 'recall' }, { key: `${key}.produce`, kind: 'produce' }],
  association: { id: `a-${key}`, technique: 'absurd_scene', cue, text: scene, emoji: '🎈' },
} as unknown as SessionUnit);
const units: Record<string, SessionUnit> = {
  dog: word('dog', 'dog', 'perro', 'My dog is very big.', 'Mi perro es muy grande.', 'DOGO', 'Un DOGO gigante es el PERRO del rey.'),
  cat: word('cat', 'cat', 'gato', 'The cat sleeps on the sofa.', 'El gato duerme en el sofá.', 'CATA', 'Un GATO hace una CATA de leche.'),
  house: word('house', 'house', 'casa', 'Our house is near the park.', 'Nuestra casa está cerca del parque.', 'JAULA', 'Tu CASA es una JAULA con jardín.'),
  car: word('car', 'car', 'coche', 'I drive my car to work.', 'Conduzco mi coche al trabajo.', 'CARRO', 'Un CARRO de bebé tira de tu COCHE.'),
  'present-continuous': {
    key: 'present-continuous', type: 'pattern', language: 'en', version: 1,
    payload: {
      goal: 'Decir lo que estás haciendo ahora', rule: 'am / is / are + verbo con -ing',
      pieces: [{ text: 'I', role: 'fixed', hint: 'YO' }, { text: 'am', role: 'fixed', hint: 'estoy' }, { text: 'read', role: 'slot', hint: 'le' }, { text: '-ing', role: 'fixed', hint: '-yendo' }],
      examples: [{ text: 'I am reading a book.', translation: 'Estoy leyendo un libro.' }, { text: 'She is cooking now.', translation: 'Ella está cocinando ahora.' }],
      pitfalls: ['En inglés el sujeto nunca se omite: «Am reading» está mal; es «I am reading».'],
    },
    skills: [{ key: 'pc.recall', kind: 'recall' }, { key: 'pc.produce', kind: 'produce' }],
    association: { id: 'a-pc', technique: 'mirror', text: 'YO ESTOY le-YENDO → I AM read-ING', emoji: '🪞' },
  } as unknown as SessionUnit,
};
const items = Object.keys(units).map((k) => ({ skillId: `${k}.recall`, unitId: k, reason: 'new' as const, priority: 0, recommendedHint: 0 as const }));
const plan = buildFlowSession({ sessionId: 'e2e-ingles', courseId: 'e2e', day: 1, createdAt: 0, items, units, audio: true });
const payload = { state: { plan, index: 0, outcomes: {}, finished: false }, units } as unknown as SessionPayload;
const w = window as unknown as { __flowLog: string[]; __plan: unknown; __units: unknown };
w.__flowLog = []; w.__plan = plan; w.__units = units;
createRoot(document.getElementById('root')!).render(<Feed payload={payload} courseId="e2e" offline onExit={() => w.__flowLog.push('exit')} onAgain={() => w.__flowLog.push('again')} />);

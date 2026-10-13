import type { SessionUnit } from '../src';

export const borrow: SessionUnit = {
  key: 'borrow',
  type: 'term',
  language: 'en',
  version: 1,
  payload: {
    form: 'word',
    text: 'borrow',
    meaning: 'pedir prestado',
    examples: [{ text: 'Can I borrow your charger?', translation: '¿Me prestas tu cargador?' }],
  },
  skills: [
    { key: 'borrow.listen', kind: 'listen' },
    { key: 'borrow.recall', kind: 'recall', associationId: 'a-borrow' },
    { key: 'borrow.produce', kind: 'produce' },
  ],
  association: { id: 'a-borrow', technique: 'phonetic_bridge', cue: 'burro', text: 'Un BURRO te PIDE PRESTADO el móvil.' },
};

export const cantFind: SessionUnit = {
  key: 'i-cant-find',
  type: 'term',
  language: 'en',
  version: 1,
  payload: {
    form: 'expression',
    text: 'I can’t find…',
    meaning: 'no encuentro…',
    examples: [{ text: "I can't find my keys.", translation: 'No encuentro mis llaves.' }],
  },
  skills: [{ key: 'i-cant-find.recall', kind: 'recall' }, { key: 'i-cant-find.produce', kind: 'produce' }],
};

export const canI: SessionUnit = {
  key: 'can-i',
  type: 'pattern',
  language: 'en',
  version: 1,
  payload: {
    goal: 'Pedir permiso o algo prestado',
    rule: '«Can» va primero en la pregunta y el verbo no cambia.',
    pieces: [{ text: 'Can I', role: 'fixed' }, { text: 'verbo', role: 'slot' }, { text: 'objeto', role: 'slot' }],
    examples: [
      { text: 'Can I borrow your pen?', translation: '¿Me prestas tu boli?' },
      { text: 'Can I use your phone?', translation: '¿Puedo usar tu móvil?' },
      { text: 'Can I take a photo?', translation: '¿Puedo hacer una foto?' },
    ],
  },
  skills: [{ key: 'can-i.recall', kind: 'recall' }, { key: 'can-i.produce', kind: 'produce' }],
};

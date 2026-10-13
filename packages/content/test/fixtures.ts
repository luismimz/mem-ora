// Ejemplos de prueba con unidades de la habitación del H2 (borrador; el contenido real lo revisa el usuario).
export const borrow = {
  form: 'word',
  text: 'borrow',
  meaning: 'pedir prestado',
  partOfSpeech: 'verbo',
  pronunciation: { ipa: '/ˈbɒr.əʊ/' },
  examples: [{ text: 'Can I borrow your charger?', translation: '¿Me prestas tu cargador?' }],
};

export const canI = {
  goal: 'Pedir permiso o algo prestado',
  rule: '«Can» va primero en la pregunta y el verbo no cambia.',
  pieces: [
    { text: 'Can I', role: 'fixed' },
    { text: 'verbo', role: 'slot', hint: 'borrow, use, take…' },
    { text: 'objeto', role: 'slot' },
  ],
  examples: [
    { text: 'Can I borrow your pen?', translation: '¿Me prestas tu boli?' },
    { text: 'Can I use your phone?', translation: '¿Puedo usar tu móvil?' },
    { text: 'Can I take a photo?', translation: '¿Puedo hacer una foto?' },
  ],
};

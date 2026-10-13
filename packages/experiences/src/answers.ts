// Corrección local de respuestas, sin IA (regla 12). Agnóstica de la materia: compara textos normalizados.

/** Minúsculas, comillas tipográficas unificadas, sin puntuación ni puntos suspensivos, espacios simples. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”«»"]/g, '')
    .replace(/…|\.\.\./g, ' ')
    .replace(/[.,;:!?¿¡()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const sameAnswer = (given: string, expected: string): boolean => normalizeAnswer(given) !== '' && normalizeAnswer(given) === normalizeAnswer(expected);

/** ¿Aparece `piece` como secuencia de palabras completas dentro de `text`? */
export function containsPhrase(text: string, piece: string): boolean {
  const t = ` ${normalizeAnswer(text)} `;
  const p = normalizeAnswer(piece);
  return p !== '' && t.includes(` ${p} `);
}

export type OwnSentenceProblem = 'too_short' | 'missing_piece' | 'copied_example';

/**
 * Frase propia: debe tener al menos `minWords` palabras, contener todas las piezas obligatorias y no ser copia de un
 * ejemplo. Solo comprueba la estructura; no juzga si la frase es natural (eso no se hace con IA en la lección).
 */
export function checkOwnSentence(text: string, required: string[], examples: string[], minWords = 3): OwnSentenceProblem[] {
  const problems: OwnSentenceProblem[] = [];
  const words = normalizeAnswer(text).split(' ').filter(Boolean);
  if (words.length < minWords) problems.push('too_short');
  if (required.some((piece) => !containsPhrase(text, piece))) problems.push('missing_piece');
  if (examples.some((e) => sameAnswer(text, e))) problems.push('copied_example');
  return problems;
}

/** Fichas de una frase para ordenarlas: las palabras de la frase (sin puntuación final) más los distractores. */
export function orderTiles(sentence: string, distractors: string[]): { answer: string[]; tiles: string[] } {
  const answer = sentence.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
  const tiles = [...answer, ...distractors.filter((d) => !answer.some((a) => normalizeAnswer(a) === normalizeAnswer(d)))];
  return { answer, tiles };
}

/** Pista P1: primera letra y huecos con la longitud de cada palabra («b _ _ _ _ _»). */
export function firstLetterHint(text: string): string {
  return text
    .split(/\s+/)
    .map((w) => (w.length ? `${w[0]}${' _'.repeat(Math.max(0, w.replace(/[^\p{L}\p{N}']/gu, '').length - 1))}` : w))
    .join('   ');
}

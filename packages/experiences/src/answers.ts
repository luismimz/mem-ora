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
    .trim()
    // «I am sorry» = «I'm sorry», «do not» = «don't»… (usuario, 5-nov-2026): las contracciones del inglés valen igual.
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bcan't\b|\bcannot\b/g, 'can not')
    .replace(/\bshan't\b/g, 'shall not')
    .replace(/n't\b/g, ' not')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/'re\b/g, ' are')
    .replace(/'ve\b/g, ' have')
    .replace(/'ll\b/g, ' will')
    .replace(/\b(it|he|she|that|what|there|where|who|here|how)'s\b/g, '$1 is')
    .replace(/\s+/g, ' ');
}

export const sameAnswer = (given: string, expected: string): boolean => {
  const g = normalizeAnswer(given), e = normalizeAnswer(expected);
  if (g || e) return g !== '' && g === e;
  // Respuestas que son solo símbolos («;», «==», «{}»): la normalización las dejaba vacías y nunca se acertaban
  // (usuario, 2-nov-2026: «Caza el bug» marcaba mal el «;»). Se comparan tal cual, sin espacios.
  const raw = (t: string) => t.replace(/\s+/g, '');
  return raw(given) !== '' && raw(given) === raw(expected);
};

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

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]!; d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length]!;
}

/**
 * «Casi» (usuario, 5-nov-2026: «it depend», «I not sure»): si la respuesta está a una palabra o una letra de la buena,
 * devuelve qué falló, en español, para enseñarlo. Sigue contando como fallo, así que la palabra vuelve a salir.
 */
export function nearMiss(given: string, expected: string): string | null {
  const g = normalizeAnswer(given).split(' ').filter(Boolean), e = normalizeAnswer(expected).split(' ').filter(Boolean);
  if (!g.length || !e.length || g.join(' ') === e.join(' ')) return null;
  if (g.length === e.length) {
    const diff = e.map((w, i) => [g[i]!, w] as const).filter(([a, b]) => a !== b);
    if (diff.length !== 1) return null;
    const [a, b] = diff[0]!;
    if (b === `${a}s`) return `Falta la -s: «${b}», no «${a}».`;
    if (b === `${a}ed` || b === `${a}d`) return `Falta el pasado: «${b}», no «${a}».`;
    if (editDistance(a, b) <= Math.max(1, Math.floor(b.length / 4))) return `Cuidado con cómo se escribe: «${b}», no «${a}».`;
    return e.length > 1 ? `Cambia una palabra: «${b}», no «${a}».` : null;
  }
  if (Math.abs(g.length - e.length) === 1) {
    const [short, long] = g.length < e.length ? [g, e] : [e, g];
    for (let i = 0; i < long.length; i++) {
      if ([...long.slice(0, i), ...long.slice(i + 1)].join(' ') === short.join(' ')) {
        return g.length < e.length ? `Te faltó «${long[i]}».` : `Sobra «${long[i]}».`;
      }
    }
  }
  return null;
}

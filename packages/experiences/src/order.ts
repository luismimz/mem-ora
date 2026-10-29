// Por qué cambia el orden del español al inglés (D-088). Las frases con espejo guardan las piezas en el orden del
// español y el orden inglés aparte; cuando el alumno ordena mal, se dice QUÉ regla de orden ha roto, si se reconoce con
// seguridad. Si no, solo «has seguido el orden del español». Prudente: una explicación falsa es peor que ninguna.

export interface OrderPiece { es: string; en: string; role: string; ghost?: boolean; why?: string }
export interface OrderMirror { pieces: OrderPiece[]; order?: number[] }

export type OrderRule = 'describe' | 'enough' | 'question' | 'object' | 'frequency' | 'ago' | 'would' | 'preposition' | 'time' | 'piece';

export const ORDER_RULES: Record<Exclude<OrderRule, 'piece'>, string> = {
  // Más precisa (usuario, 29-oct-2026): primero se «pinta» la cosa y luego se dice qué es.
  describe: 'Al revés que en español: primero CÓMO es (o de qué tipo) y después QUÉ es: a white cat = un gato blanco.',
  question: 'En las preguntas, el ayudante (are, is, can, do…) salta DELANTE del quién: Are you…?, Can you…?',
  object: 'En inglés, me, te, la, lo… van DETRÁS del verbo: help me, I saw her.',
  frequency: 'Always, never, often, already, still… van entre el quién y el verbo: I always drink, I have already eaten.',
  ago: 'AGO va al final: two days ago (hace dos días).',
  would: 'La -RÍA del español se convierte en WOULD delante del verbo: I would come.',
  preposition: 'En las preguntas, la preposición se queda al FINAL: Who are you with?',
  enough: 'ENOUGH va DETRÁS de un adjetivo (old enough) y DELANTE de un nombre (enough time).',
  time: 'Cuándo y dónde (today, tomorrow, here, tonight…) suelen ir al FINAL de la frase: I\'m busy today.',
};
const TIME_PLACE = /^(hoy|mañana|ayer|aquí|allí|fuera|esta|en|por|de|durante|primero|después)$/i;
const TIME_PLACE_EN = /\b(today|tomorrow|yesterday|tonight|here|there|outside|in summer|in winter|in the morning|on holiday|first|for \w+ (hours|days|minutes)|in this region|at the roundabout|in here)$/i;

const CLITICS = new Set(['me', 'te', 'lo', 'la', 'le', 'nos', 'os', 'los', 'las', 'les']);
const FREQUENCY = /^(always|never|often|usually|sometimes|rarely|seldom|already|still|also|just|ever|yet)$/i;
const PREPOSITIONS = /^(with|in|on|at|for|from|to|about|of)$/i;
const words = (t: string) => t.toLowerCase().replace(/[¿?¡!.,]/g, '').split(/\s+/).filter(Boolean);

/** Las piezas que el inglés cambia de sitio respecto al español (índices de pieza), en el orden inglés. */
export function movedPieces(m: OrderMirror): number[] {
  const order = m.order ?? m.pieces.map((_, i) => i);
  return order.filter((piece, pos) => piece !== pos);
}

/** El inglés colocado en el orden del español («She has eyes brown»): el error típico al traducir pieza a pieza. */
export function spanishOrderCalque(m: OrderMirror): string {
  return m.pieces.map((p) => p.en).filter(Boolean).join(' ');
}

/** Qué regla de orden explica el cambio, o `null` si no se reconoce con seguridad. */
export function orderRule(m: OrderMirror, sentence: string): { rule: OrderRule; text: string } | null {
  const moved = movedPieces(m);
  if (!moved.length) return null;
  const own = moved.map((i) => m.pieces[i]!).find((p) => p.why);
  if (own?.why) return { rule: 'piece', text: own.why };
  const en = moved.flatMap((i) => words(m.pieces[i]!.en));
  const es = moved.flatMap((i) => words(m.pieces[i]!.es));
  const question = sentence.trim().endsWith('?');
  if (es.some((w) => w === 'hace') && en.includes('ago')) return { rule: 'ago', text: ORDER_RULES.ago };
  if (en.includes('would') || moved.some((i) => /^-?r[íi]a/i.test(m.pieces[i]!.es.replace(/^-/, '')))) return { rule: 'would', text: ORDER_RULES.would };
  if (question && moved.some((i) => PREPOSITIONS.test(m.pieces[i]!.en.trim()))) return { rule: 'preposition', text: ORDER_RULES.preposition };
  if (en.some((w) => FREQUENCY.test(w))) return { rule: 'frequency', text: ORDER_RULES.frequency };
  if (moved.some((i) => CLITICS.has(m.pieces[i]!.es.trim().toLowerCase()))) return { rule: 'object', text: ORDER_RULES.object };
  if (question && moved.some((i) => ['helper', 'verb'].includes(m.pieces[i]!.role)) && moved.some((i) => m.pieces[i]!.role === 'who')) return { rule: 'question', text: ORDER_RULES.question };
  if (en.includes('enough')) return { rule: 'enough', text: ORDER_RULES.enough };
  // Cuándo y dónde: en español delante («Hoy estoy…»), en inglés al final («…today»).
  const tail = words(sentence).join(' ');
  if (moved.some((i) => TIME_PLACE.test(words(m.pieces[i]!.es)[0] ?? '') && TIME_PLACE_EN.test(m.pieces[i]!.en.toLowerCase().replace(/[.,!?]/g, '').trim()) && tail.endsWith(words(m.pieces[i]!.en).join(' ')))) return { rule: 'time', text: ORDER_RULES.time };
  // Dos palabras seguidas que se dan la vuelta (ojos marrones → brown eyes): lo que describe va delante.
  const order = m.order ?? [];
  if (moved.length === 2 && moved.every((i) => m.pieces[i]!.role === 'word')) {
    const [a, b] = moved as [number, number];
    if (Math.abs(a - b) === 1 && order.indexOf(a) + 1 === order.indexOf(b)) return { rule: 'describe', text: ORDER_RULES.describe };
  }
  return null;
}

/** El trozo del español que cambia de orden («ojos marrones») y cómo queda en inglés («brown eyes»). */
export function orderSwap(m: OrderMirror): { es: string; en: string } | null {
  const moved = movedPieces(m);
  if (!moved.length) return null;
  const es = [...moved].sort((a, b) => a - b).map((i) => m.pieces[i]!.es).filter(Boolean).join(' ');
  const en = moved.map((i) => m.pieces[i]!.en).filter(Boolean).join(' ');
  return { es, en };
}

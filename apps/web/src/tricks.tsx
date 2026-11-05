// Trucos de gramática a la vista (usuario, 5-nov-2026): «que se vea would, have, will, going to, if, verbo base y pasado
// al formar las frases; que se grabe en la cabeza». Se colorean en la frase inglesa y debajo se dice qué hace cada uno.
import type { ReactNode } from 'react';

export type Trick = { key: string; label: string; why: string };

const TRICKS: Array<{ re: RegExp; t: Trick }> = [
  { re: /^(would|'d)$/i, t: { key: 'would', label: 'would', why: 'would + verbo base = «-ría» (iría, comería)' } },
  { re: /^(will|'ll|won't)$/i, t: { key: 'will', label: 'will', why: 'will + verbo base = futuro (iré, comeré)' } },
  { re: /^going$/i, t: { key: 'going', label: 'going to', why: 'am/is/are going to + verbo base = «voy a…» (plan)' } },
  { re: /^(have|has|'ve|haven't|hasn't)$/i, t: { key: 'have', label: 'have/has', why: 'have/has + participio = «he/ha…» (presente perfecto); solo = tener' } },
  { re: /^(had|hadn't)$/i, t: { key: 'had', label: 'had', why: 'had = tenía/tuvo; had + participio = «había…»' } },
  { re: /^if$/i, t: { key: 'if', label: 'if', why: 'if = si (condición): if + presente → will; if + pasado → would' } },
  { re: /^(did|didn't)$/i, t: { key: 'did', label: 'did', why: 'did + verbo BASE = pasado en preguntas y negaciones (did you go?)' } },
  { re: /^(do|does|don't|doesn't)$/i, t: { key: 'do', label: 'do/does', why: 'do/does + verbo base = preguntas y negaciones en presente' } },
  { re: /^(can|can't|cannot|could|couldn't|should|shouldn't|must)$/i, t: { key: 'modal', label: 'can/could/should/must', why: 'después de can, could, should, must: verbo BASE, sin «to» ni «-s»' } },
  { re: /^(was|were|wasn't|weren't)$/i, t: { key: 'was', label: 'was/were', why: 'was/were = pasado de to be (era, estaba)' } },
];

const IRREGULAR_PAST = new Set(['went', 'saw', 'ate', 'drank', 'came', 'took', 'gave', 'got', 'made', 'said', 'told', 'thought', 'bought', 'brought', 'found', 'left', 'felt', 'knew', 'met', 'paid', 'ran', 'sat', 'slept', 'spoke', 'spent', 'stood', 'taught', 'understood', 'wrote', 'woke', 'won', 'lost', 'forgot', 'began', 'broke', 'chose', 'drove', 'flew', 'heard', 'kept', 'read', 'sold', 'sent', 'swam', 'caught', 'fell', 'grew', 'hid', 'held', 'meant', 'rode', 'rang', 'stole', 'threw', 'wore', 'became', 'built', 'did']);
const NOT_PAST = new Set(['need', 'red', 'bed', 'hundred', 'speed', 'feed', 'seed', 'bread', 'head', 'ahead', 'tired', 'married', 'interested', 'bored', 'excited', 'used', 'naked', 'wicked', 'sacred', 'shed', 'wed', 'indeed', 'instead', 'weekend', 'friend']);
const PAST: Trick = { key: 'past', label: 'pasado', why: 'verbo en pasado (-ed o irregular): fui, vi, comí' };
const PART: Trick = { key: 'part', label: 'participio', why: 'tras have/has/had va el participio (-ed o 3ª columna): he terminado' };

function trickOf(word: string, prev: string): Trick | null {
  const w = word.toLowerCase().replace(/[’]/g, "'");
  for (const { re, t } of TRICKS) if (re.test(w)) return t;
  const bare = w.replace(/'.*$/, '');
  if (bare !== w && /^(i|you|we|they|he|she|it)$/.test(bare)) {
    const tail = w.slice(bare.length);
    for (const { re, t } of TRICKS) if (re.test(tail)) return t;
  }
  // Tras «to be» (I am tired) un -ed es adjetivo, no pasado.
  if (/^(am|is|are|be|very|so|really|get|got|feel)$/i.test(prev)) return null;
  const afterHave = /^(have|has|had|'ve|i've|we've|you've|they've|haven't|hasn't)$/i.test(prev);
  if (afterHave && (w.endsWith('ed') || /^(been|done|gone|seen|eaten|taken|given|written|spoken|known|made|got|gotten|had|found|lost|bought)$/.test(w))) return PART;
  if (IRREGULAR_PAST.has(w) && w !== 'did' && w !== 'read') return PAST;
  if (w.length > 4 && /ed$/.test(w) && !NOT_PAST.has(w)) return PAST;
  return null;
}

/** Los trucos que aparecen en una frase inglesa, en orden y sin repetir. */
export function tricksIn(text: string): Trick[] {
  const out: Trick[] = [];
  const words = text.split(/[^A-Za-z'’]+/).filter(Boolean);
  words.forEach((w, i) => { const t = trickOf(w, words[i - 1] ?? ''); if (t && !out.some((o) => o.key === t.key)) out.push(t); });
  return out;
}

/** La frase con los trucos coloreados y, debajo, qué hace cada uno. */
export function TrickText({ text, lang, legend = true, after }: { text: string; lang?: string; legend?: boolean; after?: ReactNode }) {
  if (lang && !lang.startsWith('en')) return <>{text}{after}</>;
  const parts = text.split(/([A-Za-z'’]+)/);
  let prev = '';
  const found = tricksIn(text);
  return (
    <>
      <span lang={lang}>
        {parts.map((p, i) => {
          if (!/^[A-Za-z'’]+$/.test(p)) return p;
          const t = trickOf(p, prev); prev = p;
          return t ? <mark key={i} className={`trick trick-${t.key}`}>{p}</mark> : p;
        })}
      </span>
      {after}
      {legend && found.length > 0 && (
        <span className="trick-legend">{found.map((t) => <span key={t.key} className={`trick-why trick-${t.key}`}>🧩 <b>{t.label}</b>: {t.why}</span>)}</span>
      )}
    </>
  );
}

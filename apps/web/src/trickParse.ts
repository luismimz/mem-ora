// El truco de gramática de una frase inglesa (usuario, 5-nov-2026). Un solo truco por frase, el protagonista:
//  - qué palabra inglesa es el truco (would, will, going to, have, pasado, -ing, -s, can…),
//  - qué forma lleva el verbo (base, -s, 2ª pasado, 3ª participio, -ing),
//  - y, si se puede, cómo se parte la palabra española: «gustaría» → «gust» + «aría» (= would), que en inglés salta delante.
// Solo inglés para hispanohablantes: es una técnica de este par de idiomas, no del núcleo (regla 2).

export type TrickKey = 'would' | 'will' | 'going' | 'have' | 'past' | 'irregular' | 'ing' | 's' | 'modal' | 'did' | 'do';
export type VerbForm = 'base' | '-s' | '2ª · pasado' | '3ª · participio' | '-ing';

export interface TrickInfo { key: TrickKey; name: string; formula: string; hook: string }

export const TRICK_INFO: Record<TrickKey, TrickInfo> = {
  would: { key: 'would', name: 'WOULD = -ría', formula: 'quién + would + verbo base', hook: 'would es la terminación «-ría»: gustaría → would like. Truco: suena «gud», como el «gu» de «me gustaría».' },
  will: { key: 'will', name: 'WILL = futuro', formula: 'quién + will + verbo base', hook: 'will significa «voluntad»: lo que quieres hacer, lo que harás. llamaré → will call.' },
  going: { key: 'going', name: 'GOING TO = voy a', formula: 'quién + am/is/are going to + verbo base', hook: '«voy a…» = «I am going to…»: un plan que ya está en marcha (-ing = -ando).' },
  have: { key: 'have', name: 'HAVE + 3ª = he …-ado', formula: 'quién + have/has + 3ª columna (participio)', hook: '«1 hoy, 2 ayer, 3 con have». La 3ª es el «-ado/-ido»: he comido = I have eaten.' },
  past: { key: 'past', name: 'PASADO con -ED', formula: 'quién + verbo-ed (2ª columna)', hook: '-ed y -ado llevan la D: llamé = called. El pasado se queda al final, como en español.' },
  irregular: { key: 'irregular', name: 'PASADO IRREGULAR', formula: 'quién + 2ª columna', hook: '«1 hoy, 2 ayer, 3 con have»: go · went · gone. La 2ª es la de ayer.' },
  ing: { key: 'ing', name: '-ING = -ando/-iendo', formula: 'quién + am/is/are + verbo-ing', hook: '-ing = -ando/-iendo: comiendo = eating. Algo que pasa ahora mismo.' },
  s: { key: 's', name: 'LA -S DE HE/SHE/IT', formula: 'he/she/it + verbo-s', hook: 'Él y ella llevan S, de Señor y Señora: she eats, he works.' },
  modal: { key: 'modal', name: 'CAN/SHOULD/MUST + base', formula: 'quién + can/could/should/must + verbo base', hook: 'Detrás de can, could, should y must, el verbo va «desnudo»: sin «to» y sin «-s».' },
  did: { key: 'did', name: 'DID = pasado en preguntas', formula: 'Did + quién + verbo base?  ·  quién + didn’t + verbo base', hook: 'did ya lleva el pasado; el verbo vuelve a la base: Did you go? (no «Did you went?»).' },
  do: { key: 'do', name: 'DO/DOES = pregunta o negación', formula: 'Do/Does + quién + verbo base?  ·  quién + don’t/doesn’t + base', hook: 'do/does solo sirve de «ayudante» para preguntar o negar; el verbo se queda en base.' },
};

export interface EnToken { text: string; trick?: boolean; form?: VerbForm; tail?: string }
export interface EsSplit { index: number; root: string; ending: string; meaning: string }
export interface Analysis { key: TrickKey; en: EnToken[]; es: string[]; split?: EsSplit; phrase?: [number, number]; jump: boolean }

const IRREGULAR_PAST = new Set(['went', 'saw', 'ate', 'drank', 'came', 'took', 'gave', 'got', 'made', 'said', 'told', 'thought', 'bought', 'brought', 'found', 'left', 'felt', 'knew', 'met', 'paid', 'ran', 'sat', 'slept', 'spoke', 'spent', 'stood', 'taught', 'understood', 'wrote', 'woke', 'won', 'lost', 'forgot', 'began', 'broke', 'chose', 'drove', 'flew', 'heard', 'kept', 'sold', 'sent', 'swam', 'caught', 'fell', 'grew', 'hid', 'held', 'meant', 'rode', 'rang', 'stole', 'threw', 'wore', 'became', 'built', 'was', 'were', 'had', 'did']);
const PARTICIPLES = new Set(['been', 'done', 'gone', 'seen', 'eaten', 'taken', 'given', 'written', 'spoken', 'known', 'made', 'got', 'gotten', 'had', 'found', 'lost', 'bought', 'brought', 'told', 'said', 'thought', 'left', 'met', 'paid', 'sent', 'forgotten', 'broken', 'chosen', 'driven', 'flown', 'heard', 'kept', 'sold', 'begun', 'drunk', 'swum', 'come', 'become', 'run', 'won', 'worn', 'stolen', 'understood', 'felt', 'slept', 'spent', 'taught', 'caught', 'built']);
const NOT_ED = new Set(['need', 'red', 'bed', 'hundred', 'speed', 'feed', 'seed', 'bread', 'head', 'ahead', 'shed', 'wed', 'indeed', 'instead', 'weekend', 'friend', 'sacred', 'naked', 'wicked']);
const ADJ_ED = new Set(['tired', 'married', 'interested', 'bored', 'excited', 'used', 'worried', 'surprised', 'scared', 'closed', 'crowded', 'retired', 'located', 'qualified', 'experienced', 'detailed', 'related', 'advanced', 'organised', 'organized', 'relaxed', 'confused', 'disappointed', 'amazed', 'annoyed', 'pleased', 'embarrassed', 'stressed']);
const NOT_VERB_AFTER_TO = /^(the|a|an|my|your|his|her|our|their|this|that|these|those|school|work|bed|church|london|madrid|spain|me|you|him|us|them|it)$/;
const PRON_3 = /^(he|she|it)$/;
const BE_NOW = /^(am|is|are|'m|'re|'s|was|were)$/;
const MODALS = /^(can|could|should|must|might|can't|couldn't|shouldn't|mustn't|cannot)$/;
const ING_NOUNS = new Set(['nothing', 'something', 'anything', 'everything', 'morning', 'evening', 'thing', 'ceiling', 'building', 'king', 'ring', 'spring', 'string', 'wedding', 'meeting', 'feeling', 'interesting', 'boring', 'amazing', 'exciting', 'surprising', 'tiring', 'relaxing', 'annoying', 'during', 'ceiling']);

const clean = (w: string) => w.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, '');

/** Parte «I'll» en «I» + «'ll»; el resto tal cual. */
function enTokens(text: string): EnToken[] {
  const out: EnToken[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const m = /^([A-Za-z]+)(['’](?:ll|d|ve|m|re))([^A-Za-z']*)$/.exec(raw);
    if (m) { out.push({ text: m[1]! }); out.push({ text: `${m[2]}${m[3]}` }); } else out.push({ text: raw });
  }
  return out;
}

function isEdPast(w: string) { return w.length > 4 && w.endsWith('ed') && !NOT_ED.has(w) && !ADJ_ED.has(w); }

const STOP_ES = new Set(['café', 'bebé', 'qué', 'sé', 'josé', 'también', 'aquí', 'allí', 'ahí', 'sí', 'mí', 'así', 'aún', 'tú', 'él', 'más', 'está', 'esté', 'dé', 'fue', 'jamás', 'después', 'inglés', 'francés', 'país', 'maría', 'día', 'tía', 'vía', 'guía', 'policía', 'cafetería', 'librería', 'panadería', 'frutería', 'carnicería', 'ingeniería', 'energía', 'alegría', 'compañía', 'batería', 'categoría', 'mayoría', 'lotería', 'galería', 'peluquería', 'joyería', 'zapatería', 'pescadería', 'tontería', 'economía', 'filosofía', 'geografía', 'fotografía', 'sabiduría', 'cortesía', 'travesía', 'sacristía', 'mercancía', 'lejanía', 'fantasía', 'tecnología', 'biología', 'teoría', 'garantía', 'cercanía', 'compañía', 'avería', 'hacía', 'había', 'tenía', 'quería', 'sabía', 'podía', 'vivía', 'comía', 'salía', 'decía', 'venía', 'ponía', 'leía', 'oía', 'traía', 'reía', 'sonreía', 'ahora', 'hora', 'para', 'otra', 'cara', 'clara', 'nunca', 'papá', 'mamá', 'sofá', 'ya', 'allá', 'acá', 'jamás', 'compré', 'menú', 'champú', 'perú', 'canapé', 'puré', 'chalé', 'consomé', 'quizá', 'quizás', 'detrás', 'atrás', 'además', 'demás', 'nadie', 'interés', 'estrés', 'mes', 'vez', 'adiós', 'dios', 'avión', 'camión', 'canción', 'razón', 'corazón']);

const wordsEs = (es: string) => es.split(/\s+/).filter(Boolean);
const cleanEs = (w: string) => w.toLowerCase().replace(/^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$/g, '');

/** Busca en la frase española la palabra cuya terminación es el truco; devuelve raíz + terminación. */
function splitEs(es: string[], endings: RegExp, minRoot = 2): EsSplit | undefined {
  for (let i = 0; i < es.length; i++) {
    const w = cleanEs(es[i]!);
    if (!w || STOP_ES.has(w)) continue;
    const m = endings.exec(w);
    if (m && m.index >= minRoot) {
      const raw = es[i]!;
      const start = raw.toLowerCase().indexOf(w);
      const cut = start + m.index;
      return { index: i, root: raw.slice(0, cut), ending: raw.slice(cut, start + w.length), meaning: '' };
    }
  }
  return undefined;
}

/** El truco protagonista de la frase, o null si no hay ninguno claro. */
export function analyzeTrick(enText: string, esText: string): Analysis | null {
  const en = enTokens(enText);
  const w = en.map((t) => clean(t.text));
  const es = wordsEs(esText);
  const at = (i: number) => w[i] ?? '';
  const mark = (i: number, extra: Partial<EnToken> = {}) => { if (en[i]) Object.assign(en[i]!, { trick: true }, extra); };
  const form = (i: number, f: VerbForm) => { if (en[i] && !en[i]!.trick) en[i]!.form = f; };
  // El verbo que sigue al truco, saltando adverbios típicos y negaciones.
  const nextVerb = (i: number) => { let j = i + 1; while (/^(not|n't|never|always|also|really|just|probably|definitely|still|already|ever|you|i|we|they|he|she|it|the|a)$/.test(at(j)) && j < i + 4) j++; return j < w.length ? j : -1; };

  // 1. would
  let i = w.findIndex((x) => x === 'would' || x === "'d" || x === "wouldn't");
  if (i >= 0) {
    mark(i); const v = nextVerb(i); if (v >= 0) form(v, 'base');
    const split = splitEs(es, /(aría|ería|iría|ría)(s|mos|is|n)?$/);
    return { key: 'would', en, es, ...(split ? { split: { ...split, meaning: 'would' } } : {}), jump: Boolean(split) };
  }
  // 2. will
  i = w.findIndex((x) => x === 'will' || x === "'ll" || x === "won't");
  if (i >= 0 && !(i > 0 && /^(free|good|the|a|my|your)$/.test(at(i - 1)))) {
    mark(i); const v = nextVerb(i); if (v >= 0) form(v, 'base');
    const split = splitEs(es, /(aré|eré|iré|ré|arás|erás|irás|rás|ará|erá|irá|rá|aremos|eremos|iremos|remos|aréis|eréis|iréis|réis|arán|erán|irán|rán)$/);
    return { key: 'will', en, es, ...(split ? { split: { ...split, meaning: 'will' } } : {}), jump: Boolean(split) };
  }
  // 3. going to + verbo
  i = w.findIndex((x, k) => x === 'going' && at(k + 1) === 'to' && at(k + 2) !== '' && !NOT_VERB_AFTER_TO.test(at(k + 2)));
  if (i >= 0) {
    mark(i); mark(i + 1); if (i > 0 && BE_NOW.test(at(i - 1))) mark(i - 1); form(i + 2, 'base');
    const k = es.findIndex((x, j) => /^(voy|vas|va|vamos|vais|van|iba|ibas|íbamos|iban)$/i.test(cleanEs(x)) && cleanEs(es[j + 1] ?? '') === 'a');
    return { key: 'going', en, es, ...(k >= 0 ? { phrase: [k, k + 1] as [number, number] } : {}), jump: false };
  }
  // 4. have/has/had + participio
  i = w.findIndex((x, k) => /^(have|has|had|'ve|haven't|hasn't|hadn't)$/.test(x) && (() => { const v = nextVerb(k); return v >= 0 && (isEdPast(at(v)) || PARTICIPLES.has(at(v))); })());
  if (i >= 0) {
    mark(i); const v = nextVerb(i); form(v, '3ª · participio');
    const k = es.findIndex((x, j) => /^(he|has|ha|hemos|habéis|han|había|habías|habíamos|habían)$/i.test(cleanEs(x)) && /(ado|ido|to|cho|so)$/.test(cleanEs(es[j + 1] ?? '')));
    const split = k >= 0 ? splitEs(es.slice(k + 1, k + 2), /(ado|ido|to|cho|so)$/, 1) : undefined;
    return { key: 'have', en, es, ...(k >= 0 ? { phrase: [k, k] as [number, number] } : {}), ...(split ? { split: { ...split, index: k + 1, meaning: '3ª' } } : {}), jump: false };
  }
  // 5. did
  i = w.findIndex((x, k) => x === "didn't" || (x === 'did' && (/^(i|you|he|she|it|we|they|not|the|your|my)$/.test(at(k + 1)) && (k === 0 || /^(what|where|when|why|how|who|which)$/.test(at(k - 1)) || at(k + 1) === 'not'))));
  if (i >= 0) {
    mark(i); const v = nextVerb(i); if (v >= 0) form(v, 'base');
    return { key: 'did', en, es, jump: false };
  }
  // 6. modales
  i = w.findIndex((x) => MODALS.test(x));
  if (i >= 0) {
    mark(i); const v = nextVerb(i); if (v >= 0) form(v, 'base');
    return { key: 'modal', en, es, jump: false };
  }
  // 7. -ing tras to be
  i = w.findIndex((x, k) => x.length > 4 && x.endsWith('ing') && !ING_NOUNS.has(x) && k > 0 && BE_NOW.test(at(k - 1)));
  if (i >= 0) {
    const stem = en[i]!.text.replace(/ing([^A-Za-z]*)$/i, '');
    en[i] = { text: stem, tail: en[i]!.text.slice(stem.length), form: '-ing', trick: true };
    const split = splitEs(es, /(ando|iendo|yendo)$/);
    return { key: 'ing', en, es, ...(split ? { split: { ...split, meaning: '-ing' } } : {}), jump: false };
  }
  // 8. pasado regular -ed (sin have delante)
  i = w.findIndex((x, k) => isEdPast(x) && !/^(be|been|is|are|was|were|am|get|got)$/.test(at(k - 1)));
  if (i >= 0) {
    const stem = en[i]!.text.replace(/e?d([^A-Za-z]*)$/i, (m) => (m.startsWith('ed') ? '' : 'e'));
    const base = en[i]!.text.slice(0, en[i]!.text.toLowerCase().lastIndexOf('ed')) || stem;
    en[i] = { text: base, tail: en[i]!.text.slice(base.length), form: '2ª · pasado', trick: true };
    const split = splitEs(es, /(é|aste|ó|asteis|aron|í|iste|ió|isteis|ieron)$/, 3);
    return { key: 'past', en, es, ...(split ? { split: { ...split, meaning: '-ed' } } : {}), jump: false };
  }
  // 9. pasado irregular
  i = w.findIndex((x, k) => IRREGULAR_PAST.has(x) && !/^(was|were|had)$/.test(x) && k > 0 && !/^(have|has|had|'ve|be|been|turn|on|the|to|your|my|is|are)$/.test(at(k - 1)));
  if (i >= 0) { mark(i, { form: '2ª · pasado' }); return { key: 'irregular', en, es, jump: false }; }
  // 10. do/does en pregunta o negación
  i = w.findIndex((x, k) => (/^(do|does|don't|doesn't)$/.test(x)) && (k === 0 || x.includes("n't")));
  if (i >= 0) { mark(i); const v = nextVerb(i); if (v >= 0) form(v, 'base'); return { key: 'do', en, es, jump: false }; }
  // 11. -s de he/she/it
  i = w.findIndex((x, k) => k > 0 && PRON_3.test(at(k - 1)) && x.length > 2 && /[^s]s$|es$/.test(x) && !/^(is|has|was|does|this|always|as|us)$/.test(x));
  if (i >= 0) {
    const t = en[i]!.text; const m = /(e?s)([^A-Za-z]*)$/.exec(t)!;
    const keepE = /(ss|sh|ch|x|o)es/i.test(t) ? 2 : 1;
    const cut = t.length - m[2]!.length - keepE;
    en[i] = { text: t.slice(0, cut), tail: t.slice(cut), form: '-s', trick: true };
    return { key: 's', en, es, jump: false };
  }
  return null;
}

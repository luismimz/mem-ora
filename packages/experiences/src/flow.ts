// Modo Flujo (D-068, D-077): un deslizar continuo e infinito, al estilo de las redes sociales. Cada ronda enseña antes de
// preguntar (regla de oro, D-067): asociación (reel) y, enseguida, relámpago o «¿verdad o mentira?»; si se falla, la
// ficha aparece en ese momento y la unidad vuelve unas tarjetas después. Cada pocas tarjetas, una pregunta tipo examen.
// Orden de una ronda: lo que toca repasar, «tus errores», lo nuevo y, si no queda nada de eso, refuerzo de lo más débil.
// Las preguntas suben de nivel: con dos repasos superados, en vez de elegir se completa escribiendo.
// La ronda acaba en un hito (resumen) y la siguiente se encadena sola al deslizar. Agnóstico de la materia: en idiomas
// (unidades `term`) también se escribe la palabra nueva; en el resto, solo se escribe al subir de nivel.
// D-079 (idiomas): cada palabra se practica en sus tres habilidades, no solo en reconocer el significado: «Escucha»
// (oír la palabra y elegir qué significa) y «Construye la frase» (ordenar las palabras de un ejemplo real). Sin esto
// ninguna palabra llegaba nunca a «aprendida», porque esas habilidades no se practicaban. La gramática (unidades
// `pattern`) entra en el Flujo con su truco y se practica construyendo frases.
import type { PlanItem } from '@memora/core';
import { exercisesOf, seeded, shuffle, unitMeaning, unitText, MAX_REVIEW_UNITS, type AssocPlan, type AssocStep } from './associations';
import type { SessionUnit } from './session';
import { orderRule, spanishOrderCalque, type OrderMirror } from './order';

/** Tarjetas entre una pregunta fallada y su repesca. */
export const FLOW_RETRY_GAP = 3;
/** Cada cuántas tarjetas llega una pregunta tipo examen. */
export const FLOW_BOSS_EVERY = 8;
/** Repasos superados a partir de los que la pregunta se completa escribiendo (D-077). */
export const FLOW_LEVEL_UP = 2;
/** Respuestas que se pueden escribir en el móvil sin fricción. */
export const FLOW_TYPED_MAX = 24;

/** Palabras de una frase que se construye ordenando fichas: ni tan corta que sea obvia ni tan larga que agobie. */
export const FLOW_BUILD_WORDS = { min: 3, max: 9 } as const;

/** Fichas de «Construye la frase»: las palabras del ejemplo, sin la puntuación final. */
export function buildTiles(text: string): string[] {
  return text.replace(/[.!?¡¿]+$/u, '').split(/\s+/).filter(Boolean);
}

/** Ejemplos de la unidad que se pueden construir con fichas (idiomas y gramática), por su posición. */
export function buildableExamples(u: SessionUnit): number[] {
  if (u.type !== 'term' && u.type !== 'pattern') return [];
  const examples = ((u.payload as { examples?: Array<{ text: string; translation?: string }> }).examples ?? []);
  return examples.flatMap((e, i) => (Boolean(e.translation) && buildTiles(e.text).length >= FLOW_BUILD_WORDS.min && buildTiles(e.text).length <= FLOW_BUILD_WORDS.max ? [i] : []));
}

/** Ejemplos que la ficha enseña (los 4 primeros) o que se ven en «Mira cómo cambia»: solo esos se piden (enseñar antes). */
export const FLOW_TAUGHT_EXAMPLES = 4;
export function taughtBuildable(u: SessionUnit): number[] {
  const staged = new Set(stagedExamples(u));
  return buildableExamples(u).filter((n) => n < FLOW_TAUGHT_EXAMPLES || staged.has(n));
}

/** Ejemplos con su tren de la frase (D-082), por su posición. */
export function mirrorExamples(u: SessionUnit): number[] {
  const examples = ((u.payload as { examples?: Array<{ mirror?: unknown }> }).examples ?? []);
  return examples.flatMap((e, i) => (e.mirror ? [i] : []));
}

/** Escenas mínimas para jugar a «¿Dónde está?» (D-084): se eligen entre tres. */
export const FLOW_STAGE_MIN = 3;

/** Ejemplos con escena dibujada (D-084), por su posición. Vacío si no llegan al mínimo para jugar. */
export function stagedExamples(u: SessionUnit): number[] {
  const examples = ((u.payload as { examples?: Array<{ stage?: unknown[] }> }).examples ?? []);
  const out = examples.flatMap((e, i) => (Array.isArray(e.stage) && e.stage.length ? [i] : []));
  return out.length >= FLOW_STAGE_MIN ? out : [];
}

/** Versos mínimos para cantar «La cadena» (D-085). */
export const FLOW_CHANT_MIN = 4;

/** Versos de «La cadena» (D-085): pregunta y respuesta con ritmo. Vacío si no llegan al mínimo. */
export function chantOf(u: SessionUnit): Array<{ e: string; q: string; a: string; es?: string }> {
  const c = (u.payload as { chant?: Array<{ e: string; q: string; a: string; es?: string }> }).chant;
  return Array.isArray(c) && c.length >= FLOW_CHANT_MIN ? c : [];
}

/** Primer ejemplo que se puede construir con fichas; `null` si no hay ninguno. */
export function buildableExample(u: SessionUnit): number | null {
  return buildableExamples(u)[0] ?? null;
}

/** Mínimo de preguntas para que un concepto se juegue como «Ráfaga». */
export const FLOW_BURST_MIN = 4;
/** Como mucho, estas respuestas distintas (botones) en una «Ráfaga». */
export const FLOW_BURST_MAX_OPTIONS = 4;

/**
 * Opciones de una «Ráfaga» (D-081), en orden estable (el de la primera pregunta: respuesta y después las falsas), o
 * `null` si el concepto no es un juego. Es un juego cuando todas sus preguntas (≥ FLOW_BURST_MIN) se responden eligiendo
 * entre el MISMO puñado de respuestas cortas: «¿I HAVE o I AM?», «¿DO, DID o WILL?», «¿look AT, FOR o AFTER?».
 */
export function burstOptions(u: SessionUnit): string[] | null {
  const ex = exercisesOf(u);
  if (u.type !== 'concept' || ex.length < FLOW_BURST_MIN) return null;
  if (!ex.every((e) => e.kind !== 'order_steps' && !e.code && e.answer && (e.distractors?.length ?? 0) >= 1)) return null;
  const order: string[] = [];
  for (const e of ex) for (const o of [e.answer!, ...e.distractors!]) if (!order.includes(o)) order.push(o);
  return order.length >= 2 && order.length <= FLOW_BURST_MAX_OPTIONS ? order : null;
}

/** Ejercicio que se puede completar escribiendo: respuesta corta y sin «ordenar pasos». */
export function typeableExercise(u: SessionUnit): number | null {
  const i = exercisesOf(u).findIndex((e) => e.kind !== 'order_steps' && Boolean(e.answer) && e.answer!.length <= FLOW_TYPED_MAX);
  return i < 0 ? null : i;
}

/** Arcade sorpresa (D-087): preguntas por partida, mínimo de lo aprendido para jugar y probabilidad por ronda. */
export const FLOW_ARCADE_SIZE = 10;
/** Preguntas gramaticales («¿Está bien dicho?») como mucho en cada Arcade (D-088). */
export const FLOW_ARCADE_GRAMMAR = 4;
/** Reglas de orden con las que el calco del español es SEGURO que está mal en inglés («Today I am busy» sí vale). */
export const JUDGE_SAFE_RULES = ['describe', 'object', 'frequency', 'ago', 'would'] as const;

/** Ejemplos de una unidad que sirven para «¿Está bien dicho?»: con espejo, orden distinto y una regla segura. */
export function judgeableExamples(u: SessionUnit): number[] {
  const examples = ((u.payload as { examples?: Array<{ text: string; mirror?: OrderMirror }> }).examples ?? []);
  return examples.flatMap((e, i) => {
    if (!e.mirror?.order || i >= FLOW_TAUGHT_EXAMPLES) return [];
    const r = orderRule(e.mirror, e.text);
    return r && (JUDGE_SAFE_RULES as readonly string[]).includes(r.rule) && spanishOrderCalque(e.mirror).toLowerCase() !== e.text.replace(/[.!?]+$/, '').toLowerCase() ? [i] : [];
  });
}
export const FLOW_ARCADE_MIN = 6;
export const FLOW_ARCADE_CHANCE = 0.5;
/** No sale antes de esta tarjeta de la ronda (primero se aprende algo). */
export const FLOW_ARCADE_AFTER = 4;
/** Se puede jugar en el Arcade: una palabra o un concepto con su significado (no los trucos de gramática). */
export function arcadeable(u: SessionUnit): boolean {
  return (u.type === 'term' || u.type === 'concept') && Boolean(unitText(u)) && Boolean(unitMeaning(u));
}

export function buildFlowSession(input: {
  sessionId: string;
  courseId: string;
  day: number;
  createdAt: number;
  items: PlanItem[];
  units: Record<string, SessionUnit>;
  maxNewUnits?: number;
  maxReviewUnits?: number;
  /** Unidades falladas o que se olvidaron (D-077): entran como «tus errores». */
  errorUnits?: string[];
  /** Refuerzo cuando no hay nada nuevo ni repasos (D-077): lo más débil ya trabajado. */
  practiceUnits?: string[];
  /** Repasos superados por unidad: decide si la pregunta sube de nivel. */
  levels?: Record<string, number>;
  /** El curso tiene audio (idiomas): habilita «Escucha». */
  audio?: boolean;
  /** Lo ya aprendido (D-087): de aquí salen las preguntas del «Arcade sorpresa». */
  arcadeUnits?: string[];
}): AssocPlan {
  const { units, items } = input;
  const rand = seeded(input.sessionId);
  const has = (k: string) => Boolean(units[k]);
  const reviews = [...new Set(items.filter((i) => i.reason === 'review').map((i) => i.unitId))].filter(has).slice(0, input.maxReviewUnits ?? MAX_REVIEW_UNITS);
  const fresh = [...new Set(items.filter((i) => i.reason === 'new').map((i) => i.unitId))].filter((k) => has(k) && !reviews.includes(k)).slice(0, input.maxNewUnits ?? Infinity);
  const errors = (input.errorUnits ?? []).filter((k) => has(k) && !reviews.includes(k) && !fresh.includes(k));
  const practice = reviews.length || fresh.length ? [] : (input.practiceUnits ?? []).filter((k) => has(k) && !errors.includes(k));
  const focus = (u: string): AssocStep['focus'] => (errors.includes(u) ? 'errors' : practice.includes(u) ? 'practice' : undefined);
  const known = new Set([...reviews, ...errors, ...practice]);

  // 1. Secuencia base (regla de oro, D-067): TODA unidad se enseña (reel) antes de su primera pregunta, también los
  //    repasos. Parejas: reel A, reel B, pregunta A, pregunta B. Primero lo que toca repasar y luego lo nuevo,
  //    alternando para que no se acumule; «tus errores» y el refuerzo van entre los repasos.
  type Draft = Omit<AssocStep, 'id'>;
  const base: Draft[] = [];
  const all = [...reviews, ...errors, ...practice, ...fresh];
  const tag = (u: string) => { const f = focus(u); return f ? { focus: f } : {}; };
  const quick = (u: string): Draft => ({ kind: 'quick', unitKey: u, scene: -4, reverse: rand() < 0.5, ...tag(u) });
  // «¿Verdad o mentira?» (D-072): el término con su significado (verdad) o con el de otra unidad (mentira), al 50 %.
  const judge = (u: string): Draft => {
    const others = all.filter((k) => k !== u);
    const lie = others.length > 0 && rand() < 0.5;
    return { kind: 'judge', unitKey: u, scene: -4, statementOf: lie ? others[Math.floor(rand() * others.length)]! : u, ...tag(u) };
  };
  // Sube de nivel (D-077): lo ya repasado con éxito se recupera escribiendo, no eligiendo.
  const levelUp = (u: string): Draft | null => {
    if (!known.has(u) || (input.levels?.[u] ?? 0) < FLOW_LEVEL_UP) return null;
    const unit = units[u]!;
    if (unit.type === 'term') {
      const recall = unit.skills.find((s) => s.kind === 'recall');
      return recall ? { kind: 'review', unitKey: u, scene: -4, skillKey: recall.key, startHint: 0, levelUp: true, ...tag(u) } : null;
    }
    const n = typeableExercise(unit);
    const skill = unit.skills.find((s) => s.kind === 'apply') ?? unit.skills.find((s) => s.kind === 'recall');
    return n === null || !skill ? null : { kind: 'challenge', unitKey: u, scene: -4, skillKey: skill.key, exercise: n, typed: true, levelUp: true, ...tag(u) };
  };
  // D-079: oír la palabra y elegir qué significa (habilidad «escuchar»), solo si el curso tiene audio.
  const listen = (u: string): Draft | null => {
    const skill = units[u]!.skills.find((s) => s.kind === 'listen');
    return input.audio && units[u]!.type === 'term' && skill ? { kind: 'listen', unitKey: u, scene: -4, skillKey: skill.key, ...tag(u) } : null;
  };
  // D-079: construir una frase real con la unidad (habilidad «producir»), en idiomas y gramática.
  const build = (u: string): Draft | null => {
    const skill = units[u]!.skills.find((s) => s.kind === 'produce');
    // D-086: cada ronda, una frase distinta de las enseñadas (antes siempre la primera: parecía un bucle).
    const options = taughtBuildable(units[u]!);
    const n = options.length ? options[Math.floor(rand() * options.length)]! : null;
    return skill && n !== null ? { kind: 'build', unitKey: u, scene: -4, skillKey: skill.key, example: n, ...tag(u) } : null;
  };
  // D-081: un concepto-juego se practica con su «Ráfaga» (todas sus preguntas, rápidas), no con relámpago ni examen.
  const burst = (u: string): Draft | null => {
    if (!burstOptions(units[u]!)) return null;
    const skill = units[u]!.skills.find((s) => s.kind === 'apply') ?? units[u]!.skills.find((s) => s.kind === 'recall');
    return skill ? { kind: 'burst', unitKey: u, scene: -4, skillKey: skill.key, ...tag(u) } : null;
  };
  // D-082 (simplificado): el espejo en movimiento va dentro de la ficha del truco (un solo paso, sin tarjeta aparte).
  // Después se construye una frase DISTINTA de la que se ha visto animada, si la hay.
  const buildAfter = (u: string, shown?: number): Draft | null => {
    const skill = units[u]!.skills.find((s) => s.kind === 'produce');
    const options = taughtBuildable(units[u]!);
    const others = options.filter((x) => x !== shown);
    const pool = others.length ? others : options;
    const n = pool.length ? pool[Math.floor(rand() * pool.length)] : undefined;
    return skill && n !== undefined ? { kind: 'build', unitKey: u, scene: -4, skillKey: skill.key, example: n, ...tag(u) } : null;
  };
  // D-084: la escena que cambia. Primero se mira (el bicho se mueve y suena cada frase) y después se juega: oír la frase y
  // tocar la escena correcta, o ver la escena y elegir la frase. Reconocer pesa poco; producir llega con «Construye».
  const spot = (u: string, avoid?: number): Draft | null => {
    const skill = units[u]!.skills.find((s) => s.kind === 'recall');
    const st = stagedExamples(units[u]!);
    const options = st.filter((n) => n !== avoid);
    if (!skill || !options.length) return null;
    return { kind: 'spot', unitKey: u, scene: -4, skillKey: skill.key, example: options[Math.floor(rand() * options.length)]!, reverse: rand() < 0.35, ...tag(u) };
  };
  // D-085: la cadena. Se oyen los primeros versos y después contestas tú, al ritmo, eligiendo la respuesta. Reconocer al
  // escuchar pesa medio-bajo; producir llega con «Construye».
  const chant = (u: string): Draft | null => {
    const skill = units[u]!.skills.find((s) => s.kind === 'recall');
    return skill && chantOf(units[u]!).length ? { kind: 'chant', unitKey: u, scene: -4, skillKey: skill.key, ...tag(u) } : null;
  };
  const order: string[] = [];
  const rv = shuffle([...reviews, ...errors, ...practice], rand);
  const nw = [...fresh];
  while (rv.length || nw.length) { if (rv.length) order.push(...rv.splice(0, 2)); if (nw.length) order.push(...nw.splice(0, 2)); }
  for (let i = 0; i < order.length; i += 2) {
    const pair = order.slice(i, i + 2);
    for (const u of pair) base.push({ kind: 'reel', unitKey: u, scene: -4, ...tag(u) });
    // Variedad: la primera de la pareja, escucha (idiomas) o relámpago; la segunda, ¿verdad o mentira?; lo dominado,
    // escribiendo. La gramática se practica construyendo una de sus frases.
    pair.forEach((u, j) => {
      if (units[u]!.type === 'pattern') {
        const up = levelUp(u);
        const sing = up ? null : chant(u);
        if (sing) base.push(sing);
        const play = up ? null : spot(u);
        if (play) base.push({ kind: 'watch', unitKey: u, scene: -4, ...tag(u) }, play);
        base.push(up ?? buildAfter(u, mirrorExamples(units[u]!)[0]) ?? quick(u));
        return;
      }
      base.push(burst(u) ?? levelUp(u) ?? (j === 0 ? (listen(u) ?? quick(u)) : judge(u)));
    });
    // Idiomas (D-079): tras cada pareja de palabras, una frase que construir con una de ellas.
    const terms = pair.filter((u) => units[u]!.type === 'term');
    const word = terms[Math.floor(rand() * terms.length)];
    const sentence = word ? build(word) : null;
    if (sentence) base.push(sentence);
  }

  // 2. Repesca intercalada: tras cada pregunta, su repetición FLOW_RETRY_GAP tarjetas después (se salta si se acertó).
  const withRetry: Draft[] = [];
  const pending: Array<{ at: number; step: Draft }> = [];
  for (const d of base) {
    withRetry.push(d);
    // La gramática se repesca construyendo OTRA de sus frases (elegir entre etiquetas de gramática no enseña nada).
    const rest = units[d.unitKey]?.type === 'pattern' && d.kind === 'build' ? taughtBuildable(units[d.unitKey]!).filter((n) => n !== d.example) : [];
    const other = rest.length ? rest[Math.floor(rand() * rest.length)] : undefined;
    const replay = d.kind === 'spot' ? spot(d.unitKey, d.example) : d.kind === 'chant' ? chant(d.unitKey) : null;
    if (replay) pending.push({ at: withRetry.length + FLOW_RETRY_GAP, step: { ...replay, retry: true } });
    else if (other !== undefined) pending.push({ at: withRetry.length + FLOW_RETRY_GAP, step: { kind: 'build', unitKey: d.unitKey, scene: -4, retry: true, example: other, ...(d.skillKey ? { skillKey: d.skillKey } : {}) } });
    else if (['quick', 'judge', 'challenge', 'review', 'listen', 'build'].includes(d.kind)) pending.push({ at: withRetry.length + FLOW_RETRY_GAP, step: { kind: 'quick', unitKey: d.unitKey, scene: -4, retry: true, reverse: !d.reverse } });
    for (let j = pending.length - 1; j >= 0; j -= 1) if (pending[j]!.at <= withRetry.length) withRetry.push(pending.splice(j, 1)[0]!.step);
  }
  for (const p of pending) withRetry.push(p.step);

  // 3. Pregunta tipo examen cada FLOW_BOSS_EVERY tarjetas, de algo ya visto en el flujo.
  const steps: AssocStep[] = [];
  const seenUnits: string[] = [];
  const bossDone = new Set<string>();
  let sinceBoss = 0;
  const push = (d: Draft) => steps.push({ ...d, id: `${steps.length + 1}-${d.kind}-${d.unitKey || 'x'}` });
  for (const d of withRetry) {
    push(d);
    if (d.unitKey && !seenUnits.includes(d.unitKey)) seenUnits.push(d.unitKey);
    if (d.levelUp || d.kind === 'burst') bossDone.add(d.unitKey);
    if (!d.retry) sinceBoss += 1;
    if (sinceBoss >= FLOW_BOSS_EVERY) {
      const answerable = (k: string) => exercisesOf(units[k]!).map((e, n) => ({ e, n })).filter(({ e }) => e.kind !== 'order_steps');
      // Los conceptos-juego se practican con su Ráfaga, nunca como pregunta jefe (podía salir antes de jugarla).
      const u = seenUnits.find((k) => !bossDone.has(k) && !burstOptions(units[k]!) && answerable(k).length && units[k]!.skills.some((s) => s.kind === 'apply'));
      if (u) {
        bossDone.add(u);
        const apply = units[u]!.skills.find((s) => s.kind === 'apply')!;
        const options = answerable(u);
        push({ kind: 'challenge', unitKey: u, scene: -4, skillKey: apply.key, exercise: options[Math.floor(rand() * options.length)]!.n, typed: false });
      }
      sinceBoss = 0;
    }
  }
  // 4. Solo en idiomas: escribir lo nuevo al final.
  for (const u of fresh) {
    const recall = units[u]!.skills.find((s) => s.kind === 'recall');
    if (recall && units[u]!.type === 'term') push({ kind: 'review', unitKey: u, scene: -4, skillKey: recall.key, startHint: 0 });
  }
  // 4b. Arcade sorpresa (D-087): de vez en cuando, en un punto al azar, una ráfaga contrarreloj SOLO de lo ya aprendido
  // (todo enseñado antes). Pesa como reconocer y un fallo no corta el juego: vuelve en su repaso.
  const arcadePool = (input.arcadeUnits ?? []).filter((k) => has(k) && arcadeable(units[k]!));
  if (arcadePool.length >= FLOW_ARCADE_MIN && steps.length >= FLOW_ARCADE_AFTER && rand() < FLOW_ARCADE_CHANCE) {
    const judge = shuffle((input.arcadeUnits ?? []).filter(has).flatMap((k) => judgeableExamples(units[k]!).map((example) => ({ unitKey: k, example }))), rand)
      .slice(0, FLOW_ARCADE_GRAMMAR).map((g) => ({ ...g, wrong: rand() < 0.5 }));
    const pick = shuffle([...arcadePool], rand).slice(0, FLOW_ARCADE_SIZE - judge.length);
    const at = FLOW_ARCADE_AFTER - 1 + Math.floor(rand() * (steps.length - FLOW_ARCADE_AFTER + 1));
    steps.splice(at, 0, { kind: 'arcade', unitKey: '', scene: -4, arcadeUnits: pick, ...(judge.length ? { arcadeGrammar: judge } : {}), id: `${steps.length + 1}-arcade-x` });
  }
  // 5. Hito: resumen de la ronda dentro del feed; al deslizar empieza la siguiente.
  if (steps.length) push({ kind: 'summary', unitKey: '', scene: -4 });
  return { mode: 'flow', sessionId: input.sessionId, courseId: input.courseId, day: input.day, createdAt: input.createdAt, steps, scenes: [] };
}

// Ronda de hablar (D-106): el alumno dice en voz alta, en el idioma que aprende, frases que YA ha estudiado, y una IA
// (vía OpenRouter, solo en el servidor) le dice qué ha entendido, la versión correcta y UNA corrección. Es la excepción
// de la regla 10 que ya aprobó D-078: guion (frases de sus fichas), tope de gasto, salida validada y un proveedor que no
// guarda ni entrena con los mensajes. Aquí solo hay lógica pura (se prueba sola); la llamada de red recibe `fetch`.

/** Frase que se pide decir: el sentido en la lengua del alumno y la referencia en la que aprende. */
export interface SpeakItem {
  unitKey: string;
  /** Lo que tiene que decir, en su lengua («Tengo un perro»). */
  prompt: string;
  /** Una forma correcta de decirlo (de la ficha); se enseña después de intentarlo. */
  reference: string;
}

export interface SpeakVerdict {
  /** Lo que la IA ha entendido. */
  heard: string;
  /** Se entiende y la gramática es correcta (un acento normal no cuenta como fallo). */
  ok: boolean;
  /** La frase bien dicha (natural), para repetirla. */
  corrected: string;
  /** UNA corrección o un elogio concreto, en la lengua del alumno. */
  tip: string;
}

export const SPEAK_ROUND = 5;
/** Tope de gasto por alumno y mes, en euros (se puede cambiar con SPEAK_MONTHLY_CAP_EUR). */
export const SPEAK_DEFAULT_CAP_EUR = 5;
/** Modelo por defecto: entiende audio, barato y bueno corrigiendo. Se cambia con OPENROUTER_SPEAK_MODEL. */
export const SPEAK_DEFAULT_MODEL = 'google/gemini-2.5-flash';
/** Audio máximo por frase (WAV 16 kHz mono ≈ 32 kB/s → unos 20 s), en base64. */
export const SPEAK_MAX_AUDIO_B64 = 900_000;
const WORDS = { min: 2, max: 12 };

export interface SpeakConfig { key: string; model: string; capEur: number; eurPerUsd: number }
/** Configuración desde el entorno. Sin clave de OpenRouter, la ronda no está disponible (nunca se imprime la clave). */
export function speakConfig(env: Record<string, string | undefined>): SpeakConfig | null {
  const key = env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  const cap = Number(env.SPEAK_MONTHLY_CAP_EUR);
  const rate = Number(env.SPEAK_EUR_PER_USD);
  return { key, model: env.OPENROUTER_SPEAK_MODEL?.trim() || SPEAK_DEFAULT_MODEL, capEur: Number.isFinite(cap) && cap >= 0 ? cap : SPEAK_DEFAULT_CAP_EUR, eurPerUsd: Number.isFinite(rate) && rate > 0 ? rate : 0.92 };
}

type ExampleLike = { text?: unknown; translation?: unknown };
type UnitLike = { key: string; payload: unknown };

/** Frases candidatas de una unidad: sus ejemplos con traducción y de 2 a 12 palabras. */
export function unitPhrases(u: UnitLike): SpeakItem[] {
  const ex = ((u.payload as { examples?: ExampleLike[] } | null)?.examples ?? []);
  return ex.flatMap((e) => {
    if (typeof e.text !== 'string' || typeof e.translation !== 'string' || !e.translation.trim()) return [];
    const n = e.text.trim().split(/\s+/).length;
    return n >= WORDS.min && n <= WORDS.max ? [{ unitKey: u.key, prompt: e.translation.trim(), reference: e.text.trim() }] : [];
  });
}

/**
 * Elige las frases de la ronda SOLO entre lo ya trabajado (nada que Memora no haya enseñado), primero lo que vence o se
 * falla, y una frase por unidad. `rand` se inyecta para poder probarlo.
 */
export function pickSpeakItems(units: Record<string, UnitLike>, worked: Iterable<string>, priority: Iterable<string>, n = SPEAK_ROUND, rand: () => number = Math.random): SpeakItem[] {
  const workedSet = new Set(worked);
  const first = [...priority].filter((k) => workedSet.has(k));
  const rest = shuffle([...workedSet].filter((k) => !first.includes(k)), rand);
  const out: SpeakItem[] = [];
  for (const key of [...shuffle(first, rand), ...rest]) {
    const u = units[key];
    if (!u) continue;
    const phrases = unitPhrases(u);
    if (!phrases.length) continue;
    out.push(phrases[Math.floor(rand() * phrases.length)]!);
    if (out.length >= n) break;
  }
  return out;
}

function shuffle<T>(a: T[], rand: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; }
  return b;
}

const LANG: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese' };

/** Mensajes para OpenRouter: instrucciones fijas, la frase pedida y el audio del alumno. */
export function speakMessages(item: SpeakItem, audioB64: string, target: string, learner: string) {
  const T = LANG[target] ?? target, L = LANG[learner] ?? learner;
  const system = [
    `You are a friendly ${T} speaking coach for a ${L}-speaking learner (about A2 level).`,
    `The learner was asked to say in ${T}: "${item.prompt}". One correct answer is: "${item.reference}".`,
    'Listen to the audio and judge ONLY what they said. Other correct ways of saying it are fine.',
    'A normal foreign accent is fine; mark ok=false for wrong grammar, wrong or missing words, a different meaning, or pronunciation that changes the word.',
    'If the audio is silent or not in the target language, set heard to "" and ok to false.',
    `Reply with JSON only: {"heard": string (what you heard, in ${T}), "ok": boolean, "corrected": string (the natural correct sentence; prefer the reference wording when close), "tip": string (in ${L}, max 140 characters: the ONE most important correction, or a specific praise if ok)}.`,
  ].join(' ');
  return [
    { role: 'system', content: system },
    { role: 'user', content: [{ type: 'text', text: 'Here is my answer.' }, { type: 'input_audio', input_audio: { data: audioB64, format: 'wav' } }] },
  ];
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : null);

/** Valida la respuesta de la IA (la salida se valida siempre, D-078). Devuelve null si no sirve. */
export function parseVerdict(raw: unknown): SpeakVerdict | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { o = JSON.parse(m[0]); } catch { return null; }
  }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const heard = clean(r.heard, 300), corrected = clean(r.corrected, 300), tip = clean(r.tip, 200);
  if (heard === null || !corrected || !tip || typeof r.ok !== 'boolean') return null;
  return { heard, ok: r.ok, corrected, tip };
}

/** Gasto del mes en curso (UTC) a partir de los apuntes de la ronda. */
export function monthSpendEur(rows: Array<{ costEur?: unknown; at?: unknown }>, now: number): number {
  const d = new Date(now);
  const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const sum = rows.reduce((a, r) => (typeof r.at === 'number' && r.at >= from && typeof r.costEur === 'number' && Number.isFinite(r.costEur) ? a + r.costEur : a), 0);
  return Math.round(sum * 10000) / 10000;
}

/** Coste estimado si el proveedor no lo devuelve: tokens por precio de referencia de Gemini Flash. */
export function estimateUsd(usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): number {
  const pin = usage?.prompt_tokens ?? 1500, pout = usage?.completion_tokens ?? 200;
  return (pin * 1.0 + pout * 2.5) / 1_000_000;
}

export class SpeakError extends Error {
  constructor(readonly code: 'PROVIDER' | 'BAD_REPLY', message: string) { super(message); }
}

/** Llama a OpenRouter con el audio y devuelve el veredicto validado y su coste en dólares. */
export async function askCoach(cfg: SpeakConfig, item: SpeakItem, audioB64: string, target: string, learner: string, fetchFn: typeof fetch = fetch): Promise<{ verdict: SpeakVerdict; costUsd: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json', 'x-title': 'Memora' },
      body: JSON.stringify({
        model: cfg.model,
        messages: speakMessages(item, audioB64, target, learner),
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 400,
        usage: { include: true },
        // Solo proveedores que no guardan ni entrenan con los mensajes (D-078).
        provider: { data_collection: 'deny' },
      }),
    });
  } catch {
    throw new SpeakError('PROVIDER', 'No se ha podido contactar con la IA.');
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }>; usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number } } | null;
  if (!res.ok || !json) throw new SpeakError('PROVIDER', `La IA no ha respondido (${res.status}).`);
  const costUsd = typeof json.usage?.cost === 'number' ? json.usage.cost : estimateUsd(json.usage);
  const verdict = parseVerdict(json.choices?.[0]?.message?.content);
  if (!verdict) throw Object.assign(new SpeakError('BAD_REPLY', 'La IA ha respondido algo que no se entiende.'), { costUsd });
  return { verdict, costUsd };
}

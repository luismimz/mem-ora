// Imágenes de las asociaciones (D-114): viñetas de cómic exageradas generadas con fal (FLUX schnell) FUERA de la lección
// (regla 10): las pide la administración por adelantado, se revisan y se guardan como archivos estáticos junto a los
// audios. En la lección solo se enseñan las ya guardadas; si una palabra no tiene, se ve su emoji.
// Aquí solo hay lógica pura (se prueba sola); las llamadas de red reciben `fetch`. Nunca se imprime la clave.

export interface ImageConfig {
  falKey: string;
  model: string;
  /** Tope de gasto total al mes, en euros (IMAGES_MONTHLY_CAP_EUR). */
  capEur: number;
  eurPerUsd: number;
  /** Para escribir la escena visual en inglés (opcional: sin clave se usa la escena tal cual). */
  openrouterKey: string | null;
  textModel: string;
}

export const IMAGE_DEFAULT_MODEL = 'fal-ai/flux/schnell';
export const IMAGE_DEFAULT_CAP_EUR = 8;
/** 512×512 basta para el móvil y cuesta ~0,26 megapíxeles. */
export const IMAGE_SIZE = { width: 512, height: 512 } as const;
/** Precio de FLUX schnell en fal: 0,003 $ por megapíxel (comprobado el 4-nov-2026). */
export const USD_PER_MEGAPIXEL = 0.003;

export function imageConfig(env: Record<string, string | undefined>): ImageConfig | null {
  const falKey = env.FAL_KEY?.trim();
  if (!falKey) return null;
  const cap = Number(env.IMAGES_MONTHLY_CAP_EUR);
  const rate = Number(env.SPEAK_EUR_PER_USD);
  return {
    falKey,
    model: env.FAL_MODEL?.trim() || IMAGE_DEFAULT_MODEL,
    capEur: Number.isFinite(cap) && cap >= 0 ? cap : IMAGE_DEFAULT_CAP_EUR,
    eurPerUsd: Number.isFinite(rate) && rate > 0 ? rate : 0.92,
    openrouterKey: env.OPENROUTER_API_KEY?.trim() || null,
    textModel: env.OPENROUTER_SPEAK_MODEL?.trim() || 'google/gemini-2.5-flash',
  };
}

/** Estilo elegido por el usuario (4-nov-2026): opción B, viñeta de cómic exagerada. */
export const STYLE = 'all characters fully clothed, exaggerated comic book panel, bold black ink outlines, vibrant flat colors, dramatic funny facial expressions, absurd and memorable, one single clear scene, centered subject, plain simple background, no text, no letters, no words, no speech bubbles';

export interface ImageRequest {
  /** La palabra o estructura que se aprende («cold»). */
  target: string;
  /** Su significado en la lengua del alumno («frío»). */
  meaning: string;
  /** La escena de la asociación, tal como la lee el alumno. */
  scene: string;
}

/** Instrucciones para que la IA de texto convierta la escena en una descripción visual corta en inglés. */
export function promptMessages(r: ImageRequest): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: 'You turn a memory-trick scene into ONE short visual description in English for an image model (max 45 words). Describe only what is seen: characters, action, objects, exaggerated emotion. The viewer ("you") is the protagonist: show a young adult man. Every character is an adult and fully clothed, unless the word itself is about babies or children (then show them in an ordinary, wholesome everyday situation). Never include text, letters or the word itself as writing. Reply with the description only.' },
    { role: 'user', content: `Word to remember: "${r.target}" (meaning: ${r.meaning}).\nScene: ${r.scene}` },
  ];
}

/** Prompt final para fal: escena + estilo. Se limpian comillas y saltos de línea. */
export function finalPrompt(visual: string): string {
  const clean = visual.replace(/["“”«»]/g, '').replace(/\s+/g, ' ').trim().slice(0, 400);
  return `${clean}. ${STYLE}`;
}

export function costUsd(width = IMAGE_SIZE.width, height = IMAGE_SIZE.height): number {
  return Math.round(((width * height) / 1_000_000) * USD_PER_MEGAPIXEL * 1e6) / 1e6;
}

export class ImageError extends Error {
  constructor(public code: 'NO_CONFIG' | 'CAP' | 'PROVIDER' | 'BAD_REQUEST', message: string) { super(message); }
}

/** Escena → descripción visual en inglés (OpenRouter). Si falla o no hay clave, se usa la escena con la palabra. */
export async function visualFor(cfg: ImageConfig, r: ImageRequest, fetchFn: typeof fetch = fetch): Promise<{ visual: string; costUsd: number }> {
  const fallback = { visual: `${r.scene} (the word "${r.target}" means ${r.meaning})`, costUsd: 0 };
  if (!cfg.openrouterKey) return fallback;
  try {
    const res = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.openrouterKey}`, 'content-type': 'application/json', 'x-title': 'Memora' },
      body: JSON.stringify({ model: cfg.textModel, messages: promptMessages(r), temperature: 0.4, max_tokens: 120, usage: { include: true }, provider: { data_collection: 'deny' } }),
    });
    const json = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }>; usage?: { cost?: number } } | null;
    const text = typeof json?.choices?.[0]?.message?.content === 'string' ? (json.choices[0]!.message!.content as string).trim() : '';
    if (!res.ok || text.length < 10) return fallback;
    return { visual: text, costUsd: typeof json?.usage?.cost === 'number' ? json.usage.cost : 0 };
  } catch {
    return fallback;
  }
}

/** Genera la imagen con fal y la descarga. Devuelve los bytes en base64 y su tipo. */
export async function generateImage(cfg: ImageConfig, prompt: string, fetchFn: typeof fetch = fetch): Promise<{ b64: string; contentType: string; costUsd: number }> {
  let res: Response;
  try {
    res = await fetchFn(`https://fal.run/${cfg.model}`, {
      method: 'POST',
      headers: { authorization: `Key ${cfg.falKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, image_size: IMAGE_SIZE, num_images: 1, num_inference_steps: 4, output_format: 'jpeg', enable_safety_checker: true }),
    });
  } catch {
    throw new ImageError('PROVIDER', 'No se ha podido contactar con fal.');
  }
  const json = (await res.json().catch(() => null)) as { images?: Array<{ url?: string; content_type?: string }> } | null;
  const url = json?.images?.[0]?.url;
  if (!res.ok || !url) throw new ImageError('PROVIDER', `fal no ha devuelto imagen (${res.status}).`);
  const img = await fetchFn(url);
  if (!img.ok) throw new ImageError('PROVIDER', 'No se ha podido descargar la imagen.');
  const bytes = Buffer.from(await img.arrayBuffer());
  return { b64: bytes.toString('base64'), contentType: json.images![0]!.content_type ?? 'image/jpeg', costUsd: costUsd() };
}

/** Gasto de imágenes del mes en curso (eventos «image» con su coste). */
export function monthImageSpendEur(payloads: Array<{ costEur?: number; at?: number }>, now: number): number {
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return Math.round(payloads.filter((p) => (p.at ?? 0) >= start).reduce((s, p) => s + (p.costEur ?? 0), 0) * 1e4) / 1e4;
}

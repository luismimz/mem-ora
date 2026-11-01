// Conversación con IA (D-107, versión 2 de la ronda de hablar): una sola pantalla de chat, manos libres. El alumno habla,
// la IA (OpenRouter, solo servidor) le contesta corto, le pregunta y sigue el hilo, usando solo lo que ya ha trabajado.
// No interrumpe para corregir: reformula de pasada («recast») y apunta errores y AUTOCORRECCIONES (que cuentan como
// logro: solo se juzga la versión final). El servidor no guarda la conversación: el cliente manda el texto de los
// últimos turnos (recortado) y el audio del turno actual.
import { type SpeakConfig, SpeakError, estimateUsd } from './lib';

export interface Scenario { key: string; title: string; emoji: string; goal: string; opening: string; role: string }

/** Situaciones con objetivo (D-078) y la charla libre. La primera frase es fija: empezar no cuesta nada. */
export const SCENARIOS: Scenario[] = [
  { key: 'libre', title: 'Charla libre', emoji: '💬', role: 'a friendly new friend', goal: 'Habla de ti: tu día, tus estudios, lo que te gusta.', opening: 'Hi! Nice to meet you. How was your day today?' },
  { key: 'restaurante', title: 'En el restaurante', emoji: '🍽️', role: 'a waiter in a restaurant', goal: 'Pide comida y bebida, y al final pide la cuenta y pregunta si aceptan tarjeta.', opening: 'Good evening! Welcome. Are you ready to order, or do you need a minute?' },
  { key: 'aeropuerto', title: 'En el aeropuerto', emoji: '✈️', role: 'an airline check-in agent', goal: 'Factura tu maleta, pide asiento de ventana y pregunta a qué hora sale el vuelo.', opening: 'Hello! Can I see your passport, please? Where are you flying today?' },
  { key: 'entrevista', title: 'Entrevista de trabajo', emoji: '💼', role: 'a job interviewer for a junior developer position', goal: 'Preséntate, habla de tus estudios de DAM y de por qué quieres el trabajo.', opening: 'Hi, thanks for coming. Can you tell me a little about yourself?' },
  { key: 'medico', title: 'En el médico', emoji: '🩺', role: 'a doctor in a clinic', goal: 'Explica qué te duele, desde cuándo, y pregunta qué tienes que hacer.', opening: 'Hello, please sit down. What seems to be the problem today?' },
  { key: 'coche', title: 'Alquilar un coche', emoji: '🚗', role: 'a car rental agent at an island airport', goal: 'Alquila un coche pequeño para 3 días, pregunta el precio y si el seguro está incluido.', opening: 'Hi there! Do you have a reservation, or would you like to rent a car today?' },
];

export interface TalkTurn { who: 'ai' | 'me'; text: string }
export interface TalkMistake { said: string; correct: string; why: string; unitKey: string | null }
export interface TalkVerdict {
  /** Lo que la IA ha entendido (versión final del alumno). */
  heard: string;
  /** Respuesta de la IA en el idioma que se aprende (corta, con una pregunta para seguir). */
  reply: string;
  /** Reformulación correcta de lo que dijo, si hacía falta (va dentro de la respuesta, de pasada). */
  recast: string | null;
  /** Fallos que el alumno corrigió él mismo en el mismo turno: logro, no error. */
  selfCorrections: Array<{ from: string; to: string }>;
  /** Errores que se quedaron (como mucho 2 por turno). */
  mistakes: TalkMistake[];
  /** ¿Se ha cumplido el objetivo de la situación? */
  goalDone: boolean;
}

export const TALK_HISTORY_TURNS = 12;
export const TALK_TEXT_MAX = 400;
export const TALK_VOCAB_MAX = 80;

/** Lista de lo ya trabajado para el prompt: «clave: texto», recortada. */
export function vocabLines(units: Record<string, { key: string; type: string; payload: unknown }>, worked: Iterable<string>): string[] {
  const out: string[] = [];
  for (const k of worked) {
    const u = units[k];
    if (!u) continue;
    const p = u.payload as { text?: string; goal?: string; meaning?: string };
    const label = u.type === 'pattern' ? p.goal : p.text && p.meaning ? `${p.text} = ${p.meaning}` : p.text;
    if (label) out.push(`${u.key}: ${String(label).slice(0, 80)}`);
    if (out.length >= TALK_VOCAB_MAX) break;
  }
  return out;
}

/** Limpia el historial que manda el cliente: solo texto, roles válidos, últimos turnos y longitud acotada. */
export function cleanHistory(raw: unknown): TalkTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((t) => (t && (t.who === 'ai' || t.who === 'me') && typeof t.text === 'string' && t.text.trim() ? [{ who: t.who, text: t.text.trim().slice(0, TALK_TEXT_MAX) } as TalkTurn] : [])).slice(-TALK_HISTORY_TURNS);
}

const LANG: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese' };

export function talkMessages(sc: Scenario, history: TalkTurn[], vocab: string[], audioB64: string, target: string, learner: string) {
  const T = LANG[target] ?? target, L = LANG[learner] ?? learner;
  const system = [
    `You are ${sc.role}, having a spoken ${T} conversation with a ${L}-speaking learner (about A2 level). Stay in character.`,
    `The learner's goal: ${sc.goal}`,
    `The learner has already studied these items (key: item). Prefer these words and structures; keep everything else very simple:\n${vocab.join('\n') || '(basic everyday words)'}`,
    'Rules: reply in 1–2 short sentences (max 30 words) and usually end with ONE simple question to keep the conversation going.',
    'Never stop to give grammar lessons. If the learner made a mistake, naturally reuse the correct form in your reply (a recast), like a native speaker would.',
    'Judge ONLY the final version of what the learner said. If they started wrong and corrected themselves in the same turn (e.g. "the boy has a ten... the boy is ten years old"), that is a SELF-CORRECTION, not a mistake: list it in selfCorrections.',
    'Report at most 2 real mistakes that remain in the final version (ignore accent and tiny slips that do not matter). For each, give unitKey from the list if it clearly matches, else null.',
    `Reply with JSON only: {"heard": string (what the learner said, final version, in ${T}), "reply": string (your answer in ${T}), "recast": string|null (the learner's sentence said correctly, only if it had a mistake), "selfCorrections": [{"from": string, "to": string}], "mistakes": [{"said": string, "correct": string, "why": string (in ${L}, max 100 chars), "unitKey": string|null}], "goalDone": boolean}.`,
    'If the audio is silent or not in the target language, set heard to "" and reply kindly asking them to try again in simple words.',
  ].join('\n');
  const msgs: Array<Record<string, unknown>> = [{ role: 'system', content: system }];
  for (const t of history) msgs.push({ role: t.who === 'ai' ? 'assistant' : 'user', content: t.text });
  msgs.push({ role: 'user', content: [{ type: 'text', text: 'My answer (audio):' }, { type: 'input_audio', input_audio: { data: audioB64, format: 'wav' } }] });
  return msgs;
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Valida la respuesta de la IA (D-078). Devuelve null si no tiene la forma esperada. */
export function parseTalk(raw: unknown, unitKeys: Set<string>): TalkVerdict | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { o = JSON.parse(m[0]); } catch { return null; }
  }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const reply = s(r.reply, 300);
  if (!reply || typeof r.heard !== 'string') return null;
  const recast = s(r.recast, 300) || null;
  const selfCorrections = (Array.isArray(r.selfCorrections) ? r.selfCorrections : []).flatMap((x: any) => (s(x?.from, 120) && s(x?.to, 120) ? [{ from: s(x.from, 120), to: s(x.to, 120) }] : [])).slice(0, 3);
  const mistakes = (Array.isArray(r.mistakes) ? r.mistakes : []).flatMap((x: any) => {
    const said = s(x?.said, 160), correct = s(x?.correct, 160), why = s(x?.why, 140);
    if (!said || !correct || said.toLowerCase() === correct.toLowerCase()) return [];
    return [{ said, correct, why, unitKey: typeof x?.unitKey === 'string' && unitKeys.has(x.unitKey) ? x.unitKey : null }];
  }).slice(0, 2);
  return { heard: s(r.heard, 300), reply, recast, selfCorrections, mistakes, goalDone: r.goalDone === true };
}

export async function askPartner(cfg: SpeakConfig, messages: unknown[], unitKeys: Set<string>, fetchFn: typeof fetch = fetch): Promise<{ verdict: TalkVerdict; costUsd: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json', 'x-title': 'Memora' },
      body: JSON.stringify({ model: cfg.model, messages, response_format: { type: 'json_object' }, temperature: 0.6, max_tokens: 500, usage: { include: true }, provider: { data_collection: 'deny' } }),
    });
  } catch {
    throw new SpeakError('PROVIDER', 'No se ha podido contactar con la IA.');
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }>; usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number } } | null;
  if (!res.ok || !json) throw new SpeakError('PROVIDER', `La IA no ha respondido (${res.status}).`);
  const costUsd = typeof json.usage?.cost === 'number' ? json.usage.cost : estimateUsd(json.usage);
  const verdict = parseTalk(json.choices?.[0]?.message?.content, unitKeys);
  if (!verdict) throw Object.assign(new SpeakError('BAD_REPLY', 'La IA ha respondido algo que no se entiende.'), { costUsd });
  return { verdict, costUsd };
}

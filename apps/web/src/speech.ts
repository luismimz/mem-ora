// Voz de Memora.
// 1. Si el texto tiene audio pregenerado con Kokoro (tools/audio/generate.py → /audio/<idioma>/index.json), se
//    reproduce ese archivo: es la voz buena y suena igual en todos los dispositivos.
// 2. Si no, se usa la voz del dispositivo (speechSynthesis), que es la de reserva.
// speak() devuelve una promesa que se cumple cuando la voz TERMINA: quien vaya a pasar de tarjeta la espera para no
// cortar las frases largas (fallo visto en el iPhone: el audio se cortaba al cambiar de tarjeta).
//
// Safari en iPhone (motivo de los ajustes de abajo):
// - Solo deja sonar si el primer audio sale de un toque del usuario. La ficha habla sola al aparecer (fuera de un
//   toque), así que en el primer toque de la página se «desbloquea» el reproductor (un silencio de 50 ms) y la voz
//   del sistema (una locución vacía). Después se reutiliza SIEMPRE el mismo reproductor, que queda desbloqueado.
// - Llamar a cancel() y justo después a speak() puede tragarse la locución nueva: solo se cancela si algo suena, y
//   entonces se habla un instante después.
// - La locución se guarda en una variable: si el recolector de basura la libera, el audio se corta a medias.
// - Se elige una voz del idioma; si no, Safari puede leer el inglés con la voz española del sistema.
let enabled = true;
let current: SpeechSynthesisUtterance | null = null;
let primed = false;
let finish: (() => void) | null = null; // cumple la promesa de lo que está sonando (al terminar o al cortarlo)

const SILENCE = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAABQAAAqAAbW1tbW1tbW1tbW1tbW1tbW1tbZKSkpKSkpKSkpKSkpKSkpKSkpKStra2tra2tra2tra2tra2tra2trbb29vb29vb29vb29vb29vb29vb2///////////////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQEUAAAAAAAAAKgvT9A1gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
const player: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null;
if (player) player.preload = 'auto';
const BCP47: Record<string, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' };
const tagOf = (language: string) => BCP47[language] ?? language;
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();

// Índice texto → archivo por idioma. Se pide una vez; sin red o sin índice, se usa la voz del dispositivo.
const indexes = new Map<string, Promise<Record<string, string>>>();
function indexFor(language: string): Promise<Record<string, string>> {
  let p = indexes.get(language);
  if (!p) {
    p = fetch(`/audio/${language}/index.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    indexes.set(language, p);
  }
  return p;
}
/** Pide el índice por adelantado (al entrar en un curso con audio) para que la primera palabra ya suene con Kokoro. */
export function preloadVoice(language: string): void { void indexFor(language); }

function voiceFor(tag: string): SpeechSynthesisVoice | undefined {
  const voices = synth()?.getVoices() ?? [];
  const base = tag.split('-')[0]!.toLowerCase();
  return voices.find((v) => v.lang.replace('_', '-') === tag && v.localService)
    ?? voices.find((v) => v.lang.replace('_', '-') === tag)
    ?? voices.find((v) => v.lang.toLowerCase().startsWith(base));
}

/** Desbloquea el audio en iOS dentro del primer gesto del usuario. */
function prime(): void {
  if (primed) return;
  primed = true;
  if (player && !finish) {
    try { player.src = SILENCE; void player.play().catch(() => undefined); } catch { /* sin audio */ }
  }
  const s = synth();
  if (!s || s.speaking || s.pending) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  } catch { /* sin voz: no pasa nada */ }
}
if (typeof document !== 'undefined') {
  for (const type of ['touchend', 'click', 'keydown'] as const) document.addEventListener(type, prime, { once: true, capture: true });
  // Las voces llegan tarde en algunos navegadores: pedirlas pronto para tenerlas al hablar.
  try { synth()?.getVoices(); } catch { /* sin voz */ }
}

/** Corta lo que suene y cumple su promesa. */
export function stopSpeech(): void {
  const done = finish;
  finish = null;
  if (player && !player.paused) player.pause();
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
  current = null;
  done?.();
}

/** El curso decide si hay audio (idiomas sí; p. ej., Java no). */
export function setAudioEnabled(on: boolean): void {
  enabled = on;
  if (!on) stopSpeech();
}
export const audioEnabled = (): boolean => enabled;

/** Habla el texto. La promesa se cumple al terminar (o al cortarlo otra voz); nunca falla. */
export function speak(text: string, language: string, rate = 0.88): Promise<void> {
  if (!enabled || !text.trim()) return Promise.resolve();
  // Lo anterior se da por terminado. La voz del sistema la corta device() (con su pausa) o playFile().
  const prev = finish;
  finish = null;
  if (player && !player.paused) player.pause();
  prev?.();
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => { if (settled) return; settled = true; window.clearTimeout(guard); if (finish === done) finish = null; resolve(); };
    finish = done;
    // Red de seguridad: si el navegador nunca avisa del final, no se queda la tarjeta esperando para siempre.
    const guard = window.setTimeout(done, Math.min(15000, 2500 + text.length * 120));
    void indexFor(language).then((index) => {
      if (settled) return;
      const file = index[norm(text)];
      if (file && player) playFile(`/audio/${language}/${file}`, rate, done, () => { if (!settled) device(text, language, rate, done); });
      else device(text, language, rate, done);
    });
  });
}

function playFile(src: string, rate: number, done: () => void, fallback: () => void): void {
  const p = player!;
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
  p.onended = done;
  p.onerror = fallback;
  p.src = src;
  // Los audios ya van a velocidad de aprendizaje; «rate» solo los ralentiza un poco más (Escucha).
  p.playbackRate = Math.min(1.1, Math.max(0.8, rate / 0.88));
  p.play().catch(fallback);
}

function device(text: string, language: string, rate: number, done: () => void): void {
  const s = synth();
  if (!s) { done(); return; }
  const tag = tagOf(language);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = tag;
  const v = voiceFor(tag);
  if (v) u.voice = v;
  u.rate = rate;
  u.onend = () => { if (current === u) current = null; done(); };
  u.onerror = () => { if (current === u) current = null; done(); };
  current = u;
  if (s.speaking || s.pending) {
    s.cancel();
    setTimeout(() => { if (current === u) s.speak(u); }, 60);
  } else {
    if (s.paused) s.resume();
    s.speak(u);
  }
}

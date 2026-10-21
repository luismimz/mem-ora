// Voz PROVISIONAL del dispositivo para el H2.2a. El audio pregenerado con Kokoro y servido desde caché llega en el
// H2.3; entonces esta función reproducirá el archivo de la unidad. La interfaz avisa de que es provisional.
//
// Safari en iPhone (motivo de los ajustes de abajo):
// - Solo deja hablar si la PRIMERA locución sale de un toque del usuario. La ficha habla sola al aparecer (fuera de un
//   toque), así que se «desbloquea» la voz con una locución vacía en el primer toque o clic de la página.
// - Llamar a cancel() y justo después a speak() puede tragarse la locución nueva: solo se cancela si algo suena, y
//   entonces se habla un instante después.
// - La locución se guarda en una variable: si el recolector de basura la libera, el audio se corta a medias.
// - Se elige una voz del idioma; si no, Safari puede leer el inglés con la voz española del sistema.
let enabled = true;
let current: SpeechSynthesisUtterance | null = null;
let primed = false;

const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
const BCP47: Record<string, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' };
const tagOf = (language: string) => BCP47[language] ?? language;

function voiceFor(tag: string): SpeechSynthesisVoice | undefined {
  const voices = synth()?.getVoices() ?? [];
  const base = tag.split('-')[0]!.toLowerCase();
  return voices.find((v) => v.lang.replace('_', '-') === tag && v.localService)
    ?? voices.find((v) => v.lang.replace('_', '-') === tag)
    ?? voices.find((v) => v.lang.toLowerCase().startsWith(base));
}

/** Desbloquea la voz en iOS: una locución vacía dentro del primer gesto del usuario. */
function prime(): void {
  const s = synth();
  if (primed || !s) return;
  primed = true;
  if (s.speaking || s.pending) return;
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

/** El curso decide si hay audio (idiomas sí; p. ej., Java no). */
export function setAudioEnabled(on: boolean): void {
  enabled = on;
  if (!on) synth()?.cancel();
}
export const audioEnabled = (): boolean => enabled;

export function speak(text: string, language: string, rate = 0.88): void {
  const s = synth();
  if (!enabled || !s || !text.trim()) return;
  const tag = tagOf(language);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = tag;
  const v = voiceFor(tag);
  if (v) u.voice = v;
  u.rate = rate;
  u.onend = () => { if (current === u) current = null; };
  current = u;
  if (s.speaking || s.pending) {
    s.cancel();
    setTimeout(() => { if (current === u) s.speak(u); }, 60);
  } else {
    if (s.paused) s.resume();
    s.speak(u);
  }
}

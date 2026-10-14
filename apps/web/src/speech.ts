// Voz PROVISIONAL del dispositivo para el H2.2a. El audio pregenerado con Kokoro y servido desde caché llega en el
// H2.3; entonces esta función reproducirá el archivo de la unidad. La interfaz avisa de que es provisional.
let enabled = true;
/** El curso decide si hay audio (idiomas sí; p. ej., Java no). */
export function setAudioEnabled(on: boolean): void {
  enabled = on;
  if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
export const audioEnabled = (): boolean => enabled;

export function speak(text: string, language: string, rate = 0.88): void {
  if (!enabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = language === 'en' ? 'en-US' : language;
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

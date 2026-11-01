// Micrófono de la ronda de hablar (D-106). Graba con MediaRecorder (cada navegador en su formato: webm en Chrome, mp4
// en Safari) y lo convierte a WAV de 16 kHz y un canal: un formato que entienden todos los modelos y que pesa poco
// (≈ 32 kB por segundo). En iPhone el micrófono solo se puede abrir desde un toque del usuario.

export const MAX_SECONDS = 15;

export interface Recording { stop: () => Promise<Blob | null>; cancel: () => void }

/** ¿Este navegador puede grabar? */
export function canRecord(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

/** Empieza a grabar. Lanza un error con `name` NotAllowedError si el alumno no da permiso al micrófono. */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  const limit = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, MAX_SECONDS * 1000);
  let done: Promise<Blob | null> | null = null;
  return {
    stop: () => {
      done ??= new Promise((resolve) => {
        const finish = () => { clearTimeout(limit); release(); resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || chunks[0]!.type }) : null); };
        if (rec.state === 'inactive') finish();
        else { rec.onstop = finish; rec.stop(); }
      });
      return done;
    },
    cancel: () => { clearTimeout(limit); if (rec.state !== 'inactive') rec.stop(); release(); },
  };
}

/** Convierte cualquier audio que el navegador sepa reproducir en WAV PCM de 16 bits, 16 kHz y mono, en base64. */
export async function toWavBase64(blob: Blob, rate = 16000): Promise<{ base64: string; seconds: number }> {
  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const mono = mix(decoded);
    const pcm = resample(mono, decoded.sampleRate, rate);
    return { base64: bytesToBase64(encodeWav(pcm, rate)), seconds: pcm.length / rate };
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

function mix(b: AudioBuffer): Float32Array {
  if (b.numberOfChannels === 1) return b.getChannelData(0);
  const out = new Float32Array(b.length);
  for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) out[i]! += d[i]! / b.numberOfChannels; }
  return out;
}

/** Remuestreo lineal (suficiente para voz). */
export function resample(data: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return data;
  const n = Math.max(1, Math.round((data.length * to) / from));
  const out = new Float32Array(n);
  const step = from / to;
  for (let i = 0; i < n; i++) {
    const x = i * step, a = Math.floor(x), f = x - a;
    out[i] = (data[a] ?? 0) * (1 - f) + (data[a + 1] ?? data[a] ?? 0) * f;
  }
  return out;
}

export function encodeWav(pcm: Float32Array, rate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) { const s = Math.max(-1, Math.min(1, pcm[i]!)); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Uint8Array(buf);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

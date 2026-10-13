// Identificador del dispositivo y número de orden de sus eventos. Son comodidades locales (no progreso): si el
// almacenamiento no está disponible, se generan en memoria y el servidor sigue siendo la fuente de verdad.
const KEY = 'memora.device';

interface DeviceInfo {
  id: string;
  seq: number;
}

function load(): DeviceInfo {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DeviceInfo;
  } catch {
    /* almacenamiento no disponible */
  }
  return { id: crypto.randomUUID(), seq: 0 };
}

const device = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(device));
  } catch {
    /* almacenamiento no disponible */
  }
}

export const deviceId = (): string => device.id;
export function nextSeq(): number {
  device.seq += 1;
  save();
  return device.seq;
}
save();

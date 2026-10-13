// El núcleo nunca lee el reloj del sistema: todo instante llega como parámetro (milisegundos de época).

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Índice de día local según el origen y la duración de día configurados. */
export function dayOf(at: number, dayOriginMs: number, dayLengthMs: number): number {
  return Math.floor((at - dayOriginMs) / dayLengthMs);
}

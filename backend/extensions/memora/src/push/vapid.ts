// Aviso de repaso en el móvil (D-077): Web Push sin contenido cifrado. El servidor solo «toca el timbre» firmado con
// VAPID (RFC 8292); el service worker pide después el texto a /memora/push/message con la sesión del alumno.
// Las claves viven solo en variables de entorno (regla 9): VAPID_PUBLIC_KEY (punto P-256 sin comprimir, base64url),
// VAPID_PRIVATE_KEY (el escalar «d», base64url) y VAPID_SUBJECT (mailto: de contacto).
import { createPrivateKey, sign } from 'node:crypto';

export interface VapidKeys { publicKey: string; privateKey: string; subject: string }

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function vapidFromEnv(env: Record<string, string | undefined>): VapidKeys | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || 'mailto:hola@luismontalvan.com' };
}

/** Cabeceras de un aviso sin contenido para `endpoint`, válidas 12 horas. */
export function vapidHeaders(endpoint: string, keys: VapidKeys, now = Date.now()): Record<string, string> {
  const pub = Buffer.from(keys.publicKey, 'base64url');
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY no es un punto P-256 sin comprimir');
  const key = createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: keys.privateKey, x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)) } });
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject }));
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return { Authorization: `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`, TTL: '43200', Urgency: 'normal', 'Content-Length': '0' };
}

/** Envía el aviso. Devuelve «gone» si la suscripción ya no existe (hay que borrarla). */
export async function ring(endpoint: string, keys: VapidKeys, fetcher: typeof fetch = fetch): Promise<'ok' | 'gone' | 'error'> {
  try {
    const r = await fetcher(endpoint, { method: 'POST', headers: vapidHeaders(endpoint, keys) });
    if (r.status === 404 || r.status === 410) return 'gone';
    return r.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

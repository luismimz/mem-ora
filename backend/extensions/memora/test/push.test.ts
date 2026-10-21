import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { reminderFor, shouldRing, vapidFromEnv, vapidHeaders } from '../src/push/lib';

function keys() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = privateKey.export({ format: 'jwk' }) as { d: string; x: string; y: string };
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
  return { jwk, env: { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: jwk.d } };
}

describe('aviso de repaso: VAPID (D-077)', () => {
  it('sin claves no hay avisos', () => expect(vapidFromEnv({})).toBeNull());
  it('firma un JWT ES256 verificable para el origen del servicio de avisos', () => {
    const { jwk, env } = keys();
    const v = vapidFromEnv(env)!;
    const h = vapidHeaders('https://web.push.apple.com/abc123', v, 1_800_000_000_000);
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h.Authorization!)!;
    expect(k).toBe(env.VAPID_PUBLIC_KEY);
    const [head, claims, sig] = t!.split('.');
    const c = JSON.parse(Buffer.from(claims!, 'base64url').toString());
    expect(c).toEqual({ aud: 'https://web.push.apple.com', exp: 1_800_000_000 + 43200, sub: 'mailto:hola@luismontalvan.com' });
    const pub = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y } });
    expect(verify('sha256', Buffer.from(`${head}.${claims}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig!, 'base64url'))).toBe(true);
    expect(h['Content-Length']).toBe('0');
  });
});

describe('aviso de repaso: qué dice y cuándo (D-077)', () => {
  const now = Date.UTC(2026, 9, 21, 10, 0);
  const st = (title: string, due: number[]) => ({ courseId: title, title, skills: Object.fromEntries(due.map((d, i) => [`s${i}`, { unitId: `u${i}`, dueAt: d, attempts: 2 }])) });
  it('sin repasos vencidos no avisa', () => expect(reminderFor([st('Java', [now + 1000])], 5, now)).toBeNull());
  it('cuenta unidades vencidas y apunta al curso con más', () => {
    const r = reminderFor([st('Java', [now - 1]), st('SQL', [now - 1, now - 2])], 4, now)!;
    expect(r.title).toBe('Tienes 3 repasos listos');
    expect(r.body).toContain('SQL');
    expect(r.body).toContain('racha de 4 días');
  });
  it('de noche no; de día, como mucho cada 12 horas', () => {
    expect(shouldRing(null, Date.UTC(2026, 9, 21, 1, 0))).toBe(false); // 3:00 en Madrid
    expect(shouldRing(null, now)).toBe(true); // 12:00 en Madrid
    expect(shouldRing(now - 3600_000, now)).toBe(false);
    expect(shouldRing(now - 13 * 3600_000, now)).toBe(true);
  });
});

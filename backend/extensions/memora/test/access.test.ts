import { describe, expect, it } from 'vitest';
import { audience, canSee } from '../src/api/access';

describe('qué asignaturas ve cada alumno (D-091)', () => {
  const pub = { visibility: 'public', owner: 'luis' };
  const priv = { visibility: 'private', owner: 'luis', visible_to: ['Vero@Mail.com '] };
  it('un curso público lo ven todos', () => {
    expect(canSee(pub, 'otro', 'otro@mail.com')).toBe(true);
  });
  it('uno privado, su propietario y los elegidos (sin importar mayúsculas)', () => {
    expect(canSee(priv, 'luis', null)).toBe(true);
    expect(canSee(priv, 'vero', 'vero@mail.com')).toBe(true);
    expect(canSee(priv, 'jenny', 'jenny@mail.com')).toBe(false);
    expect(canSee(priv, 'sin-email', null)).toBe(false);
  });
  it('lee la lista aunque llegue como texto JSON y quita repetidos', () => {
    expect(audience({ visible_to: '["a@x.com","A@x.com"]' })).toEqual(['a@x.com']);
    expect(audience({ visible_to: null })).toEqual([]);
  });
});

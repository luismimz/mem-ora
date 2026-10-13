// Crea backend/.env con secretos aleatorios si no existe. Nunca imprime los valores.
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../.env', import.meta.url));
const email = process.argv[2];
if (existsSync(path)) {
  console.log('backend/.env ya existe; no se toca.');
  process.exit(0);
}
if (!email || !email.includes('@')) {
  console.error('Uso: pnpm backend:env <correo-del-administrador>');
  process.exit(1);
}
const secret = (bytes) => randomBytes(bytes).toString('base64url');
writeFileSync(
  path,
  [
    `ADMIN_EMAIL=${email}`,
    `ADMIN_PASSWORD=${secret(18)}`,
    `ADMIN_TOKEN=${secret(32)}`,
    `SECRET=${secret(32)}`,
    `DB_PASSWORD=${secret(24)}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
);
console.log('backend/.env creado con secretos aleatorios (permisos 600). Los valores no se muestran.');

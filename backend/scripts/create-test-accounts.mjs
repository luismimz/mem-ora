// Crea cuentas de PRUEBA locales (autor, revisor y alumno) con contraseñas aleatorias en backend/.env.accounts.
// Nunca imprime las contraseñas. Solo para el entorno local.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const URL_BASE = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) throw new Error('Falta ADMIN_TOKEN.');
const file = fileURLToPath(new URL('../.env.accounts', import.meta.url));

async function api(method, path, body) {
  const res = await fetch(`${URL_BASE}${path}`, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json.errors)}`);
  return json.data;
}
const q = (filter) => `filter=${encodeURIComponent(JSON.stringify(filter))}`;

const saved = existsSync(file) ? Object.fromEntries(readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2))) : {};
const accounts = [
  { key: 'AUTHOR', email: 'autor@example.com', first_name: 'Ana', last_name: 'Autora', role: 'Autor' },
  { key: 'REVIEWER', email: 'revisor@example.com', first_name: 'Rosa', last_name: 'Revisora', role: 'Revisor' },
  { key: 'LEARNER', email: 'alumno@example.com', first_name: 'Álex', last_name: 'Alumno', role: 'Alumno' },
];
for (const a of accounts) {
  const [role] = await api('GET', `/roles?${q({ name: { _eq: a.role } })}&fields=id`);
  if (!role) throw new Error(`Falta el rol ${a.role}: ejecuta antes pnpm backend:access`);
  const password = saved[`${a.key}_PASSWORD`] ?? randomBytes(15).toString('base64url');
  saved[`${a.key}_EMAIL`] = a.email;
  saved[`${a.key}_PASSWORD`] = password;
  const [user] = await api('GET', `/users?${q({ email: { _eq: a.email } })}&fields=id`);
  if (user) await api('PATCH', `/users/${user.id}`, { role: role.id, password, status: 'active' });
  else await api('POST', '/users', { email: a.email, password, first_name: a.first_name, last_name: a.last_name, role: role.id, status: 'active' });
  console.log(`✓ ${a.email} (${a.role})`);
}
writeFileSync(file, Object.entries(saved).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
console.log('Contraseñas en backend/.env.accounts (permisos 600). No se muestran.');

// Importa un archivo de curso JSON (D-041) desde la terminal, con la cuenta de administración (queda como propietaria).
// Uso: node --env-file=backend/.env backend/scripts/import-course.mjs <archivo.json> [--append] [--check]
//   --append  añade los módulos (misiones) a un curso que ya existe
//   --check   solo comprueba; no crea nada
// Todo entra como borrador. Imprime los problemas con su sitio; sale con código 1 si hay alguno. No imprime secretos.
import { readFileSync } from 'node:fs';

const [file, ...flags] = process.argv.slice(2);
if (!file) throw new Error('Falta el archivo: import-course.mjs <archivo.json> [--append] [--check]');
const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error('Falta ADMIN_TOKEN (ejecuta con --env-file=backend/.env).');
const query = [flags.includes('--append') && 'append=1', flags.includes('--check') && 'check=1'].filter(Boolean).join('&');
const res = await fetch(`${process.env.DIRECTUS_URL ?? 'http://localhost:8055'}/memora/import${query ? `?${query}` : ''}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: readFileSync(file, 'utf8'),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${(json.errors ?? []).map((e) => e.message).join(' ')}`);
  process.exit(1);
}
const r = json.data;
if (!r.ok) {
  console.error(`${r.problems.length} problema(s):`);
  for (const p of r.problems) console.error(`- ${p.where}: ${p.message}`);
  process.exit(1);
}
console.log(flags.includes('--check') ? `✓ ${file}: correcto` : `✓ ${file}: ${r.modules} módulo(s), ${r.units} unidades, ${r.associations} asociaciones (borrador)`);

// El núcleo es agnóstico de la materia (regla 2) y no depende de interfaz ni de servidor (regla 4).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
const read = (f: string) => readFileSync(join(srcDir, f), 'utf8');

describe('pureza del núcleo', () => {
  it('no menciona ninguna materia ni idioma', () => {
    const subject = /\b(ingl[eé]s|english|espa[nñ]ol|spanish|franc[eé]s|french|italiano?|italian|java|php|sql|python|medicina|ciberseguridad|vocabulario|phrasal)\b/i;
    for (const f of files) expect(read(f), f).not.toMatch(subject);
  });

  it('no importa React, Directus ni nada fuera de su carpeta', () => {
    for (const f of files) {
      for (const [, spec] of read(f).matchAll(/from\s+'([^']+)'/g)) expect(spec, `${f} importa ${spec}`).toMatch(/^\.\//);
    }
  });

  it('no lee el reloj ni el azar del sistema', () => {
    for (const f of files) expect(read(f), f).not.toMatch(/Date\.now\(|new Date\(|Math\.random\(/);
  });
});

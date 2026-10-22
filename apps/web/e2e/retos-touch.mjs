// Retos de memoria en un móvil emulado (390×844) con TOQUES REALES y la API simulada. Por qué existe: una clase de
// estilos del Flujo (.chip, blanco sobre transparente) dejó invisibles las palabras a elegir del reto (22-oct-2026).
//
// Uso: pnpm --filter @memora/web e2e
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5204, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-home.html`;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const course = { id: 'mem', key: 'memoria', title: 'Retos de memoria', subject: 'memoria', ui_language: 'es', content_language: 'es', learner_language: 'es', audio_enabled: false, new_per_session: 10, modes: ['memory'] };
const words = ['perro', 'farola', 'tarta', 'avión', 'bombilla', 'calcetín'];
const reto = { key: 'r1', skillKey: 'r1.recall', status: 'new', dueAt: null, best: null,
  payload: { title: 'La lista del perro', words, emojis: ['🐶', '💡', '🎂', '✈️', '💡', '🧦'], decoys: ['mesa', 'nube'], seconds: 60, scenes: words.map((w) => ({ text: `Un ${w.toUpperCase()} enorme.`, emoji: '🎬' })) } };

/** Contraste WCAG entre dos colores rgb(a) (sobre el fondo de la página si el del botón es transparente). */
const contrastJs = `(() => {
  const parse = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c[3] ?? 1) > 0.5) return c; } return [255, 255, 255]; };
  return [...document.querySelectorAll('.reto-pool button')].filter((b) => !b.disabled).map((b) => { const a = lum(parse(getComputedStyle(b).color)), c = lum(bgOf(b)); return { w: b.textContent, ratio: (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05), h: b.getBoundingClientRect().height }; });
})()`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const data = path === '/users/me' ? { id: 'u1', first_name: 'Luis', email: 'l@example.com' } : path === '/memora/me' ? { staff: false } : path === '/memora/courses' ? [course]
      : path === '/memora/retos' ? { retos: [reto] } : path === '/memora/progress' ? { streak: 0, skills: [], units: [] } : path === '/memora/missions' ? { missions: [], current: null } : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await page.goto(url);
  await page.locator('.reto-card').first().tap();
  await page.locator('.reto .primary', { hasText: 'Empezar' }).tap();
  await page.waitForSelector('.reto-words');
  const list = await page.$$eval('.reto-words b', (els) => els.map((e) => e.textContent));
  check(list.join(',') === words.join(','), 'la lista para estudiar se ve entera');
  await page.locator('.reto button', { hasText: 'Ya me la sé' }).tap();
  await page.waitForSelector('.reto-pool button');
  const pool = await page.evaluate(contrastJs);
  check(pool.length === words.length + 2, `al recordar salen todas las palabras para elegir (${pool.length})`);
  const worst = pool.reduce((m, x) => Math.min(m, x.ratio), 99);
  check(worst >= 4.5, `las palabras para elegir se leen (contraste mínimo ${worst.toFixed(1)}:1, hace falta 4,5:1)`);
  check(pool.every((x) => x.h >= 36), 'se pueden tocar con el dedo');
  await page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/reto-recordar.png` : '/dev/null' }).catch(() => undefined);
  await page.locator('.reto-pool button', { hasText: 'perro' }).tap();
  await page.locator('.reto-pool button', { hasText: 'farola' }).tap();
  const answer = await page.$$eval('.reto-answer li', (els) => els.map((e) => e.textContent));
  check(answer.join('|') === '1perro|2farola', `tocar una palabra la añade a tu orden (${answer.join(' ')})`);
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

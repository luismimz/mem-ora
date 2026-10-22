// Inicio en un móvil emulado (390×844) con TOQUES REALES y la API simulada: el mapa de misiones con sus cuatro estados
// (completada, en curso, por repasar, pendiente) y «Vacía tus fallos», que abre una ronda solo con los fallos.
//
// Uso: pnpm --filter @memora/web e2e
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5199, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-home.html`;

const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const course = { id: 'c1', key: 'ingles', title: 'Inglés', ui_language: 'es', content_language: 'en', learner_language: 'es', audio_enabled: false, new_per_session: 15, modes: ['flow'] };
const missions = [
  { key: '01', title: 'Misión 1 · Saludos', index: 1, total: 10, worked: 10, learned: 8, due: 4, status: 'done' },
  { key: '02', title: 'Misión 2 · Familia', index: 2, total: 10, worked: 6, learned: 3, due: 0, status: 'active' },
  { key: '03', title: 'Misión 3 · Comida', index: 3, total: 10, worked: 0, learned: 0, due: 0, status: 'pending' },
];
let failures = 5;
const term = (key, text, meaning) => ({ key, type: 'term', language: 'en', version: 1, skills: [{ key: `${key}:recall`, kind: 'recall' }], payload: { form: 'word', text, meaning, examples: [{ text: `My ${text}.`, translation: `Mi ${meaning}.` }] } });
const failSession = {
  state: { focus: 'fallos', index: 0, outcomes: {}, finished: false, plan: { mode: 'flow', sessionId: 'f1', courseId: 'c1', day: 1, createdAt: 0, scenes: [], steps: [
    { id: 'r1', kind: 'reel', unitKey: 'a', scene: -4, focus: 'errors' },
    { id: 'q1', kind: 'quick', unitKey: 'a', scene: -4, reverse: false, focus: 'errors' },
    { id: 'end', kind: 'summary', unitKey: '', scene: 0 },
  ] } },
  units: { a: term('a', 'brother', 'hermano'), b: term('b', 'sister', 'hermana') },
};
const requested = [];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api/, '');
    requested.push(`${path}${u.search}`);
    const data =
      path === '/users/me' ? { id: 'u1', first_name: 'Luis', email: 'luis@example.com' }
      : path === '/memora/me' ? { staff: false }
      : path === '/memora/courses' ? [course]
      : path === '/memora/missions' ? { missions, current: '02', newToday: 15, newTarget: 15 }
      : path === '/memora/progress' ? { streak: 3, shields: 0, todayAttempts: 12, failures, today: { newUnits: 10, goal: 35 }, skills: [], units: [], associations: [] }
      : path === '/memora/session' ? failSession
      : path === '/memora/session/position' ? { saved: true }
      : path === '/memora/events' ? { accepted: [], duplicates: [], rejected: [] }
      : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await page.goto(url);
  await page.waitForSelector('.mission-grid .mission');
  await page.waitForSelector('.fails-btn');

  const states = await page.$$eval('.mission', (els) => els.map((e) => ({ cls: e.className, state: e.querySelector('.mission-state')?.textContent ?? '' })));
  check(states[0].cls.includes('fading') && states[0].state.startsWith('REPASAR · 4'), `la misión completada que se olvida sale «por repasar» (${states[0].state})`);
  check(states[1].state.includes('CONTINUAR') && !states[1].cls.includes('fading'), 'la misión actual dice «continuar»');
  check(states[2].cls.includes('pending') && states[2].state === 'PENDIENTE', 'la misión sin empezar sale pendiente');
  const legend = await page.$eval('.missions-legend', (e) => e.textContent ?? '');
  check(legend.includes('1 por repasar') && legend.includes('1 completada') && !legend.includes('1 completadas'), `la leyenda cuenta lo que hay que repasar (${legend})`);

  const btn = await page.$eval('.fails-btn', (e) => ({ text: e.textContent ?? '', w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
  check(btn.text.includes('5') && btn.text.includes('Vacía tus fallos') && btn.h >= 44, `«Vacía tus fallos» muestra cuántos quedan y se puede tocar con el dedo (${Math.round(btn.h)}px de alto)`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'Inicio: nada se sale por los lados');
  await page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/home-fallos.png` : '/dev/null', fullPage: true }).catch(() => undefined);

  await page.locator('.fails-btn').tap();
  await page.waitForSelector('.slide');
  check(requested.some((r) => r.startsWith('/memora/session') && r.includes('focus=fallos')), 'al tocarlo pide una ronda solo de fallos (focus=fallos)');
  check(page.url().includes('foco=fallos'), 'la dirección guarda que es la ronda de fallos (se puede retomar)');
  const tag = await page.$eval('.slide .tag', (e) => e.textContent ?? '');
  check(tag.includes('TUS ERRORES'), `la ronda empieza por un fallo, marcado como tal (${tag})`);
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

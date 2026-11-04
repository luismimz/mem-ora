// Elegir cuántas palabras repasar (D-111) en un móvil emulado (390×844) con TOQUES REALES y la API simulada: con más
// palabras por repasar que una ronda, «Seguir aprendiendo» pregunta cuántas (25, 50, todas o solo lo nuevo) y la ronda
// se pide con esa cantidad. Con pocas, no pregunta.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5194, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-home.html`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const course = { id: 'c1', key: 'ingles', title: 'Inglés', subject: 'idioma', ui_language: 'es', content_language: 'en', learner_language: 'es', audio_enabled: false, new_per_session: 15, modes: ['flow'] };
const past = Date.now() - 86_400_000;
const skillsFor = (n) => Array.from({ length: n }, (_, i) => [{ key: `w${i}:recall`, unit: `w${i}`, kind: 'recall', status: 'learned', dueAt: past }, { key: `w${i}:recognize`, unit: `w${i}`, kind: 'recognize', status: 'learned', dueAt: past }]).flat();
const session = { state: { index: 0, outcomes: {}, finished: false, plan: { mode: 'flow', version: 99, sessionId: 's1', courseId: 'c1', day: 1, createdAt: 0, scenes: [], steps: [{ id: 'end', kind: 'summary', unitKey: '', scene: 0 }] } }, units: {} };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];
  const run = async (dueWords) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const asked = [];
    await page.route('**/api/**', (route) => {
      const u = new URL(route.request().url());
      const path = u.pathname.replace(/^\/api/, '');
      if (path === '/memora/session') asked.push(u.search);
      const data = path === '/users/me' ? { id: 'u1', first_name: 'Luis', email: 'luis@example.com' }
        : path === '/memora/me' ? { staff: false }
        : path === '/memora/courses' ? [course]
        : path === '/memora/missions' ? { missions: [{ key: '01', title: 'Misión 1', index: 1, total: 10, worked: 5, learned: 3, due: 0, status: 'active' }], current: '01' }
        : path === '/memora/progress' ? { streak: 1, bestStreak: 1, shields: 0, todayAttempts: 0, failures: 0, today: { newUnits: 0, goal: 33 }, calendar: Array(84).fill(0), skills: skillsFor(dueWords), units: [], associations: [] }
        : path === '/memora/session' ? session
        : path === '/memora/session/position' ? { saved: true }
        : {};
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
    });
    await page.goto(url);
    await page.waitForSelector('.hero .primary');
    await page.waitForTimeout(300);
    return { page, asked };
  };

  // Con 63 palabras por repasar: pregunta.
  const { page, asked } = await run(63);
  await page.locator('.hero .primary').tap();
  await page.waitForSelector('.review-sheet');
  const sheet = await page.textContent('.review-sheet');
  check(/63 palabras por repasar/.test(sheet), 'cuenta una vez cada palabra (no cada habilidad): 63');
  check(/63\s*🔁 palabras por repasar/.test(await page.textContent('.today')), 'Inicio cuenta lo mismo: 63 palabras por repasar');
  const opts = await page.$$eval('.review-opt', (b) => b.map((x) => ({ t: x.textContent, h: Math.round(x.getBoundingClientRect().height) })));
  check(opts.length === 4 && opts.every((o) => o.h >= 44) && /Todas \(63\)/.test(opts.map((o) => o.t).join()), `elige 25, 50, todas o solo lo nuevo con un toque (${opts.map((o) => o.h).join(', ')} px)`);
  check(/no se pierden/.test(sheet), 'explica que las que dejes no se pierden');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');
  if (shots) await page.screenshot({ path: `${shots}/repasos-elige.png` });
  await page.locator('.review-opt', { hasText: 'Todas' }).tap();
  await page.waitForURL(/\/sesion/);
  await page.waitForTimeout(400);
  check(asked.some((q) => q.includes('repaso=todas')), 'pide la ronda con todas las palabras');
  await page.close();

  // Solo lo nuevo.
  const b = await run(63);
  await b.page.locator('.hero .primary').tap();
  await b.page.locator('.review-opt', { hasText: 'Solo lo nuevo' }).tap();
  await b.page.waitForURL(/\/sesion/);
  await b.page.waitForTimeout(400);
  check(b.asked.some((q) => q.includes('repaso=0')), '«Solo lo nuevo» pide la ronda sin repaso');
  await b.page.close();

  // Con pocas (10): no pregunta y la ronda va como siempre.
  const c = await run(10);
  await c.page.locator('.hero .primary').tap();
  await c.page.waitForURL(/\/sesion/);
  await c.page.waitForTimeout(400);
  check(await c.page.locator('.review-sheet').count() === 0 && c.asked.length > 0 && !c.asked.some((q) => q.includes('repaso=')), 'con pocas palabras no pregunta');
  await c.page.close();
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

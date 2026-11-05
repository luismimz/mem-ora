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

  // 5-nov-2026: el contador de Inicio se TOCA y abre una ronda con TODO lo acumulado (sin preguntar cuántas).
  const { page, asked } = await run(63);
  const tile = page.locator('.today-tap button');
  check(/63\s*🔁 palabras y trucos por repasar/.test(await tile.textContent()), 'Inicio cuenta una vez cada palabra (no cada habilidad): 63');
  check(Math.round((await tile.boundingBox()).height) >= 44 && /Repasar ahora/.test(await tile.textContent()), 'el contador es un botón grande que dice «Repasar ahora»');
  check(await page.locator('.review-btn').count() === 0, 'sin banner repetido debajo');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');
  if (shots) await page.screenshot({ path: `${shots}/repasos-contador.png` });
  await tile.tap();
  await page.waitForURL(/\/sesion/);
  await page.waitForTimeout(400);
  check(asked.some((q) => q.includes('focus=repaso')), 'pide la ronda de repasar todo (focus=repaso)');
  await page.close();

  // «Seguir aprendiendo» ya no pregunta: sigue con lo nuevo y lo que toca.
  const c = await run(63);
  await c.page.locator('.hero .primary').tap();
  await c.page.waitForURL(/\/sesion/);
  await c.page.waitForTimeout(400);
  check(!(await c.page.locator('.review-sheet').count()) && c.asked.every((q) => !q.includes('focus=repaso')), '«Seguir aprendiendo» abre la ronda normal sin preguntar');
  await c.page.close();

  // Sin nada que repasar, el contador no se puede tocar.
  const d = await run(0);
  check(await d.page.locator('.today-tap button').isDisabled(), 'con 0 por repasar el contador no abre nada');
  await d.page.close();
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

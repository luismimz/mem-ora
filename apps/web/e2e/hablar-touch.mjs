// Ronda de hablar (D-106) en un móvil emulado (390×844) con TOQUES REALES, micrófono simulado de Chromium y la API
// simulada: desde Inicio se abre la ronda, se mantiene pulsado el micrófono, se suelta, llega un WAV al servidor, se ve
// la corrección, se repite la frase y se pasa deslizando. El interruptor del perfil la oculta.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5197, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-home.html`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const course = { id: 'c1', key: 'ingles', title: 'Inglés', subject: 'idioma', ui_language: 'es', content_language: 'en', learner_language: 'es', audio_enabled: false, new_per_session: 15, modes: ['flow'] };
const items = [
  { unitKey: 'have', prompt: 'Tengo un perro.', reference: 'I have a dog.', skillKey: 'have:recall' },
  { unitKey: 'go', prompt: 'Vamos a la playa.', reference: 'We go to the beach.', skillKey: 'go:recall' },
];
const checks = [];
const events = [];
let spent = 0.01;

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, permissions: ['microphone'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api/, '');
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    let data;
    if (path === '/memora/speak/check') {
      checks.push(body);
      spent += 0.002;
      const first = checks.length === 1;
      data = first
        ? { heard: 'I has a dog', ok: false, corrected: 'I have a dog.', tip: 'Con I se dice have, no has.', reference: 'I have a dog.', spentEur: spent, capEur: 5 }
        : { heard: body.reference, ok: true, corrected: body.reference, tip: '¡Perfecto!', reference: body.reference, spentEur: spent, capEur: 5 };
    } else if (path === '/memora/events') { events.push(...body.events); data = { accepted: [], duplicates: [], rejected: [] }; }
    else data = path === '/users/me' ? { id: 'u1', first_name: 'Luis', email: 'luis@example.com' }
      : path === '/memora/me' ? { staff: false }
      : path === '/memora/courses' ? [course]
      : path === '/memora/missions' ? { missions: [{ key: '01', title: 'Misión 1', index: 1, total: 10, worked: 5, learned: 3, due: 0, status: 'active' }], current: '01' }
      : path === '/memora/progress' ? { streak: 1, bestStreak: 1, shields: 0, todayAttempts: 0, failures: 0, today: { newUnits: 0, goal: 33 }, calendar: Array(84).fill(0), skills: [], units: [], associations: [] }
      : path === '/memora/speak' ? { available: true, reason: null, capEur: 5, spentEur: spent, language: 'en', items }
      : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await page.goto(url);
  await page.waitForSelector('.speak-btn');
  const btn = await page.$eval('.speak-btn', (e) => ({ h: e.getBoundingClientRect().height, t: e.textContent }));
  check(btn.h >= 44 && /Ronda de hablar/.test(btn.t), `Inicio de inglés muestra «Ronda de hablar» tocable (${Math.round(btn.h)} px)`);
  await page.locator('.speak-btn').tap();
  await page.waitForSelector('.speak-prompt');
  check(page.url().includes('/hablar?curso=c1'), 'la ronda tiene su dirección (/hablar)');
  check((await page.textContent('.speak-prompt')) === 'Tengo un perro.', 'pide decir en inglés una frase ya trabajada');
  if (shots) await page.screenshot({ path: `${shots}/hablar-pide.png` });

  const cdp = await context.newCDPSession(page);
  const hold = async (ms) => {
    const box = await page.locator('.mic').boundingBox();
    const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
    await page.waitForSelector('.mic.on', { timeout: 5000 });
    check(true, 'al mantener pulsado, el micrófono graba (rojo)');
    if (shots) await page.screenshot({ path: `${shots}/hablar-grabando.png` });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const swipeUp = async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 780 }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 780 - 34 * k }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
  };

  await hold(1500);
  await page.waitForSelector('.speak-verdict');
  const first = checks[0];
  check(first && first.unit === 'have' && first.reference === 'I have a dog.' && first.course === 'c1', 'envía al servidor la frase de la ficha (no texto libre)');
  const wavHead = first ? Buffer.from(first.audio.slice(0, 16), 'base64').toString('latin1') : '';
  check(wavHead.startsWith('RIFF') && wavHead.includes('WAVE'), `el audio llega como WAV (${Math.round((first?.audio.length ?? 0) / 1024)} kB en base64)`);
  const v = await page.$eval('.speak-verdict', (e) => e.textContent);
  check(/I has a dog/.test(v) && /I have a dog\./.test(v) && /have, no has/.test(v), 'enseña lo que entendió, la frase bien y una corrección');
  check(events.length === 1 && events[0].format === 'recall_cued' && events[0].hint === 2 && events[0].correct === false && events[0].skillKey === 'have:recall', 'el fallo va a su repaso como «recordar con pista» (nunca dominio)');
  if (shots) await page.screenshot({ path: `${shots}/hablar-correccion.png` });

  check(await page.locator('.speak-verdict .mic').count() === 1, 'si falla, pide repetirla bien');
  await hold(1200);
  await page.waitForSelector('.speak-retry');
  check(/Ahora sí/.test(await page.textContent('.speak-retry')) && events.length === 1, 'la repetición se corrige, pero no cuenta otra vez para el repaso');
  if (shots) await page.screenshot({ path: `${shots}/hablar-repite.png` });
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');

  await swipeUp();
  await page.waitForFunction(() => document.querySelector('.speak-prompt')?.textContent === 'Vamos a la playa.');
  check(true, 'deslizando hacia arriba pasa a la siguiente frase (sin botón)');
  await hold(1200);
  await page.waitForSelector('.speak-verdict.ok');
  await swipeUp();
  await page.waitForSelector('.speak-end');
  check(/1\/2/.test(await page.textContent('.speak-end .end-xp')) && /0,02 €/.test(await page.textContent('.speak-end')), 'al final: aciertos a la primera y el gasto del mes');
  if (shots) await page.screenshot({ path: `${shots}/hablar-final.png` });

  // Ajustes: el interruptor de la ronda vive en el perfil y la oculta de Inicio.
  await page.goto(url);
  await page.waitForSelector('.speak-btn');
  await page.locator('.avatar').first().tap();
  await page.waitForSelector('.toggle-row input');
  const panel = await page.$eval('.toggle-row', (e) => e.closest('section').textContent);
  check(/Ronda de hablar/.test(panel) && /Activada/.test(panel) && /de 5,00 €/.test(panel), 'en el perfil: interruptor y gasto del mes frente al tope');
  if (shots) await page.screenshot({ path: `${shots}/hablar-ajustes.png`, fullPage: true });
  await page.locator('.toggle-row input').tap();
  check(/Desactivada/.test(await page.textContent('.toggle-row')), 'se puede desactivar con un toque');
  await page.goto(url);
  await page.waitForSelector('.hero');
  await page.waitForTimeout(300);
  check(await page.locator('.speak-btn').count() === 0, 'desactivada, desaparece de Inicio');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

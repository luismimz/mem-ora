// Truco de la frase (usuario, 5-nov-2026): en la ficha de una palabra, el primer ejemplo con truco enseña la palabra
// española partida («gust» + «aría») y el inglés con el truco delante («would like»), la forma del verbo y la fórmula.
// Móvil emulado 390×844 con toques reales (regla 5).
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5231, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-truco.html`;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await context.newCDPSession(page);
  await page.goto(url);
  await page.waitForSelector('.slide');
  async function swipeUp() {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 620 }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 620 - 32 * i }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
  }
  let found = false;
  for (let n = 0; n < 12 && !found; n++) {
    if (await page.locator('.slide .trk-card').count()) { found = true; break; }
    await swipeUp();
  }
  check(found, 'una ficha enseña la tarjeta del truco');
  const cardEl = page.locator('.slide .trk-card').first();
  await cardEl.scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.SHOT_A ?? '/tmp/truco-1.png' });
  await page.waitForTimeout(2600);
  await cardEl.scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.SHOT_B ?? '/tmp/truco-2.png' });
  const t = await cardEl.evaluate((el) => ({ name: el.querySelector('.trk-name')?.textContent, end: el.querySelector('.trk-end')?.firstChild?.textContent, split: Boolean(el.querySelector('.is-split')), en: el.querySelector('.trk-en .trk-on')?.textContent, form: el.querySelector('.trk-en .trk-form')?.textContent, formula: el.querySelector('.trk-formula')?.textContent, w: el.getBoundingClientRect().width }));
  check(/WOULD/.test(t.name ?? '') && t.end === 'aría' && t.split, `«gustaría» se parte en gust + aría (${t.end})`);
  check(t.en === 'would' && t.form === 'base', 'en inglés «would» va marcado y el verbo dice «base»');
  check(/would \+ verbo base/.test(t.formula ?? ''), 'enseña la fórmula');
  check(t.w <= 390 && !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors[0]}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

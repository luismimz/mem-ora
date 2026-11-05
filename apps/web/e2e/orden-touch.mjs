// «Construye la consulta» (5-nov-2026) en un móvil emulado (390×844) con TOQUES REALES: justo después de la ficha de un
// concepto con código explicado línea a línea, se ordenan sus piezas; al fallar se ve el orden bueno con qué hace cada
// línea; al acertar, confeti y se sigue deslizando.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5198, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}e2e/harness-taller.html`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];
  const play = async (wrong) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?k=bd-select-orden&s=orden`);
    await page.waitForSelector('.slide');
    const plan = await page.evaluate(() => window.__plan.steps.map((s) => ({ kind: s.kind, direct: s.direct, w: s.workshop })));
    const reel = plan.findIndex((s) => s.kind === 'reel');
    const at = plan.findIndex((s) => s.kind === 'workshop' && s.direct && s.w.some((x) => x.kind === 'order'));
    if (!wrong) check(at > reel && reel >= 0, `«Construye la consulta» llega después de la ficha (paso ${at + 1})`);
    const cdp = await context.newCDPSession(page);
    const swipe = async () => {
      await page.evaluate(() => { const s = document.querySelector('.slide'); if (s) s.scrollTop = s.scrollHeight; });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 780 }] });
      for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 780 - 34 * k }] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(350);
    };
    for (let n = 0; n < 8 && !(await page.locator('.order-piece').count()); n++) {
      if (await page.locator('.option').count()) { await page.locator('.option').first().tap(); await page.waitForTimeout(900); }
      await swipe();
    }
    check(await page.locator('.order-piece').count() === 3, 'salen las 3 piezas de código (el resultado «→» no es pieza)');
    const sizes = await page.$$eval('.order-piece', (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
    if (!wrong) check(sizes.every((h) => h >= 44), `piezas tocables (${sizes.join(', ')} px)`);
    const order = wrong ? ['WHERE', 'FROM bici', 'SELECT'] : ['SELECT', 'FROM bici', 'WHERE'];
    for (const t of order) await page.locator('.order-piece', { hasText: t }).first().tap();
    await page.waitForSelector('.tense-verdict');
    const v = await page.textContent('.tense-verdict');
    if (wrong) {
      check(/Así va el orden/.test(v) && await page.locator('.order-slots li.is-wrong').count() >= 2, 'al fallar marca las piezas mal puestas');
      check(/De qué tabla/.test(await page.textContent('.tense-after')), 'y enseña el orden bueno con lo que hace cada línea');
      if (shots) await page.screenshot({ path: `${shots}/orden-fallo.png`, fullPage: true });
    } else {
      check(/Bien construida/.test(v), 'ordenada bien: «¡Bien construida!»');
      if (shots) await page.screenshot({ path: `${shots}/orden-bien.png`, fullPage: true });
    }
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');
    await page.close();
  };
  await play(false);
  await play(true);
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

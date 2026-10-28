// Fin de ronda (28-oct-2026) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor.
// Antes, mientras se preparaba la siguiente ronda, deslizar no hacía nada y nada se movía: parecía colgado.
// Comprueba: se ve una barra de carga en movimiento; si deslizas mientras carga, la ronda se abre SOLA al estar lista;
// si tarda demasiado, se ofrece «Reintentar» y funciona.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5194, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const root = `${server.resolvedUrls.local[0]}e2e/harness-escena.html?k=be,have&solo=summary`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  async function open(next) {
    const page = await context.newPage();
    await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await page.goto(`${root}&next=${next}`);
    await page.waitForSelector('.slide');
    const cdp = await context.newCDPSession(page);
    const swipeUp = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 700 }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 700 - 34 * i }] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
    };
    const tag = () => page.evaluate(() => document.querySelector('.slide .tag')?.textContent ?? '');
    return { page, swipeUp, tag };
  }

  // 1. Tarda 3 s: barra en movimiento y, si deslizas antes, se abre sola.
  let s = await open(3000);
  check(/RONDA 1 COMPLETADA/.test(await s.tag()), 'llega el fin de ronda');
  const bar = await s.page.evaluate(() => { const i = document.querySelector('.end-loading-bar i'); return i ? getComputedStyle(i).animationName : null; });
  check(bar === 'end-load', 'se ve una barra de carga en movimiento');
  if (shots) await s.page.screenshot({ path: `${shots}/ronda-cargando.png` });
  await s.swipeUp();
  const msg = await s.page.locator('.end-loading .end-next').textContent();
  check(/se abrirá sola/.test(msg), `al deslizar mientras carga, lo dice («${msg}»)`);
  let opened = false;
  for (let i = 0; i < 20 && !opened; i++) { await s.page.waitForTimeout(250); opened = /RONDA 2/.test(await s.tag()); }
  check(opened, 'y la ronda nueva se abre sola en cuanto está lista, sin volver a deslizar');
  await s.page.close();

  // 2. No llega nunca: a los 10 s, «Reintentar».
  s = await open('never');
  await s.page.waitForTimeout(10500);
  const retry = s.page.locator('.end-retry');
  check(await retry.count() === 1 && (await retry.boundingBox()).height >= 44, 'si tarda demasiado, aparece «Reintentar» (se toca con el dedo)');
  if (shots) await s.page.screenshot({ path: `${shots}/ronda-reintentar.png` });
  await retry.tap();
  check(await s.page.evaluate(() => window.__again) === 1, 'y «Reintentar» vuelve a pedir la ronda');
  await s.page.close();
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

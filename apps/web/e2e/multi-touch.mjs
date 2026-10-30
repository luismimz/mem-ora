// «Varias correctas» (D-105) con TOQUES TÁCTILES REALES en un móvil emulado (390×844): en la pregunta jefe se marcan
// todas las buenas tocándolas, se desliza para comprobar (sin botones) y se acierta solo con exactamente las buenas.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5195, strictPort: false, host: '127.0.0.1' } });
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
    let found = false;
    for (let s = 1; s < 60 && !found; s++) {
      await page.goto(`${base}?k=swing-libreria,extends,bucle-for,nullpointer&s=m${s}&solo=challenge`);
      await page.waitForSelector('.slide');
      found = await page.evaluate(() => window.__plan.steps[0]?.kind === 'challenge' && window.__plan.steps[0].unitKey === 'swing-libreria');
    }
    check(found, 'hay una pregunta jefe de varias correctas');
    const cdp = await context.newCDPSession(page);
    const swipeUp = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 760 }] });
      for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 760 - 34 * k }] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
    };
    const opts = await page.locator('.multi-options .option').evaluateAll((b) => b.map((x) => ({ t: x.textContent.trim(), h: Math.round(x.getBoundingClientRect().height) })));
    check(opts.length === 4 && opts.every((o) => o.h >= 44), `cuatro casillas tocables (${opts.map((o) => o.h).join(', ')} px)`);
    check(/todas/.test(await page.locator('.multi-hint').textContent()), 'avisa de que hay que marcar todas las correctas');
    await swipeUp();
    check(await page.locator('.boss.right, .boss.wrong').count() === 0, 'sin nada marcado, deslizar no comprueba');
    const pickTexts = wrong ? ['Escrita en Java puro'] : ['Escrita en Java puro', 'Se apoya en AWT'];
    for (const t of pickTexts) await page.locator('.multi-options .option', { hasText: t }).tap();
    check(await page.locator('.multi-options .option.is-marked').count() === pickTexts.length && /desliza/.test(await page.locator('.multi-hint').textContent()), `marcadas ${pickTexts.length}: se puede deslizar para comprobar`);
    if (!wrong) { await page.locator('.multi-options .option', { hasText: 'Escrita en .NET' }).tap(); await page.locator('.multi-options .option', { hasText: 'Escrita en .NET' }).tap(); check(await page.locator('.multi-options .option.is-marked').count() === 2, 'tocar otra vez desmarca'); }
    if (shots) await page.screenshot({ path: `${shots}/multi-${wrong ? 'fallo-antes' : 'antes'}.png` });
    await swipeUp();
    await page.waitForTimeout(200);
    if (wrong) {
      check(await page.locator('.boss.wrong').count() === 1 && /Eran/.test(await page.locator('.judge-truth').textContent()), 'marcar solo una de las dos buenas es fallo y enseña cuáles eran');
      check(await page.locator('.multi-options .option.is-right').count() === 2, 'se marcan en verde las dos buenas');
    } else {
      check(await page.locator('.boss.right').count() === 1, 'marcando exactamente las buenas, acierto');
    }
    if (shots) await page.screenshot({ path: `${shots}/multi-${wrong ? 'fallo' : 'acierto'}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    check(!overflow, 'nada se sale de la pantalla');
    await page.close();
  };
  await play(false);
  await play(true);
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

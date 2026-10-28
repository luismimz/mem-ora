// «Arcade sorpresa» en el Flujo (D-087) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor.
// Comprueba: la presentación; la cuenta atrás se ve (número grande y barra) y baja; acertar suma puntos y combo; si se
// acaba el tiempo, se dice y se ve la buena sin cortar el juego; el final con puntos; todo cabe y se toca con el dedo.
// Uso: pnpm --filter @memora/web e2e   (capturas en E2E_SHOTS si se indica)
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5195, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const keys = 'be,have,do,make,get,take,say,tell';
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];
  // Una semilla con la que el planificador pone el Arcade en la ronda.
  let page = null;
  for (const seed of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10']) {
    const p = await context.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await p.goto(`${server.resolvedUrls.local[0]}e2e/harness-escena.html?k=${keys}&s=${seed}&a=1&solo=arcade`);
    await p.waitForSelector('.slide');
    if (await p.evaluate(() => window.__plan.steps.some((s) => s.kind === 'arcade'))) { page = p; break; }
    await p.close();
  }
  check(Boolean(page), 'el planificador pone el Arcade sorpresa en alguna ronda');
  const tag = () => page.evaluate(() => document.querySelector('.slide .tag')?.textContent ?? '');
  check(/ARCADE SORPRESA/.test(await tag()), 'se presenta: «⚡ ARCADE SORPRESA»');
  const go = await page.locator('.arcade-go').boundingBox();
  check(go && go.height >= 44, `el botón «¡Jugar!» se toca con el dedo (${Math.round(go?.height ?? 0)} px)`);
  if (shots) await page.screenshot({ path: `${shots}/arcade-intro.png` });
  await page.locator('.arcade-go').tap();
  await page.waitForTimeout(200);
  const clock = await page.evaluate(() => { const b = document.querySelector('.arcade-bar')?.getBoundingClientRect(); return { secs: document.querySelector('.arcade-secs')?.textContent, bar: b ? Math.round(b.height) : 0, size: parseFloat(getComputedStyle(document.querySelector('.arcade-secs')).fontSize) }; });
  check(clock.secs === '5' && clock.bar >= 10 && clock.size >= 36, `la cuenta atrás se ve: ${clock.secs} s en grande (${clock.size}px) y barra de ${clock.bar}px`);
  await page.waitForTimeout(1300);
  const secs2 = await page.locator('.arcade-secs').textContent();
  check(Number(secs2) < 5, `y baja (${secs2} s)`);
  if (shots) await page.screenshot({ path: `${shots}/arcade-juego.png` });
  // Dos aciertos seguidos: puntos y combo.
  for (let n = 0; n < 2; n++) { await page.locator('.slide .option[data-ok="1"]').tap(); await page.waitForTimeout(800); }
  const pts = await page.locator('.arcade-pts').textContent();
  check(/^[1-9]\d* pts/.test(pts) && /×1\.5/.test(pts), `acertar suma puntos y combo («${pts.trim()}»)`);
  // Dejar que se acabe el tiempo.
  await page.waitForTimeout(5300);
  const late = await page.evaluate(() => ({ late: Boolean(document.querySelector('.arcade-late')), right: document.querySelectorAll('.slide .option.is-right').length }));
  check(late.late && late.right === 1, 'si se acaba el tiempo, lo dice y enseña la buena');
  if (shots) await page.screenshot({ path: `${shots}/arcade-tiempo.png` });
  await page.waitForTimeout(1700);
  const fresh = await page.locator('.arcade-secs').textContent();
  check(/ARCADE · 4\//.test(await tag()) && Number(fresh) >= 4, `y el juego sigue con la siguiente, con el reloj lleno (${fresh} s; antes nacía a 0)`);
  for (let n = 0; n < 3; n++) { await page.locator('.slide .option[data-ok="1"]').tap(); await page.waitForTimeout(800); }
  check(/FIN DEL ARCADE/.test(await tag()), 'al final, la puntuación');
  const end = await page.evaluate(() => document.querySelector('.slide')?.textContent ?? '');
  check(/5\/6 aciertos/.test(end) && /mejor combo ×3/.test(end), `con aciertos y mejor combo («${end.replace(/\s+/g, ' ').slice(0, 90)}»)`);
  const fit = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > innerWidth }));
  check(!fit.overflowX, 'nada se sale de la pantalla');
  if (shots) await page.screenshot({ path: `${shots}/arcade-fin.png` });
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

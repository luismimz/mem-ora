// «La cadena» (D-085) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor.
// Comprueba: primero se escucha y después te toca; las respuestas se tocan bien con el dedo; acertar todo completa la
// cadena y pasa sola; un fallo no corta la canción, pero al terminar enseña la ficha.
// Uso: pnpm --filter @memora/web e2e   (capturas en E2E_SHOTS si se indica)
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5198, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}e2e/harness-escena.html?k=g-short-answers`;
const shots = process.env.E2E_SHOTS;

const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];

  async function open(sessionId) {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await page.goto(`${base}&s=${sessionId}`);
    await page.waitForSelector('.slide');
    const cdp = await context.newCDPSession(page);
    const swipeUp = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 660 }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 660 - 34 * i }] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(450);
    };
    const tag = () => page.evaluate(() => document.querySelector('.slide .tag')?.textContent ?? '');
    const untilTag = async (re, max = 8) => { for (let i = 0; i < max && !re.test(await tag()); i++) await swipeUp(); return re.test(await tag()); };
    // Espera a que te toque contestar (o a que termine la cadena).
    const turn = async () => { for (let i = 0; i < 60; i++) { if (await page.locator('.slide .options .option').count() && !(await page.locator('.slide .options .is-right').count())) return true; if (await page.locator('.chant-done').count()) return false; await page.waitForTimeout(150); } return false; };
    return { page, swipeUp, tag, untilTag, turn };
  }

  // 1. Escuchar, después contestar todo bien.
  let s = await open('e2e-cadena');
  check(await s.untilTag(/LA CADENA/), 'tras la ficha del truco llega «La cadena»');
  check(/ESCUCHA/.test(await s.tag()) && (await s.page.locator('.slide .options .option').count()) === 0, 'los primeros versos se escuchan (sin botones)');
  const look = await s.page.evaluate(() => { const e = document.querySelector('.chant-emoji').getBoundingClientRect(); return { h: Math.round(e.height), overflowX: document.documentElement.scrollWidth > innerWidth, q: document.querySelector('.chant-q')?.textContent }; });
  check(look.h >= 80 && !look.overflowX && look.q === 'Is this a cat?', `emoji grande y la pregunta a la vista (${look.h}px, «${look.q}»)`);
  if (shots) await s.page.screenshot({ path: `${shots}/cadena-escucha.png` });
  check(await s.turn(), 'después te toca a ti');
  check(/TE TOCA/.test(await s.tag()), 'la etiqueta lo dice («TE TOCA»)');
  const sizes = await s.page.$$eval('.slide .options .option', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  check(sizes.length >= 2 && sizes.length <= 3 && sizes.every((h) => h >= 44), `respuestas que se tocan con el dedo (${sizes.join(', ')} px)`);
  if (shots) await s.page.screenshot({ path: `${shots}/cadena-turno.png` });
  let picks = 0;
  do {
    await s.page.locator('.slide .options .option[data-ok="1"]').tap();
    await s.page.waitForTimeout(150);
    if (picks === 0) {
      check(await s.page.locator('.slide .options .option.is-right').count() === 1, 'tocar la buena la marca en verde');
      if (shots) await s.page.screenshot({ path: `${shots}/cadena-acierto.png` });
    }
    picks += 1;
  } while (await s.turn());
  check(picks === 4, `contestas los cuatro eslabones tú (${picks})`);
  check(/¡Cadena completa!/.test(await s.page.locator('.chant-done').textContent()), '«¡Cadena completa!» al acertarlo todo');
  if (shots) await s.page.screenshot({ path: `${shots}/cadena-completa.png` });
  let moved = false;
  for (let i = 0; i < 20 && !moved; i++) { await s.page.waitForTimeout(200); moved = !/LA CADENA/.test(await s.tag()); }
  check(moved, 'y pasa sola a la siguiente tarjeta');
  await s.page.close();

  // 2. Un fallo no corta la canción; al terminar, la ficha.
  s = await open('e2e-cadena');
  await s.untilTag(/LA CADENA/);
  await s.turn();
  await s.page.locator('.slide .options .option[data-ok="0"]').first().tap();
  await s.page.waitForTimeout(150);
  check(await s.page.locator('.slide .options .option.is-wrong').count() === 1 && await s.page.locator('.slide .options .option.is-right').count() === 1, 'al fallar se ve la tuya en rojo y la buena en verde');
  if (shots) await s.page.screenshot({ path: `${shots}/cadena-fallo.png` });
  let more = 0;
  while (await s.turn()) { more += 1; await s.page.locator('.slide .options .option[data-ok="1"]').tap(); await s.page.waitForTimeout(150); }
  check(more === 3, `la cadena sigue tras el fallo (${more} eslabones más)`);
  check(/3 de 4/.test(await s.page.locator('.chant-done').textContent()), 'al final, cuántos eslabones salieron bien');
  let teach = false;
  for (let i = 0; i < 20 && !teach; i++) { await s.page.waitForTimeout(200); teach = /RECUÉRDALO/.test(await s.tag()); }
  check(teach, 'y después la ficha del truco para repasarlo');
  await s.page.close();
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

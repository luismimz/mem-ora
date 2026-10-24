// «La escena que cambia» (D-084) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor.
// Comprueba: la escena se ve entera y el bicho se MUEVE de una frase a otra; tocar la escena correcta acierta y pasa
// sola; tocar una incorrecta enseña la ficha; y la versión «ver la escena y elegir la frase».
// Uso: pnpm --filter @memora/web e2e   (capturas en E2E_SHOTS si se indica)
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5199, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}e2e/harness-escena.html`;
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
    // Sin voz en la prueba: speechSynthesis no existe en el Chromium sin cabeza y los audios no están en el banco.
    await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await page.goto(`${base}?s=${sessionId}`);
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
    const step = () => page.evaluate(() => { const p = window.__plan; return p.steps.find((s) => s.kind === 'spot' && !s.retry); });
    return { page, swipeUp, tag, untilTag, step };
  }

  // 1. Mirar: la escena cabe y el bicho se mueve.
  let s = await open('e2e-escena');
  check(await s.untilTag(/MIRA CÓMO CAMBIA/), 'tras la ficha del truco llega «Mira cómo cambia»');
  const box = await s.page.evaluate(() => { const b = document.querySelector('.scene-box').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom), overflowX: document.documentElement.scrollWidth > innerWidth }; });
  check(box.w >= 250 && box.w === box.h && box.bottom <= 844 && !box.overflowX, `la escena es cuadrada, grande y cabe en la pantalla (${box.w}×${box.h}, abajo en ${box.bottom}px)`);
  const where = () => s.page.evaluate(() => { const a = [...document.querySelectorAll('.scene-box .actor')].find((x) => x.textContent === '🐛'); const r = a.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), say: document.querySelector('.stage-say')?.textContent }; });
  const first = await where();
  if (shots) await s.page.screenshot({ path: `${shots}/escena-mira-1.png` });
  await s.page.waitForTimeout(3600);
  const second = await where();
  if (shots) await s.page.screenshot({ path: `${shots}/escena-mira-2.png` });
  check(first.say !== second.say && (first.x !== second.x || first.y !== second.y), `el bicho se mueve y cambia la frase («${first.say}» → «${second.say}»)`);
  // Con capturas: todas las escenas, una a una, para revisarlas a ojo.
  if (shots) for (let i = 3; i <= 7; i++) { await s.page.waitForTimeout(3500); await s.page.screenshot({ path: `${shots}/escena-mira-${i}.png` }); }

  // 2. ¿Dónde está?: tocar la escena correcta.
  await s.swipeUp();
  const spot = await s.step();
  check(/DÓNDE ESTÁ|QUÉ PASA AQUÍ/.test(await s.tag()), `después se juega (${(await s.tag()).trim()})`);
  const sel = spot.reverse ? '.options .option' : '.stage-option';
  const n = await s.page.locator(sel).count();
  check(n === 3, `tres opciones para elegir (${n})`);
  const sizes = await s.page.$$eval(sel, (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  check(sizes.every((h) => h >= 44), `se pueden tocar con el dedo (${sizes.join(', ')} px)`);
  if (shots) await s.page.screenshot({ path: `${shots}/escena-juego.png` });
  await s.page.locator(`${sel}[data-n="${spot.example}"]`).tap();
  await s.page.waitForTimeout(250);
  check(await s.page.evaluate(() => document.querySelector('.slide').classList.contains('right')), 'tocar la correcta la marca en verde');
  if (shots) await s.page.screenshot({ path: `${shots}/escena-acierto.png` });
  // Al acertar suena la frase (audio Kokoro) y después pasa sola: se espera a que cambie la etiqueta.
  let moved = false;
  for (let i = 0; i < 20 && !moved; i++) { await s.page.waitForTimeout(250); moved = !/DÓNDE ESTÁ|QUÉ PASA AQUÍ/.test(await s.tag()); }
  check(moved, 'al acertar pasa sola a la siguiente tarjeta (tras oír la frase)');
  await s.page.close();

  // 3. Fallar enseña la ficha.
  s = await open('e2e-escena');
  await s.untilTag(/MIRA CÓMO CAMBIA/);
  await s.swipeUp();
  const spot2 = await s.step();
  const sel2 = spot2.reverse ? '.options .option' : '.stage-option';
  const wrong = await s.page.$$eval(sel2, (els, ok) => els.map((e) => e.dataset.n).find((x) => x !== String(ok)), spot2.example);
  await s.page.locator(`${sel2}[data-n="${wrong}"]`).tap();
  await s.page.waitForTimeout(250);
  check(await s.page.evaluate(() => document.querySelector('.slide').classList.contains('wrong')), 'tocar una incorrecta la marca en rojo');
  await s.page.waitForTimeout(1800);
  const teach = await s.page.evaluate(() => document.querySelector('.slide')?.textContent ?? '');
  check(/IN dentro|NEXT TO/.test(teach), 'al fallar aparece la ficha del truco para repasarlo');
  if (shots) await s.page.screenshot({ path: `${shots}/escena-fallo.png` });
  await s.page.close();

  // 4. La versión al revés: ver la escena y elegir la frase (otra semilla).
  let found = false;
  for (const seed of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']) {
    s = await open(seed);
    const st = await s.step();
    if (st.reverse) {
      await s.untilTag(/MIRA CÓMO CAMBIA/);
      await s.swipeUp();
      check(/QUÉ PASA AQUÍ/.test(await s.tag()) && (await s.page.locator('.scene-box').count()) === 1, 'al revés: una escena grande y tres frases');
      if (shots) await s.page.screenshot({ path: `${shots}/escena-al-reves.png` });
      await s.page.locator(`.options .option[data-n="${st.example}"]`).tap();
      await s.page.waitForTimeout(250);
      check(await s.page.evaluate(() => document.querySelector('.slide').classList.contains('right')), 'al revés, elegir la frase correcta acierta');
      found = true;
      await s.page.close();
      break;
    }
    await s.page.close();
  }
  check(found, 'alguna sesión juega la versión al revés');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

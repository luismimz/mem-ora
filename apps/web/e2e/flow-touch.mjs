// Prueba del modo Flujo con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor ni Directus.
// Por qué existe: el deslizar estuvo roto en el iPhone mientras la puerta de calidad lo daba por bueno, porque
// «deslizaba» con la tecla ↑. Aquí el gesto se envía como un dedo (CDP Input.dispatchTouchEvent), igual que en el móvil.
//
// Uso: pnpm --filter @memora/web e2e
// Navegador: el Chromium de Playwright (`npx playwright install chromium`) o el de la ruta PW_CHROMIUM.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5198, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness.html`;

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

  const card = () => page.evaluate(() => {
    const s = document.querySelector('.slide');
    return {
      title: s?.querySelector('h2, h3')?.textContent ?? '',
      tag: s?.querySelector('.tag')?.textContent ?? '',
      top: Math.round(s?.scrollTop ?? 0),
      max: s ? s.scrollHeight - s.clientHeight : 0,
      height: Math.round(s?.getBoundingClientRect().height ?? 0),
      overflowX: document.documentElement.scrollWidth > innerWidth,
    };
  });
  /** Un dedo de (x, y0) a (x1, y1) en 10 pasos, como un deslizar real. */
  async function drag(x0, y0, x1, y1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 10, y: y0 + ((y1 - y0) * i) / 10 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
  }
  const swipeUp = () => drag(195, 620, 195, 300);

  // 1. Ficha corta: un deslizar hacia arriba pasa a la siguiente.
  let c = await card();
  check(c.title.startsWith('KEY') && c.height <= 844, `empieza en la ficha corta y cabe en la pantalla (${c.height}px)`);
  await swipeUp();
  c = await card();
  check(c.title.startsWith('LOCK'), 'deslizar con el dedo pasa de la ficha corta a la siguiente');

  // 2. Ficha larga: no se recorta; primero se desplaza y, al llegar abajo, el deslizar pasa de tarjeta.
  check(c.height <= 844 && c.max > 0, `la ficha larga no se sale de la pantalla y se puede desplazar (${c.max}px de más)`);
  await swipeUp();
  c = await card();
  check(c.title.startsWith('LOCK') && c.top > 0, 'en la ficha larga, el primer deslizar desplaza el contenido (no salta la ficha sin leerla)');
  for (let i = 0; i < 4 && (await card()).title.startsWith('LOCK'); i++) await swipeUp();
  c = await card();
  check(c.tag.includes('RELÁMPAGO'), 'al llegar abajo, deslizar pasa a la pregunta');

  // 3. Relámpago: tocar la respuesta correcta pasa sola.
  const right = page.locator('.option', { hasText: /^KEY$/ });
  if (await right.count()) await right.first().tap();
  await page.waitForTimeout(1200);
  c = await card();
  check(c.tag.includes('VERDAD O MENTIRA'), 'tocar la respuesta correcta pasa sola a la siguiente tarjeta');

  // 4. ¿Verdad o mentira?: deslizar la tarjeta a la derecha con el dedo responde «verdad».
  const box = await page.locator('.judge-card').boundingBox({ timeout: 2000 }).catch(() => null);
  if (box) {
    await drag(box.x + 40, box.y + box.height / 2, box.x + box.width - 10, box.y + box.height / 2);
    await page.waitForTimeout(1000);
  }
  c = await card();
  check(c.tag.includes('RONDA'), 'deslizar a la derecha en «¿verdad o mentira?» responde y llega al hito');

  // 5. Hito: deslizar encadena la siguiente ronda (sin conexión, pide otra sesión).
  for (let i = 0; i < 3 && !(await page.evaluate(() => window.__flowLog.length)); i++) await swipeUp();
  check((await page.evaluate(() => window.__flowLog)).includes('again'), 'en el hito, deslizar pide la ronda siguiente');

  check(!c.overflowX, 'nada se sale por los lados');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

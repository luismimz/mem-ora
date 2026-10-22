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

  // ── Inglés (D-079): escuchar, construir la frase y truco de gramática, con el planificador real ──
  const en = await context.newPage();
  await en.addInitScript(() => {
    window.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', { value: { speaking: false, pending: false, paused: false, speak(u) { window.__spoken.push(u.text); }, cancel() {}, resume() {}, getVoices() { return []; } } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  const enErrors = [];
  en.on('pageerror', (e) => enErrors.push(String(e)));
  await en.goto(url.replace('harness.html', 'harness-ingles.html'));
  await en.waitForSelector('.slide');
  const cdpEn = await context.newCDPSession(en);
  const swipeEn = async () => {
    await cdpEn.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 640 }] });
    for (let i = 1; i <= 10; i++) { await cdpEn.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 640 - 32 * i }] }); await en.waitForTimeout(16); }
    await cdpEn.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await en.waitForTimeout(500);
  };
  const units = await en.evaluate(() => window.__units);
  const seen = new Set();
  let builtOk = false;
  for (let n = 0; n < 80; n++) {
    const tag = (await en.locator('.slide .tag').first().textContent().catch(() => '')) ?? '';
    if (process.env.E2E_DEBUG) console.log('  ·', n, tag);
    if (/RONDA/.test(tag)) { seen.add('hito'); break; }
    if (/ESCUCHA/.test(tag)) {
      seen.add('escucha');
      const spoken = await en.evaluate(() => window.__spoken.at(-1));
      const u = Object.values(units).find((x) => x.payload.text === spoken);
      await en.locator('.option', { hasText: new RegExp(`^${u.payload.meaning}$`) }).tap();
      await en.waitForTimeout(1400); continue;
    }
    if (/CONSTRUYE/.test(tag)) {
      seen.add('construye');
      if (await en.locator('.train-help').count()) {
        // La ayuda «¿Cómo se construye?» reproduce el espejo en movimiento dentro de la tarjeta, sin más toques.
        await en.locator('.train-help').tap();
        await en.locator('.morph-end').waitFor({ timeout: 9000 }).catch(() => undefined);
        if (await en.locator('.morph-end').count()) seen.add('ayuda-tren');
      }
      const es = (await en.locator('.build-es').textContent()).replace(/[«»]/g, '');
      const u = Object.values(units).find((x) => x.payload.examples.some((e) => e.translation === es));
      const words = u.payload.examples.find((e) => e.translation === es).text.replace(/[.!?]+$/, '').split(/\s+/);
      for (const w of words) { await en.locator('.build-bank .tile:not([disabled])', { hasText: new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().tap(); await en.waitForTimeout(100); }
      await en.waitForTimeout(200);
      if (await en.locator('.slide.build.right').count()) builtOk = true;
      await en.waitForTimeout(1600); continue;
    }
    if (/🎮/.test(tag)) {
      // Ráfaga (D-081): con dos respuestas se desliza la tarjeta (← la primera, la segunda →); con tres, botones.
      const u = Object.values(units).find((x) => x.type === 'concept' && tag.includes(x.payload.name.toUpperCase()));
      const two = (await en.locator('.burst-btn').count()) === 2;
      for (let k = 0; k < 12 && /🎮/.test((await en.locator('.slide .tag').first().textContent().catch(() => '')) ?? ''); k++) {
        const prompt = await en.locator('.burst-prompt').textContent().catch(() => null);
        if (!prompt) { await en.waitForTimeout(300); continue; }
        const ex = u.payload.exercises.find((e) => e.prompt === prompt);
        if (!ex) { if (process.env.E2E_DEBUG) console.log('  ? prompt', JSON.stringify(prompt), u.key, u.payload.exercises.map((e) => e.prompt)); await en.waitForTimeout(300); continue; }
        if (two) {
          const box = await en.locator('.burst-card').boundingBox();
          const left = ex.answer === u.payload.exercises[0].answer;
          const y = box.y + box.height / 2; const x0 = box.x + box.width / 2; const x1 = left ? x0 - 150 : x0 + 150;
          await cdpEn.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
          for (let i = 1; i <= 8; i++) { await cdpEn.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y }] }); await en.waitForTimeout(16); }
          await cdpEn.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          seen.add('rafaga-desliza');
        } else {
          await en.locator('.burst-btn', { hasText: new RegExp(`^${ex.answer}$`) }).tap();
          seen.add('rafaga-botones');
        }
        await en.waitForTimeout(150);
        if (await en.locator('.confetti').count()) seen.add('confeti');
        await en.waitForTimeout(600);
      }
      await en.waitForTimeout(800); continue;
    }
    if (/TRUCO/.test(tag)) {
      seen.add('truco');
      // D-082: el espejo en movimiento va solo, sin tocar nada: termina en el orden inglés y con la frase.
      if (await en.locator('.morph').count()) {
        await en.locator('.morph-end').waitFor({ timeout: 9000 }).catch(() => undefined);
        const english = (await en.locator('.morph-row .mchip .back b').allTextContents()).join(' ');
        if (await en.locator('.morph-end').count()) seen.add('espejo-solo');
        if (english === 'are you hungry') seen.add('orden-pregunta');
      }
    }
    if (/VERDAD/.test(tag)) { await en.locator('.option.yes').tap(); await en.waitForTimeout(1300); continue; }
    if (/RELÁMPAGO|AL REVÉS/.test(tag)) { await en.locator('.option').first().tap(); await en.waitForTimeout(1300); continue; }
    if (/ESCRÍBELO/.test(tag)) {
      const m = await en.locator('.ask b').textContent();
      const u = Object.values(units).find((x) => x.payload.meaning === m);
      await en.locator('input.write').fill(u.payload.text); await en.locator('input.write').press('Enter');
      await en.waitForTimeout(1300); continue;
    }
    await swipeEn();
  }
  check(seen.has('escucha'), 'inglés: aparece «Escucha» y se responde tocando lo que se ha oído');
  check(seen.has('construye') && builtOk, 'inglés: «Construye la frase» se completa tocando las palabras en orden');
  check(seen.has('truco'), 'inglés: la gramática entra con su «Truco»');
  check(seen.has('espejo-solo'), 'Espejo en movimiento: se reproduce solo dentro del truco, sin toques, y acaba en la frase');
  check(seen.has('orden-pregunta'), 'Espejo en movimiento: el ayudante salta y queda «are you hungry» (orden de pregunta)');
  check(seen.has('ayuda-tren'), '«Construye la frase» ofrece ver cómo se construye (el espejo animado)');
  check(seen.has('rafaga-desliza'), 'Ráfaga de dos respuestas («Toco o cuento»): se responde deslizando la tarjeta con el dedo');
  check(seen.has('rafaga-botones'), 'Ráfaga de tres respuestas («Semáforos»): se responde golpeando los botones');
  check(seen.has('confeti'), 'Ráfaga: al acertar sale confeti');
  check(seen.has('hito'), 'inglés: la ronda llega al hito (deslizando también desde encima de los botones 🔊)');
  check(enErrors.length === 0, `inglés: sin errores en la página${enErrors.length ? `: ${enErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

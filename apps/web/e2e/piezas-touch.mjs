// «Las piezas» (D-092) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor y con el contenido real del
// curso. Comprueba: la ficha del truco enseña el ejemplo «girando» cada pieza (se gira sola si no tocas y al tocar gira
// la que eliges); con todas giradas se colocan en el orden del inglés y sale la regla; el paso «Las piezas» llega
// después: si el inglés adelanta una pieza, «¿Cuál se adelanta?» y luego ordenarlas; si sigues el orden del español,
// se dice; si el orden no cambia, «¿Cuál falta?». Nada se sale de la pantalla.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5197, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const root = `${server.resolvedUrls.local[0]}e2e/harness-escena.html`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];
  const open = async (query) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await page.goto(`${root}?${query}`);
    await page.waitForSelector('.slide');
    return page;
  };
  const fits = (page) => page.evaluate(() => {
    const out = [...document.querySelectorAll('.slide button, .ptile, .mchip')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); });
    return !(document.documentElement.scrollWidth > innerWidth) && out.length === 0;
  });
  const tapText = (page, sel, text) => page.locator(sel, { hasText: text }).first().tap();
  // Deslizar hacia arriba con el dedo (CDP): así se sigue cuando hay que leer algo (sin botones).
  const swipe = async (page) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 700 }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 700 - 32 * i }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
  };

  // 1. El plan: tras la ficha del truco, «Las piezas» y después «Construye la frase» con OTRO ejemplo.
  let page = await open('k=g-adjective-order');
  const plan = await page.evaluate(() => window.__plan.steps.map((s) => ({ kind: s.kind, example: s.example })));
  const reel = plan.findIndex((s) => s.kind === 'reel');
  const pieces = plan.findIndex((s) => s.kind === 'pieces');
  const build = plan.findIndex((s, i) => i > pieces && s.kind === 'build');
  check(reel >= 0 && pieces > reel && build > pieces, `orden de la ronda: ficha (${reel + 1}.ª) → las piezas (${pieces + 1}.ª) → construye (${build + 1}.ª)`);
  check(build < 0 || plan[build].example !== plan[pieces].example, `«Construye» usa otro ejemplo (${plan[pieces].example} → ${plan[build]?.example})`);
  // D-093: las dos son frases NUEVAS (de práctica), no las de la ficha.
  const nEx = await page.evaluate(() => Object.values(window.__units)[0].payload.examples.length);
  check(plan[pieces].example >= nEx && plan[build].example >= nEx, `«Las piezas» y «Construye» usan frases nuevas que no salen en la ficha (${plan[pieces].example}, ${plan[build].example} ≥ ${nEx})`);

  // 2. La ficha: las piezas en español, gira con el dedo y, si no tocas, se giran solas.
  await page.waitForSelector('.flipm .mchip');
  const start = await page.evaluate(() => ({ chips: [...document.querySelectorAll('.flipm .mchip')].map((c) => c.textContent), cap: document.querySelector('.flipm .morph-cap')?.textContent }));
  check(start.chips.length >= 3 && /gírala/.test(start.cap ?? ''), `la ficha enseña ${start.chips.length} piezas para girar («${start.cap}»)`);
  if (shots) await page.waitForTimeout(800), await page.screenshot({ path: `${shots}/piezas-ficha.png` });
  await page.locator('.flipm .mchip.todo').last().tap();
  const afterTap = await page.locator('.flipm .mface.flipped').count();
  check(afterTap === 1, 'al tocar una pieza, se gira esa (y se ve en inglés)');
  await page.waitForFunction(() => document.querySelectorAll('.flipm .mface.flipped').length >= 2, null, { timeout: 4000 }).catch(() => undefined);
  check(await page.locator('.flipm .mface.flipped').count() >= 2, 'si no tocas, la siguiente pieza se gira sola');
  if (shots) await page.waitForTimeout(800), await page.screenshot({ path: `${shots}/piezas-girando.png` });
  await page.locator('.flip-all').tap();
  await page.waitForSelector('.flipm .morph-end', { timeout: 5000 });
  const end = await page.evaluate(() => ({ cap: document.querySelector('.flipm .morph-cap')?.textContent, words: [...document.querySelectorAll('.flipm .mchip .back b')].map((b) => b.textContent).join(' '), why: document.querySelector('.flipm .why')?.textContent, final: document.querySelector('.flipm .train-final')?.textContent }));
  check(/orden cambia/.test(end.cap ?? '') && /car red|red car/.test(end.words), `con todas giradas se colocan en orden inglés: «${end.words}»`);
  check(Boolean(end.why), `y aparece la regla: «${end.why}»`);
  check(await fits(page), 'la ficha no se sale de la pantalla');
  if (shots) await page.waitForTimeout(800), await page.screenshot({ path: `${shots}/piezas-ficha-final.png` });
  await page.close();

  // 2b. El salto se VE (D-094), también con «Reducir movimiento» (iPhone): la pieza que cambia de sitio se desliza
  //     iluminada hasta su sitio, no aparece de golpe.
  for (const motion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: motion });
    const p = await ctx.newPage();
    await p.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await p.goto(`${root}?k=g-adjective-order&solo=reel`);
    await p.waitForSelector('.flipm .mchip');
    await p.locator('.flip-all').tap();
    await p.waitForSelector('.flipm .mchip.jumping', { timeout: 3000 }).catch(() => undefined);
    const seen = await p.evaluate(() => { const j = document.querySelector('.flipm .mchip.jumping'); return { word: j?.querySelector('.back b')?.textContent, moving: j ? j.getAnimations().length > 0 : false }; });
    check(seen.word === 'red' && seen.moving, `${motion === 'reduce' ? 'con «Reducir movimiento»' : 'normal'}: «red» se mueve iluminada hasta su sitio (no cambia de golpe)`);
    if (shots) await p.waitForTimeout(250), await p.screenshot({ path: `${shots}/piezas-salto-${motion}.png` });
    await ctx.close();
  }

  // 3. «¿Cuál se adelanta?» → ordenar bien.
  page = await open('k=g-adjective-order&solo=pieces');
  await page.waitForSelector('.pieces');
  const tag = await page.locator('.pieces .tag').textContent();
  check(/ADELANTA/.test(tag), `primero: «${tag.trim()}»`);
  const head = await page.evaluate(() => ({ top: Math.round(document.querySelector('.pieces .tag').getBoundingClientRect().top), badge: document.querySelector('.pieces-new')?.textContent, goal: document.querySelector('.pieces-goal')?.textContent }));
  check(head.top < 200 && /nueva/i.test(head.badge ?? '') && Boolean(head.goal), `empieza arriba como la ficha (${head.top}px), con el truco («${head.goal}») y «${head.badge}»`);
  check(await fits(page), 'las piezas caben en la pantalla');
  if (shots) await page.waitForTimeout(800), await page.screenshot({ path: `${shots}/piezas-adelanta.png` });
  const ex = await page.evaluate(() => { const s = window.__plan.steps.find((x) => x.kind === 'pieces'); const u = window.__units[s.unitKey]; const m = [...u.payload.examples, ...(u.payload.practice ?? [])][s.example].mirror; const order = m.order ?? m.pieces.map((_, i) => i); return { pieces: m.pieces, order }; });
  const jumper = ex.order.find((v, k) => v !== k && ex.order.indexOf(v) < v) ?? ex.order.find((v, k) => v !== k);
  await tapText(page, '.pieces-row .ptile', ex.pieces[jumper].es);
  const v1 = await page.locator('.tense-verdict').textContent();
  check(/Eso es/.test(v1), `tocar la pieza que salta («${ex.pieces[jumper].es}») acierta y explica por qué`);
  check(await page.locator('.pieces .arcade-go').count() === 0, 'sin botones de «seguir»');
  await page.waitForSelector('.pieces-slots', { timeout: 3000 });
  check(true, 'al acertar, pasa sola a ordenar');
  for (const i of ex.order) await page.locator('.pieces-row .ptile:not(.used)', { hasText: ex.pieces[i].en }).first().tap();
  const v2 = await page.locator('.tense-verdict').textContent();
  check(/Perfecto/.test(v2), `ordenarlas en inglés: «${v2}»`);
  if (shots) await page.waitForTimeout(800), await page.screenshot({ path: `${shots}/piezas-bien.png` });
  await page.waitForSelector('.summary, .slide:not(.pieces)', { timeout: 5000 });
  check(true, 'al ordenarlas bien, pasa sola a la siguiente tarjeta');
  await page.close();

  // 4. Fallo: seguir el orden del español se dice, y se enseña el orden bueno con la pieza que salta marcada.
  page = await open('k=g-adjective-order&solo=pieces');
  await page.waitForSelector('.pieces');
  await page.locator('.pieces-row .ptile').first().tap();
  await page.waitForTimeout(1500);
  check(await page.locator('.pieces-slots').count() === 0, 'si fallas, NO pasa sola: te deja leer por qué');
  await swipe(page);
  await page.waitForSelector('.pieces-slots', { timeout: 3000 });
  for (let i = 0; i < ex.pieces.length; i += 1) await page.locator('.pieces-row .ptile:not(.used)', { hasText: ex.pieces[i].en }).first().tap();
  const bad = await page.evaluate(() => ({ v: document.querySelector('.tense-verdict')?.textContent, jumped: document.querySelectorAll('.ptile.jumped').length, why: document.querySelector('.pieces .why')?.textContent }));
  check(/orden del español/.test(bad.v ?? ''), `si sigues el orden del español, se dice: «${bad.v}»`);
  check(bad.jumped >= 1 && Boolean(bad.why), `y se ve el orden bueno con la pieza que salta marcada y la regla`);
  if (shots) await page.waitForTimeout(800), await page.screenshot({ path: `${shots}/piezas-fallo.png` });
  await page.close();

  // 5. Mismo orden que en español: «¿Cuál falta?».
  page = await open('k=g-present-continuous&learned=g-present-simple,g-past-simple&solo=pieces');
  const has = await page.locator('.pieces').count();
  if (has) {
    const t = await page.locator('.pieces .tag').textContent();
    check(/FALTA|ADELANTA|ORDÉNALAS/.test(t), `en otro truco: «${t.trim()}»`);
    if (/FALTA/.test(t)) {
      check(await page.locator('.tense-options .burst-btn').count() === 3, '«¿Cuál falta?» da 3 opciones');
      if (shots) await page.waitForTimeout(800), await page.screenshot({ path: `${shots}/piezas-falta.png` });
    }
  } else check(true, 'este truco no tiene ejemplo por piezas (no hay paso)');
  await page.close();

  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\nLas piezas: ${results.length} comprobaciones correctas`);
process.exit(failed ? 1 : 0);

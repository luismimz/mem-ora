// El Taller (D-090) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor y con conceptos de prueba.
// Comprueba: el Taller llega DESPUÉS de enseñar sus conceptos; «¿Qué es esto?» no deja la respuesta a la vista;
// «Completa el código» rellena el hueco con la ficha tocada; «¿Qué imprime?» ejecuta y enseña la salida; «Caza el bug»
// y «Señala la parte» se juegan tocando la línea; «¿Qué componente es?» dibuja el componente; cada respuesta se explica; al final, estrellas
// y, si fallaste, vuelve la ficha. Todo cabe y se toca con el dedo.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5199, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}e2e/harness-taller.html`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];
  const open = async (query) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await page.goto(`${base}?${query}`);
    await page.waitForSelector('.slide');
    return page;
  };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.slide button, .wm, .shop-code, .shop-term')].some((el) => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }));

  // 1. En la ronda completa, cada reto va después de la ficha de su concepto.
  let page = await open('s=t1');
  const order = await page.evaluate(() => {
    const steps = window.__plan.steps;
    return steps.flatMap((s, i) => (s.kind === 'workshop' ? s.workshop.map((it) => ({ it: it.unitKey, after: steps.slice(0, i).some((x) => x.kind === 'reel' && x.unitKey === it.unitKey) })) : []));
  });
  check(order.length >= 6 && order.every((o) => o.after), `el Taller llega después de enseñar cada concepto (${order.length} retos)`);
  await page.close();

  // 2. Jugar los Talleres.
  // Una semilla en la que salen los cinco tipos de reto.
  let seed = null;
  for (let k = 1; k <= 30 && !seed; k++) {
    const p = await open(`s=t${k}`);
    const kinds = await p.evaluate(() => [...new Set(window.__plan.steps.filter((s) => s.kind === 'workshop').flatMap((s) => s.workshop.map((it) => (it.kind === 'code' ? window.__units[it.unitKey].payload.exercises[it.exercise].kind : it.kind))))]);
    if (kinds.length === 6) seed = `t${k}`;
    await p.close();
  }
  check(Boolean(seed), `hay rondas con los seis tipos de reto (semilla ${seed})`);
  page = await open(`s=${seed}&solo=workshop`);
  const cdp = await context.newCDPSession(page);
  const swipeUp = async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 760 }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 760 - 34 * k }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
  };
  const noButton = async (where) => check(await page.locator('.slide button.arcade-go').count() === 0, `${where}: sin botón, se desliza`);
  const shops = await page.evaluate(() => window.__plan.steps.filter((s) => s.kind === 'workshop').map((s) => s.workshop));
  const seen = new Set(); let failedOnce = false;
  for (const [n, items] of shops.entries()) {
    await page.waitForFunction(() => /TALLER/.test(document.querySelector('.slide .tag')?.textContent ?? ''), null, { timeout: 5000 });
    if (n === 0) {
      check(await page.locator('.shop-kinds span').count() >= 2, 'se presenta el Taller con los tipos de reto');
      if (shots) await page.screenshot({ path: `${shots}/taller-intro.png` });
      await noButton('la presentación');
    }
    await swipeUp();
    for (const [i, it] of items.entries()) {
      await page.waitForFunction((k) => new RegExp(` · ${k}/`).test(document.querySelector('.slide .tag')?.textContent ?? ''), i + 1, { timeout: 5000 });
      const u = await page.evaluate((k) => window.__units[k].payload, it.unitKey);
      const ex = it.kind === 'code' ? u.exercises[it.exercise] : null;
      const kind = ex ? ex.kind : it.kind;
      const wrongNow = !failedOnce && kind === 'widget';
      if (i === 1) {
        // Tras un acierto queda el confeti (fijo) como último hijo: el contenido debe seguir centrado, no pegado abajo.
        const gaps = await page.evaluate(() => {
          const sl = [...document.querySelectorAll('.slide')].find((x) => x.querySelector('.arcade-head'));
          const st = getComputedStyle(sl); const r = sl.getBoundingClientRect();
          const kids = [...sl.children].filter((c) => !['fixed', 'absolute'].includes(getComputedStyle(c).position) && c.getBoundingClientRect().height > 0);
          const top = kids[0].getBoundingClientRect().top - r.top - parseFloat(st.paddingTop);
          const bottom = r.bottom - parseFloat(st.paddingBottom) - kids.at(-1).getBoundingClientRect().bottom;
          return { top: Math.round(top), bottom: Math.round(bottom), confetti: Boolean(document.querySelector('.confetti')), inside: Boolean(sl.querySelector('.confetti')) };
        });
        check(!gaps.inside, 'el confeti se dibuja fuera de la tarjeta (no puede descolocarla)');
        check(Math.abs(gaps.top - gaps.bottom) <= 24, `el reto queda centrado aunque haya confeti (arriba ${gaps.top} px, abajo ${gaps.bottom} px, confeti: ${gaps.confetti})`);
      }
      if (kind === 'whatis') {
        const shown = await page.locator('.shop-code, .shop-case').first().textContent();
        check(!shown.toLowerCase().includes(u.name.toLowerCase()) && shown.includes('▢▢▢') === shown.toLowerCase().includes('▢'), `«¿Qué es esto?» no enseña el nombre («${u.name}» oculto)`);
        await page.locator('.slide .option', { hasText: new RegExp(`^${esc(u.name)}$`) }).tap();
      } else if (kind === 'widget') {
        const box = await page.locator('.wm').boundingBox();
        check(box && box.width >= 280 && box.height >= 120, `«¿Qué componente es?» dibuja el componente (${u.widget}, ${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)})`);
        if (!seen.has('widget') && shots) await page.screenshot({ path: `${shots}/taller-widget.png` });
        const opts = await page.locator('.slide .option').allTextContents();
        await page.locator('.slide .option', { hasText: new RegExp(`^${esc(wrongNow ? opts.find((o) => o !== u.name) : u.name)}$`) }).tap();
        if (wrongNow) { failedOnce = true; check(/Era/.test(await page.locator('.tense-verdict').textContent()), 'al fallar, dice cuál era y qué es'); }
      } else if (kind === 'fill_gap') {
        const tiles = await page.locator('.shop-tile').evaluateAll((b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
        check(tiles.length === ex.distractors.length + 1 && tiles.every((h) => h >= 44), `«Completa el código»: fichas tocables (${tiles.join(', ')} px)`);
        await page.locator('.shop-tile', { hasText: new RegExp(`^${esc(ex.answer)}$`) }).tap();
        check((await page.locator('.shop-slot.ok').textContent()) === ex.answer, `la ficha tocada rellena el hueco («${ex.answer}»)`);
        if (shots) await page.screenshot({ path: `${shots}/taller-completa.png` });
      } else if (kind === 'predict_output') {
        await page.locator('.slide .option', { hasText: new RegExp(`^${esc(ex.answer)}$`) }).tap();
        check((await page.locator('.shop-out').textContent()).includes(ex.answer), `«¿Qué imprime?» ejecuta y enseña la salida («${ex.answer}»)`);
        if (shots) await page.screenshot({ path: `${shots}/taller-imprime.png` });
      } else if (kind === 'find_bug') {
        const lines = await page.locator('.shop-line').evaluateAll((b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
        check(lines.length === ex.code.split('\n').length && lines.every((h) => h >= 44), `«Caza el bug»: cada línea se toca con el dedo (${lines.length} líneas)`);
        await page.locator('.shop-line').nth(ex.bugLine).tap();
        check(await page.locator('.shop-line.bug').count() === 1 && /Arreglo/.test(await page.locator('.tense-why').textContent()), 'al cazarlo, se marca la línea y se enseña el arreglo');
        if (shots) await page.screenshot({ path: `${shots}/taller-bug.png` });
      } else if (kind === 'spot_part') {
        const ask = await page.locator('.shop-ask').textContent();
        const lines = await page.locator('.shop-line').evaluateAll((b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
        check(ask === ex.prompt && lines.length === ex.code.split('\n').length && lines.every((h) => h >= 44), `«Señala la parte»: «${ask}» y cada línea se toca (${lines.length} líneas)`);
        await page.locator('.shop-line').nth(ex.line).tap();
        const why = await page.locator('.tense-why').textContent();
        check(await page.locator('.shop-line.spot').count() === 1 && why.includes(ex.answer), `al señalarla, se marca en verde y se nombra la parte («${why.trim()}»)`);
        if (shots) await page.screenshot({ path: `${shots}/taller-parte.png` });
      }
      seen.add(kind);
      check(!(await overflow(page)), `${kind}: nada se sale de la pantalla`);
      const right = await page.locator('.tense-verdict.ok').count();
      if (right) await page.waitForFunction((k) => !new RegExp(` · ${k}/`).test(document.querySelector('.slide .tag')?.textContent ?? ''), i + 1, { timeout: 5000 });
      else { await noButton('tras fallar'); await swipeUp(); }
      if (right && !seen.has('auto')) { seen.add('auto'); check(true, 'al acertar, pasa solo al siguiente reto'); }
    }
    await page.waitForFunction(() => /TALLER TERMINADO/.test(document.querySelector('.slide .tag')?.textContent ?? ''), null, { timeout: 5000 });
    if (shots && n === 0) await page.screenshot({ path: `${shots}/taller-fin.png` });
    const failedHere = await page.locator('.shop-end .muted').count();
    if (n === 0) await noButton('el final');
    await swipeUp();
    await page.waitForTimeout(300);
    if (failedHere) {
      check(/RECUÉRDALO/.test(await page.locator('.slide .tag').first().textContent()), 'como fallaste uno, vuelve su ficha antes de seguir');
      if (shots) await page.screenshot({ path: `${shots}/taller-repaso.png` });
      await swipeUp();
    }
  }
  // 3. El Arcade de conceptos da tiempo para leer (usuario, 29-oct-2026): más que los 5 s de idiomas.
  let arcade = null;
  for (let k = 1; k <= 40 && !arcade; k++) {
    const p = await open(`s=a${k}&a=1&solo=arcade`);
    if (await p.evaluate(() => window.__plan.steps.some((x) => x.kind === 'arcade'))) arcade = p; else await p.close();
  }
  check(Boolean(arcade), 'hay un Arcade de conceptos');
  if (arcade) {
    const rules = await arcade.locator('.arcade-rules').first().textContent();
    check(/según lo que hay que leer/.test(rules), `la presentación no promete 5 s («${rules.trim()}»)`);
    await arcade.locator('.arcade-go').tap();
    await arcade.waitForSelector('.arcade-secs');
    await arcade.waitForTimeout(300);
    const secs = Number(await arcade.locator('.arcade-secs').textContent());
    check(secs >= 8 && secs <= 25, `cada pregunta de conceptos da tiempo para leer (${secs} s)`);
    if (shots) await arcade.screenshot({ path: `${shots}/arcade-dam.png` });
  }
  check(['whatis', 'widget', 'fill_gap', 'predict_output', 'find_bug', 'spot_part'].every((k) => seen.has(k)), `se han jugado los seis tipos de reto (${[...seen].join(', ')})`);
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

// Los tiempos verbales (D-089) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor y con el contenido
// real del curso. Comprueba: la ficha del tiempo enseña su línea del tiempo (antes · AHORA · después) y sus pistas; el
// juego «¿Qué tiempo pide?» llega después y mezcla SOLO tiempos ya aprendidos; «🔎 Ver la pista» resalta la palabra
// clave; acertar y fallar se explican (pista → tiempo, su línea y la traducción); se avanza tocando o deslizando; al
// final, estrellas y la ruta; si fallaste, se vuelve a enseñar ese tiempo. Todo cabe y se toca con el dedo.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5196, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}e2e/harness-escena.html?k=g-present-continuous&learned=g-present-simple,g-past-simple`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];
  const open = async (solo) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await page.goto(`${base}${solo ? `&solo=${solo}` : ''}`);
    await page.waitForSelector('.slide');
    return page;
  };
  const fits = (page) => page.evaluate(() => {
    const out = [...document.querySelectorAll('.slide button, .timeline, .drill-text, .tense-signals b')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); });
    return { overflowX: document.documentElement.scrollWidth > innerWidth, outside: out.length };
  });

  // 1. La ficha: línea del tiempo y pistas, y el juego DESPUÉS de enseñar.
  let page = await open();
  const plan = await page.evaluate(() => window.__plan.steps.map((s) => ({ kind: s.kind, unitKey: s.unitKey })));
  const reel = plan.findIndex((s) => s.kind === 'reel' && s.unitKey === 'g-present-continuous');
  const game = plan.findIndex((s) => s.kind === 'tense');
  check(reel >= 0 && game > reel, `el juego llega después de la ficha del tiempo (ficha ${reel + 1}.ª, juego ${game + 1}.ª)`);
  const face = await page.evaluate(() => ({ svg: Boolean(document.querySelector('.timeline svg')), now: [...document.querySelectorAll('.tl-zone')].map((t) => t.textContent).join(' '), bar: document.querySelectorAll('.tl-action').length, label: document.querySelector('.tl-label')?.textContent, cap: document.querySelector('.timeline figcaption')?.textContent, signals: [...document.querySelectorAll('.tense-signals b')].map((b) => b.textContent) }));
  check(face.svg && face.now === 'ANTES AHORA DESPUÉS' && face.bar === 1, `la ficha dibuja la línea del tiempo (${face.now}) con su barra «${face.label}»`);
  check(/Presente continuo/.test(face.cap ?? ''), `y dice qué tiempo es («${face.cap}»)`);
  check(face.signals.includes('now') && face.signals.includes('Look!'), `con sus pistas: ${face.signals.join(' · ')}`);
  const box = await page.evaluate(() => { const t = document.querySelector('.timeline').getBoundingClientRect(); const labels = [...document.querySelectorAll('.tl-label')].map((l) => l.getBoundingClientRect()); return { w: Math.round(t.width), inside: labels.every((l) => l.left >= t.left - 1 && l.right <= t.right + 1) }; });
  check(box.w >= 280 && box.inside, `la línea se lee bien en el móvil (${box.w}px de ancho, etiquetas dentro)`);
  check(!(await fits(page)).overflowX, 'la ficha no se sale de la pantalla');
  if (shots) await page.screenshot({ path: `${shots}/tiempos-ficha.png`, fullPage: true });
  await page.close();

  // 1b. El ejemplo animado (espejo) empieza cuando se VE: si la tarjeta lo deja fuera de pantalla, espera.
  {
    const small = await browser.newContext({ viewport: { width: 390, height: 320 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await small.newPage();
    await p.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await p.goto(`${server.resolvedUrls.local[0]}e2e/harness-escena.html?k=g-adjective-order&solo=reel`);
    await p.waitForSelector('.morph');
    const below = await p.evaluate(() => document.querySelector('.morph').getBoundingClientRect().top > innerHeight);
    await p.waitForTimeout(6500);
    const waited = await p.evaluate(() => document.querySelectorAll('.morph .mface.flipped').length === 0 && !document.querySelector('.morph-end'));
    check(below && waited, `el ejemplo fuera de pantalla no se gasta: sigue esperando al principio (fuera: ${below}, esperando: ${waited})`);
    await p.evaluate(() => document.querySelector('.morph').scrollIntoView({ block: 'center' }));
    await p.waitForSelector('.morph-end', { timeout: 14000 }).catch(() => undefined);
    check(await p.locator('.morph-end').count() === 1, 'al verlo, arranca solo y llega al final sin pulsar ↻');
    await small.close();
    // Con «Reducir movimiento» (iPhone) también se ve el ejemplo paso a paso, sin tener que pulsar ↻.
    const calm = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const q = await calm.newPage();
    await q.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
    await q.goto(`${server.resolvedUrls.local[0]}e2e/harness-escena.html?k=g-adjective-order&solo=reel`);
    await q.waitForSelector('.morph');
    const starts = (await q.locator('.morph .mchip').count()) > 0 && (await q.locator('.morph .mface.flipped').count()) === 0 ? 1 : 0;
    await q.waitForSelector('.morph-end', { timeout: 14000 }).catch(() => undefined);
    check(starts === 1 && await q.locator('.morph-end').count() === 1, 'con «Reducir movimiento» el ejemplo empieza desde el principio y llega solo al final');
    await calm.close();
  }

  // 2. El juego.
  page = await open('tense');
  const step = await page.evaluate(() => window.__plan.steps.find((s) => s.kind === 'tense'));
  const fromUnits = [...new Set(step.tenseDrills.map((d) => d.unitKey))].sort();
  check(fromUnits.every((k) => ['g-past-simple', 'g-present-continuous', 'g-present-simple'].includes(k)) && fromUnits.includes('g-present-continuous') && fromUnits.length >= 2, `mezcla el tiempo nuevo con los ya aprendidos (${fromUnits.join(', ')})`);
  const tag = () => page.evaluate(() => document.querySelector('.slide .tag')?.textContent ?? '');
  check(/QUÉ TIEMPO PIDE/.test(await tag()), 'se presenta: «🕰️ ¿QUÉ TIEMPO PIDE?»');
  if (shots) await page.screenshot({ path: `${shots}/tiempos-intro.png` });
  const cdp = await context.newCDPSession(page);
  const swipeUp = async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 760 }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 760 - 34 * k }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
  };
  const cheat = await page.evaluate(() => [...document.querySelectorAll('.tense-cheat-row')].map((r) => ({ name: r.querySelector('.tense-chip')?.textContent ?? '', line: Boolean(r.querySelector('.timeline svg')), signals: r.querySelector('.tense-cheat-signals')?.textContent ?? '' })));
  check(cheat.length >= 2 && cheat.some((c) => /Presente simple/i.test(c.name)) && cheat.every((c) => c.line && c.signals.length > 3), `chuleta: cada tiempo con su nombre, línea y pistas (${cheat.map((c) => c.name).join(' · ')})`);
  check(await page.locator('.slide button.arcade-go').count() === 0, 'sin botón: se empieza deslizando');
  await swipeUp();
  const total = step.tenseDrills.length;
  check(total === 6, `seis frases (${total})`);
  const drillOf = (n) => page.evaluate((i) => { const s = window.__plan.steps.find((x) => x.kind === 'tense'); const d = s.tenseDrills[i]; return { ...window.__units[d.unitKey].payload.drills[d.drill], unitKey: d.unitKey }; }, n);
  let wrongAt = -1;
  for (let n = 0; n < total; n++) {
    await page.waitForFunction((k) => new RegExp(`PIDE\\? · ${k}/`).test(document.querySelector('.slide .tag')?.textContent ?? ''), n + 1, { timeout: 5000 });
    const d = await drillOf(n);
    if (n === 0) {
      const gap = await page.locator('.drill-gap').textContent();
      const btns = await page.locator('.tense-options .burst-btn').evaluateAll((b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
      check(/＿/.test(gap) && btns.length === d.wrong.length + 1 && btns.every((h) => h >= 44), `frase con hueco y ${btns.length} formas para elegir, todas tocables (${btns.join(', ')} px)`);
      check((await fits(page)).outside === 0, 'las opciones caben en la pantalla');
      const lefts = await page.locator('.tense-options .burst-btn').evaluateAll((b) => [...new Set(b.map((x) => Math.round(x.getBoundingClientRect().left)))]);
      check(lefts.length === 1, 'una opción debajo de otra: caben formas largas («have you been studying»)');
      if (d.signal) {
        check(await page.locator('.drill-signal').count() === 0, 'la pista no se regala: al principio no está resaltada');
        await page.locator('.tense-clue').tap();
        const sig = await page.locator('.drill-signal').textContent();
        check(sig.toLowerCase() === d.signal.toLowerCase(), `«🔎 Ver la pista» resalta la palabra clave («${sig}»)`);
      }
      if (shots) await page.screenshot({ path: `${shots}/tiempos-pregunta.png` });
    }
    const wrongNow = n === 1;
    const pickText = wrongNow ? d.wrong[0] : d.answer;
    await page.locator('.tense-options .burst-btn', { hasText: new RegExp(`^${pickText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).tap();
    await page.waitForSelector('.tense-after');
    const after = await page.evaluate(() => ({ verdict: document.querySelector('.tense-verdict')?.textContent ?? '', gap: document.querySelector('.drill-gap')?.textContent, why: document.querySelector('.tense-why')?.textContent ?? '', line: Boolean(document.querySelector('.tense-after .timeline svg')), es: document.querySelector('.tense-es')?.textContent ?? '' }));
    if (wrongNow) {
      wrongAt = n;
      check(await page.locator('.drill-verb').count() === 0, 'con el hueco ya lleno, el verbo entre paréntesis desaparece (no se repite)');
      check(/Era/.test(after.verdict) && after.gap === d.answer, `al fallar, se ve la buena en el hueco («${after.gap}») y lo que elegiste`);
      check((!d.signal || after.why.includes(d.signal)) && after.es.length > 0, `y por qué: «${after.why.trim()}» + «${after.es}»`);
      check(after.line || d.unitKey === 'g-simple-or-continuous', 'con la línea del tiempo de ese tiempo');
      const other = await page.locator('.tense-other').count() ? await page.locator('.tense-other').textContent() : '';
      check(/sería .+ pista como/.test(other), `contraste: lo que elegiste pediría otra pista («${other.trim()}»)`);
      if (shots) { await page.waitForTimeout(900); await page.screenshot({ path: `${shots}/tiempos-fallo.png` }); }
    } else if (n === 0) {
      check(/¡Sí!/.test(after.verdict) && after.gap === d.answer, `al acertar, se celebra y se llena el hueco («${after.gap}»)`);
      if (shots) await page.screenshot({ path: `${shots}/tiempos-acierto.png` });
    }
    if (wrongNow || n === 2) await swipeUp();
    else if (n === 0) {
      await page.waitForFunction(() => /PIDE\? · 2\//.test(document.querySelector('.slide .tag')?.textContent ?? ''), null, { timeout: 5000 });
      check(true, 'al acertar, pasa sola a la siguiente (sin botón)');
    }
    if (n === 2) check(true, 'se pasa a la siguiente deslizando hacia arriba');
  }
  await page.waitForFunction(() => /CASO CERRADO/.test(document.querySelector('.slide .tag')?.textContent ?? ''), null, { timeout: 5000 });
  const end = await page.evaluate(() => ({ on: document.querySelectorAll('.tense-stars span.on').length, text: document.querySelector('.slide').textContent.replace(/\s+/g, ' ') }));
  check(end.on === 2 && /5\/6 frases resueltas/.test(end.text), `al final, estrellas (${end.on}/3) y aciertos («5/6 frases resueltas»)`);
  const route = await page.locator('.tense-route p').textContent();
  check(/3 de 3/.test(route), `al final, tu ruta de los tiempos («${route.trim()}»)`);
  if (shots) await page.screenshot({ path: `${shots}/tiempos-fin.png` });
  check(await page.locator('.tense-end button.arcade-go').count() === 0, 'final sin botón «Seguir»');
  await swipeUp();
  await page.waitForTimeout(300);
  const teach = await page.evaluate(() => ({ tag: document.querySelector('.slide .tag')?.textContent ?? '', line: Boolean(document.querySelector('.teach .timeline svg')), note: document.querySelector('.teach-note')?.textContent ?? '' }));
  check(wrongAt >= 0 && /RECUÉRDALO/.test(teach.tag) && teach.line && /línea del tiempo/.test(teach.note), 'como fallaste una, se vuelve a enseñar ese tiempo con su línea antes de seguir');
  if (shots) await page.screenshot({ path: `${shots}/tiempos-repaso.png`, fullPage: true });
  check(!(await fits(page)).overflowX, 'nada se sale de la pantalla');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

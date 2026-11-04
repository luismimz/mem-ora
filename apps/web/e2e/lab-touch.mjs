// Dibujos y laboratorios (D-112) en un móvil emulado (390×844) con TOQUES REALES: la ficha dibuja tablas (🔑, 🔗, tipos)
// y el diagrama E/R; en el Taller se toca la clave ajena en una tabla y se escribe una consulta SQL que se ejecuta DE
// VERDAD (SQLite en el navegador): un error real del motor, un resultado que no es el pedido y, al final, el bueno.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5193, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}e2e/harness-taller.html`;
const shots = process.env.E2E_SHOTS;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await context.newCDPSession(page);
  const swipeUp = async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 780 }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 780 - 34 * k }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
  };
  const toBottom = () => page.evaluate(() => { const s = document.querySelector('.slide'); if (s) s.scrollTop = s.scrollHeight; });

  // 1. La ficha dibuja las tablas y el diagrama.
  await page.goto(`${base}?k=bd-clave-ajena&solo=reel`);
  await page.waitForSelector('.slide');
  for (let k = 0; k < 4 && !(await page.locator('.vt').count()); k++) { await toBottom(); await swipeUp(); }
  await page.waitForSelector('.vt', { timeout: 5000 });
  const t = await page.evaluate(() => ({ tables: document.querySelectorAll('.concept-face .vt, .vt').length, pk: [...document.querySelectorAll('.vt th.pk')].length, fk: document.querySelector('.vt th.fk')?.textContent ?? '', type: document.querySelector('.vt-type')?.textContent ?? '', er: Boolean(document.querySelector('svg.ver')), diamond: document.querySelectorAll('svg.ver polygon').length, card: [...document.querySelectorAll('.ver-card')].map((x) => x.textContent) }));
  check(t.tables >= 2 && t.pk >= 2 && /CLIENTE\.dni/.test(t.fk) && /VARCHAR2/.test(t.type), `la ficha dibuja las tablas: 🔑 primarias, 🔗 ajena con su destino y tipos de dato (${t.type})`);
  check(t.er && t.diamond === 1 && t.card.includes('(0,N)'), `y el diagrama E/R con su rombo y la participación (${t.card.join(' ')})`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados (las tablas anchas se desplazan dentro)');
  if (shots) { await page.evaluate(() => document.querySelector('.vt')?.scrollIntoView()); await page.screenshot({ path: `${shots}/lab-ficha-tablas.png` }); await page.evaluate(() => document.querySelector('svg.ver')?.scrollIntoView()); await page.screenshot({ path: `${shots}/lab-ficha-er.png` }); }

  // 2. Taller con laboratorios: buscar una semilla que traiga el de tocar y el de SQL.
  let found = false;
  for (let s = 1; s < 80 && !found; s++) {
    await page.goto(`${base}?k=bd-clave-ajena,bd-where,extends,bucle-for&s=lab${s}&solo=workshop`);
    await page.waitForSelector('.slide');
    found = await page.evaluate(() => { const w = window.__plan.steps.find((x) => x.kind === 'workshop')?.workshop ?? []; return w.filter((i) => i.kind === 'lab').length >= 2 && w[0]?.kind === 'lab'; });
  }
  check(found, 'el Taller trae los laboratorios de las fichas que los tienen');
  await swipeUp(); // portada del Taller
  for (let n = 0; n < 6; n++) {
    await page.waitForTimeout(300);
    const tag = await page.textContent('.slide .tag').catch(() => '');
    if (/TALLER TERMINADO/.test(tag)) break;
    if (/TOCA EN LA TABLA/.test(tag)) {
      const heads = await page.$$eval('.vt-tap', (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
      check(heads.every((h) => h >= 36), `toca en la tabla: cabeceras tocables (${heads.join(', ')} px)`);
      await page.locator('.vt th', { hasText: 'dni' }).nth(1).locator('.vt-tap').tap();
      await page.waitForSelector('.tense-verdict');
      check(/Bien visto/.test(await page.textContent('.tense-verdict')) && await page.locator('.vt th.is-right').count() === 1, 'tocar la clave ajena acierta y se marca en verde');
      if (shots) await page.screenshot({ path: `${shots}/lab-tocar.png` });
    } else if (/ESCRIBE LA CONSULTA/.test(tag)) {
      await page.waitForSelector('.slide .vt-result');
      const prompt = await page.textContent('.shop-ask');
      check((await page.locator('.slide .vt-result').count()) >= 2, 'el laboratorio enseña las tablas de partida con sus datos');
      // Error real del motor, escrito con los atajos (sin teclado).
      await page.locator('.sql-chip', { hasText: /^SELECT$/ }).first().tap();
      await page.locator('.sql-input').fill('SELECT nombr FROM cliente');
      await page.locator('.sql-run').tap();
      await page.waitForSelector('.sql-error');
      check(/no such column: nombr/.test(await page.textContent('.sql-error')), 'un error se ve tal cual lo da el motor (no such column)');
      if (/Corralejo/.test(prompt)) {
        await page.locator('.sql-input').fill('SELECT nombre FROM cliente');
        await page.locator('.sql-run').tap();
        await page.waitForSelector('.tense-verdict');
        check(/no sale lo pedido/.test(await page.textContent('.tense-verdict')) && /Tenía que salir/.test(await page.textContent('.tense-after')), 'si se ejecuta pero no sale lo pedido, enseña tu resultado y el que tenía que salir');
        if (shots) await page.screenshot({ path: `${shots}/lab-sql-mal.png`, fullPage: true });
        check(/UNA SOLUCIÓN/.test(await page.textContent('.tense-after')), 'tras dos intentos, enseña una solución');
      } else {
        await page.locator('.sql-input').fill('SELECT nombre, horas FROM alquiler JOIN cliente USING (dni)');
        await page.locator('.sql-run').tap();
        await page.waitForSelector('.tense-verdict.ok');
        check(/Funciona/.test(await page.textContent('.tense-verdict')), 'otra consulta correcta (USING en vez de ON) también vale: se corrige por el resultado');
        if (shots) await page.screenshot({ path: `${shots}/lab-sql-bien.png`, fullPage: true });
      }
    }
    await toBottom();
    await swipeUp();
  }
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

// «Construye la frase» al fallar (D-086) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor.
// Comprueba: al fallar, la tarjeta NO pasa sola; enseña tu frase con las piezas mal puestas en rojo, la correcta con las
// que cambian resaltadas, qué pieza va antes y la regla; todo cabe en la pantalla; al deslizar llega la ficha con tu
// frase y la buena. Y que acertar sigue pasando solo.
// Uso: pnpm --filter @memora/web e2e   (capturas en E2E_SHOTS si se indica)
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5197, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}e2e/harness-escena.html?k=g-present-continuous`;
const shots = process.env.E2E_SHOTS;

const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };
const esc = (w) => new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

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
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 700 }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 700 - 34 * i }] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(450);
    };
    const tag = () => page.evaluate(() => document.querySelector('.slide .tag')?.textContent ?? '');
    const untilTag = async (re, max = 8) => { for (let i = 0; i < max && !re.test(await tag()); i++) await swipeUp(); return re.test(await tag()); };
    // Las palabras de la frase que pide esta tarjeta, en su orden correcto.
    const words = () => page.evaluate(() => {
      const st = window.__plan.steps.find((s) => s.kind === 'build' && !s.retry);
      const text = Object.values(window.__units)[0].payload.examples[st.example].text;
      return text.replace(/[.!?¡¿]+$/u, '').split(/\s+/).filter(Boolean);
    });
    const put = async (order) => { for (const w of order) { await page.locator('.build-bank .tile:not([disabled])', { hasText: esc(w) }).first().tap(); await page.waitForTimeout(90); } };
    return { page, swipeUp, tag, untilTag, words, put };
  }

  // 1. Fallar: se explica el error y no pasa sola.
  let s = await open('e2e-frase');
  check(await s.untilTag(/CONSTRUYE/), 'tras la ficha del truco llega «Construye la frase»');
  const w = await s.words();
  const wrong = [w[1], w[0], ...w.slice(2)];
  await s.put(wrong);
  await s.page.waitForTimeout(300);
  check(await s.page.locator('.slide.build.wrong').count() === 1, 'una frase mal ordenada se marca en rojo');
  const why = await s.page.evaluate(() => {
    const b = document.querySelector('.build-why'); const r = b?.getBoundingClientRect();
    return b ? { ko: b.querySelectorAll('.tile.cmp.ko').length, fix: b.querySelectorAll('.tile.cmp.fix').length, reason: b.querySelector('.build-reason')?.textContent ?? '', rule: Boolean(b.querySelector('.build-rule')), bottom: Math.round(r.bottom), overflowX: document.documentElement.scrollWidth > innerWidth } : null;
  });
  check(Boolean(why) && why.ko >= 2 && why.fix >= 2, `marca las piezas mal colocadas en tu frase y en la correcta (${why?.ko} y ${why?.fix})`);
  check(Boolean(why) && why.reason.includes(`«${w[0]}» va antes que «${w[1]}»`), `dice qué pieza va antes («${why?.reason}»)`);
  check(Boolean(why?.rule), 'recuerda la regla del truco');
  check(Boolean(why) && why.bottom <= 844 && !why.overflowX, `la explicación cabe en la pantalla (abajo en ${why?.bottom}px)`);
  if (shots) await s.page.screenshot({ path: `${shots}/frase-fallo.png` });
  await s.page.waitForTimeout(2500);
  check(/CONSTRUYE/.test(await s.tag()), 'al fallar NO pasa sola: te deja leer en qué te has equivocado');
  await s.swipeUp();
  const teach = await s.page.evaluate(() => document.querySelector('.slide')?.textContent ?? '');
  check(/RECUÉRDALO/.test(teach) && teach.includes('Tu frase') && teach.includes('Así es'), 'al deslizar, la ficha del truco con tu frase y la buena');
  if (shots) await s.page.screenshot({ path: `${shots}/frase-ficha.png` });
  await s.page.close();

  // 2. Acertar sigue pasando solo.
  s = await open('e2e-frase');
  await s.untilTag(/CONSTRUYE/);
  await s.put(await s.words());
  await s.page.waitForTimeout(250);
  check(await s.page.locator('.slide.build.right').count() === 1 && await s.page.locator('.build-why').count() === 0, 'la frase bien construida se marca en verde, sin explicación de error');
  let moved = false;
  for (let i = 0; i < 20 && !moved; i++) { await s.page.waitForTimeout(250); moved = !/CONSTRUYE/.test(await s.tag()); }
  check(moved, 'al acertar pasa sola a la siguiente tarjeta');
  await s.page.close();
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n✗ ${failed} de ${results.length} comprobaciones fallan` : `\n✓ ${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

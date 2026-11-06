// Retención (usuario, 6-nov-2026), en móvil emulado 390×844 con toques reales:
//  1) antes de la ficha de un concepto nuevo, su pregunta «¿qué crees?» — fallarla NO cuenta (no se envía nada);
//  2) tras la ficha, lo fallado se repite al final hasta sacarlo (no se avanza sin dominarlo);
//  3) al cerrar, «Antes de irte»: rehacer lo de hoy sin mirar.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5241, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-taller.html?k=extends,bucle-for&s=r1`;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  await page.goto(url);
  await page.waitForSelector('.slide');
  const plan = await page.evaluate(() => window.__plan.steps.map((s) => ({ kind: s.kind, unit: s.unitKey || s.workshop?.[0]?.unitKey, pre: Boolean(s.pre), closing: Boolean(s.closing), direct: Boolean(s.direct) })));
  const pre = plan.findIndex((s) => s.pre && s.unit === 'extends');
  const reel = plan.findIndex((s) => s.kind === 'reel' && s.unit === 'extends');
  const closing = plan.findIndex((s) => s.closing);
  check(pre === 0 && reel > pre, `la ronda empieza por «¿qué crees?» de extends, antes de su ficha (${pre} < ${reel})`);
  check(closing > reel && plan.slice(closing + 1).every((s) => s.kind === 'summary' || !s.kind.includes('workshop')), `«Antes de irte» llega al final (paso ${closing} de ${plan.length})`);

  // 1. La pregunta previa: fallarla no cuenta.
  const tag = await page.locator('.slide .tag').first().textContent();
  check(/ANTES DE VERLO/.test(tag ?? ''), `se presenta como pregunta previa: «${tag}»`);
  const wrong = page.locator('.shop-tile', { hasNotText: /^extends$/ }).first();
  await wrong.tap();
  await page.waitForTimeout(300);
  check(await page.locator('.tense-why', { hasText: 'Normal si no lo sabías' }).count() === 1, 'al fallarla: «Normal si no lo sabías: ahora lo vas a ver»');
  const out = await page.evaluate(() => { try { return Object.values(JSON.parse(localStorage.getItem('memora.offline.outbox') ?? '{}')).flat().length; } catch { return -1; } });
  check(out === 0, `no se envía como fallo (${out} eventos)`);
  await page.screenshot({ path: process.env.SHOT ?? '/tmp/retencion-pre.png' });
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors[0]}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

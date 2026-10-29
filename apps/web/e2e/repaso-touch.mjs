// «Repaso rápido» (D-094) con TOQUES TÁCTILES REALES en un móvil emulado (390×844), sin servidor y con el contenido real
// del curso. Comprueba: la ronda EMPIEZA por el repaso (Arcade, sin ficha delante); las palabras jóvenes se reconocen
// (inglés → significado) y las maduras se recuerdan (significado → inglés: «Ver la respuesta» y te calificas); lo que
// fallas vuelve al final de la ráfaga, al revés; al acabar se ve qué vuelve antes; y nada se sale de la pantalla.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5198, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-escena.html?k=g-plural&repaso=boy,nine,brown&recuerda=nine`;
const shots = process.env.E2E_SHOTS;
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
  const plan = await page.evaluate(() => window.__plan.steps.map((s) => s.kind));
  check(plan[0] === 'arcade' && plan.filter((k) => k === 'arcade').length === 1, `la ronda empieza por el repaso y no hay otro Arcade (${plan.slice(0, 3).join(' → ')}…)`);
  const intro = await page.evaluate(() => ({ tag: document.querySelector('.slide .tag')?.textContent, rules: document.querySelector('.arcade-rules')?.textContent }));
  check(/REPASO/.test(intro.tag ?? '') && /curva del olvido/.test(intro.rules ?? ''), `presenta el repaso: «${intro.rules}»`);
  if (shots) await page.screenshot({ path: `${shots}/repaso-intro.png` });
  await page.locator('.arcade-go').tap();
  const units = await page.evaluate(() => window.__units);
  const seen = [];
  let againSeen = false; let recallSeen = false; let failedOnce = false;
  for (let n = 0; n < 8; n++) {
    await page.waitForTimeout(200);
    const tag = (await page.locator('.slide .tag').first().textContent()) ?? '';
    if (/FIN DEL REPASO/.test(tag)) break;
    if (/OTRA VEZ/.test(tag)) againSeen = true;
    const prompt = ((await page.locator('.arcade-prompt').textContent()) ?? '').trim();
    seen.push(prompt);
    const kind = ((await page.locator('.arcade-kind').textContent().catch(() => '')) ?? '').trim();
    if (/inglés/.test(kind) && !/OTRA VEZ/.test(tag)) {
      // Lo maduro (D-100): del español al inglés eligiendo entre opciones, en UNA pantalla (sin «Ver la respuesta»).
      recallSeen = true;
      const opts = (await page.locator('.options .option').allTextContents()).map((x) => x.trim());
      check(/nueve/i.test(prompt) && opts.some((o) => /^NINE$/i.test(o)) && await page.locator('.arcade-reveal').count() === 0, `lo maduro, con opciones en inglés: «${prompt}» → ${opts.join(' / ')}`);
      if (shots) await page.screenshot({ path: `${shots}/repaso-recuerda.png` });
      await page.locator('.options .option[data-ok="1"]').tap();
      await page.waitForTimeout(800);
      continue;
    }
    // Reconocer: la primera vez se falla aposta para ver que vuelve; después, bien.
    const u = Object.values(units).find((x) => x.payload.text === prompt || x.payload.text?.toUpperCase() === prompt || x.payload.meaning === prompt);
    const options = page.locator('.options .option');
    const ok = await options.evaluateAll((els) => els.findIndex((e) => e.dataset.ok === '1'));
    const bad = await options.evaluateAll((els) => els.findIndex((e) => e.dataset.ok === '0'));
    if (!failedOnce && u?.key === 'boy') { failedOnce = true; await options.nth(bad).tap(); if (shots) await page.waitForTimeout(200), await page.screenshot({ path: `${shots}/repaso-fallo.png` }); await page.waitForTimeout(1700); }
    else { await options.nth(ok).tap(); await page.waitForTimeout(800); }
  }
  check(recallSeen, 'lo maduro se pregunta del español al inglés');
  check(failedOnce && againSeen, 'lo fallado vuelve al final de la ráfaga («OTRA VEZ»)');
  const end = await page.evaluate(() => ({ tag: document.querySelector('.slide .tag')?.textContent, score: document.querySelector('.arcade-score')?.textContent, missed: [...document.querySelectorAll('.arcade-missed li')].map((l) => l.textContent) }));
  check(/FIN DEL REPASO/.test(end.tag ?? '') && end.score === '2/3' && end.missed.length === 1 && /boy/.test(end.missed[0] ?? ''), `al acabar: ${end.score} a la primera y vuelve antes «${end.missed.join(', ')}»`);
  if (shots) await page.screenshot({ path: `${shots}/repaso-fin.png` });
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  check(fits, 'nada se sale por los lados');
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\nRepaso rápido: ${results.length} comprobaciones correctas`);
process.exit(failed ? 1 : 0);

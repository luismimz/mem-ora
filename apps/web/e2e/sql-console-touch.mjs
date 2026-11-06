// «Tu base de datos» (6-nov-2026) en móvil emulado 390×844 con toques reales: lo que creas se queda al volver.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5251, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = `${server.resolvedUrls.local[0]}e2e/harness-sql.html`;
const results = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${text}`); };
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForSelector('.sql-input');
  await page.waitForFunction(() => !document.querySelector('.sql-actions .option')?.hasAttribute('disabled'));
  await page.locator('.sql-input').tap();
  await page.keyboard.insertText("CREATE TABLE bici (id INT AUTO_INCREMENT PRIMARY KEY, modelo VARCHAR(30));\nINSERT INTO bici (modelo) VALUES ('Orbea'), ('Trek');\nSELECT * FROM bici;");
  await page.locator('.sql-actions .primary').tap();
  await page.waitForTimeout(300);
  const out = await page.locator('.sql-out').textContent();
  check(/Orbea/.test(out ?? '') && /Trek/.test(out ?? ''), `ejecuta MySQL de verdad: ${out?.slice(0, 40)}`);
  await page.reload();
  await page.waitForSelector('.sql-table h3');
  const tabla = await page.locator('.sql-table h3').first().textContent();
  const filas = await page.locator('.sql-table tbody tr').count();
  check(tabla === 'bici' && filas === 2, `al volver, tu tabla sigue ahí (${tabla}, ${filas} filas)`);
  await page.locator('.sql-input').tap();
  await page.keyboard.insertText('SELECT * FROM moto;');
  await page.locator('.sql-actions .primary').tap();
  await page.waitForTimeout(200);
  check(/❌/.test((await page.locator('.sql-out').textContent()) ?? ''), 'un error se ve tal cual');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'nada se sale por los lados');
  await page.screenshot({ path: process.env.SHOT ?? '/tmp/sql.png' });
  check(errors.length === 0, `sin errores en la página${errors.length ? `: ${errors[0]}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} comprobaciones fallidas` : `\n${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

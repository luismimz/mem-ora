import { chromium } from 'playwright';
import { createServer } from 'vite';
const web = '/home/claude/mem-ora/apps/web/';
const server = await createServer({ root: web, configFile: `${web}vite.config.ts`, logLevel: 'error', server: { port: 5196, host: '127.0.0.1' } });
await server.listen();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const measure = (p) => p.evaluate(() => {
  const sl = [...document.querySelectorAll('.slide')].at(-1); const st = getComputedStyle(sl); const r = sl.getBoundingClientRect();
  const kids = [...sl.children].filter((c) => !['fixed', 'absolute'].includes(getComputedStyle(c).position) && c.getBoundingClientRect().height > 0);
  return { cls: sl.className, top: Math.round(kids[0].getBoundingClientRect().top - r.top - parseFloat(st.paddingTop)), bottom: Math.round(r.bottom - parseFloat(st.paddingBottom) - kids.at(-1).getBoundingClientRect().bottom), h: Math.round(r.height), last: sl.lastElementChild.className, scroll: sl.scrollHeight > sl.clientHeight };
});
for (const vp of [{ width: 390, height: 844 }, { width: 700, height: 760 }]) {
  const p = await (await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
  for (let s = 1; s < 40; s++) {
    await p.goto(`${server.resolvedUrls.local[0]}e2e/harness-taller.html?k=constructor,extends,bucle-for,nullpointer&s=b${s}&solo=challenge`);
    await p.waitForSelector('.slide');
    if (await p.evaluate(() => window.__plan.steps[0]?.kind === 'challenge')) { console.log(vp.width, 'boss', JSON.stringify(await measure(p))); await p.screenshot({ path: `/tmp/claude-0/shots/c-boss-${vp.width}.png` }); break; }
  }
  await p.goto(`${server.resolvedUrls.local[0]}e2e/harness-taller.html?s=t24&solo=workshop`);
  await p.waitForSelector('.slide');
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: vp.height - 80 }] });
  for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: vp.height - 80 - 34 * k }] }); await p.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(500);
  console.log(vp.width, 'taller', JSON.stringify(await measure(p)));
}
await b.close(); await server.close();
